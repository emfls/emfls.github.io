"""Fail-closed, deterministic policy for selecting one launch-ready keyword."""
from datetime import datetime, timezone
from difflib import SequenceMatcher
import re

def normalize_keyword(value):
    return re.sub(r"[^0-9a-z가-힣]", "", str(value or "").casefold())

def _truthy(value): return str(value).casefold() in {"true", "1", "yes"}
def _tool(row):
    text = f"{row.get('category','')}|{row.get('content_types','')}|{row.get('intent','')}".casefold()
    return any(x in text for x in ("tool", "calculator", "계산기", "무료 도구"))
def _ymyl(row):
    text=f"{row.get('keyword','')}|{row.get('category','')}|{row.get('content_types','')}".casefold()
    return any(x in text for x in ("finance","금융","투자","주식","법률","legal","의료","health","medical","대출","보험"))

def select_launch_candidate(rows, existing_urls=None, published_keywords=None, daily_limit=1, selected_at=None, max_age_days=30, launched_count=0):
    existing_urls={str(x).split('?',1)[0] for x in (existing_urls or set())}; published={normalize_keyword(x) for x in (published_keywords or set())}
    now=datetime.fromisoformat(selected_at) if selected_at else datetime.now(timezone.utc)
    if now.tzinfo is None: now=now.replace(tzinfo=timezone.utc)
    excluded={"duplicate_url":0,"duplicate_keyword":0,"similar_intent":0,"invalid_score":0,"stale_winner":0,"ymyl":0,"ineligible":0,"daily_limit":0}
    if int(launched_count) >= int(daily_limit):
        excluded["daily_limit"] = 1
        return {"queue": [], "excluded": excluded, "dailyLimit": int(daily_limit)}
    published_norm=list(published)
    def rank(r): return (-(1 if r.get("status")=="WINNER" else 0), -(1 if r.get("status")=="CANDIDATE" else 0), -(1 if _tool(r) else 0), -float(r.get("opportunity_score") or 0), normalize_keyword(r.get("keyword")))
    eligible=[]; seen=[]
    for row in sorted(rows, key=rank):
        keyword=str(row.get("keyword") or ""); norm=normalize_keyword(keyword); url=str(row.get("suggested_url") or "")
        if not keyword or not _truthy(row.get("score_valid")) or not row.get("opportunity_score") or str(row.get("action","NEW_PAGE")) != "NEW_PAGE": excluded["invalid_score"]+=1; continue
        if row.get("status") in {"PUBLISHED","REJECTED","COOLDOWN","EXPIRED"}: excluded["ineligible"]+=1; continue
        if row.get("status") == "WINNER" and row.get("last_checked"):
            try:
                checked=datetime.fromisoformat(str(row["last_checked"]).replace("Z","+00:00")); checked=checked if checked.tzinfo else checked.replace(tzinfo=timezone.utc)
                if (now-checked).days > max_age_days: excluded["stale_winner"]+=1; continue
            except ValueError: excluded["stale_winner"]+=1; continue
        if not url.startswith("/kor/") or url in existing_urls: excluded["duplicate_url"]+=1; continue
        if norm in published or any(norm == n for _,n in seen): excluded["duplicate_keyword"]+=1; continue
        if any(SequenceMatcher(None,norm,n).ratio() >= .86 for n in published_norm) or any(SequenceMatcher(None,norm,n).ratio() >= .86 for _,n in seen): excluded["similar_intent"]+=1; continue
        if _ymyl(row): excluded["ymyl"]+=1; continue
        seen.append((keyword,norm)); eligible.append(row)
    eligible.sort(key=rank)
    queue=[]
    for row in eligible[:max(0,int(daily_limit))]:
        queue.append({"keyword":row["keyword"],"source":row.get("source") or "KEYWORD_HUNTER","status":"READY_TO_LAUNCH","opportunity_score":float(row["opportunity_score"]),"confidence":row.get("confidence"),"category":row.get("category"),"intended_page_type":"free_tool" if _tool(row) else "article","suggested_url":row.get("suggested_url"),"duplicate_check":"passed","reason":"winner/tool priority with verified score and no overlap","selected_at":selected_at})
    return {"queue":queue,"excluded":excluded,"dailyLimit":int(daily_limit)}
