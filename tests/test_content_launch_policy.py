import copy
from scripts.content_launch_policy import select_launch_candidate, normalize_keyword

def row(**kw):
    base = {"keyword":"계산기", "status":"NEW", "score_valid":"True", "opportunity_score":"80", "confidence":"HIGH", "category":"tools", "action":"NEW_PAGE", "content_types":"calculator/tool|evergreen", "closest_url":"", "overlap":"NO_OVERLAP"}
    base.update(kw); return base

def test_policy_blocks_duplicates_invalid_stale_ymyl_and_caps_one():
    rows=[row(keyword="기존", suggested_url="/kor/util/existing/index.html"), row(keyword="새 도구", suggested_url="/kor/util/new/index.html"), row(keyword="새 금융", category="finance", content_types="commercial", suggested_url="/kor/finance/new.html"), row(keyword="무효", score_valid="False"), row(keyword="오래된", status="WINNER", last_checked="2020-01-01")]
    result=select_launch_candidate(rows, existing_urls={"/kor/util/existing/index.html"}, published_keywords={"계산기"}, daily_limit=1)
    assert len(result["queue"]) == 1
    assert result["queue"][0]["keyword"] == "새 도구"
    assert result["excluded"]["duplicate_url"] >= 1

def test_tool_priority_and_determinism():
    rows=[row(keyword="가격 추천", category="finance", content_types="commercial", suggested_url="/kor/column/a.html"), row(keyword="단위 계산기", category="tools", content_types="calculator/tool", suggested_url="/kor/util/b/index.html")]
    a=select_launch_candidate(rows, existing_urls=set(), daily_limit=1); b=select_launch_candidate(copy.deepcopy(rows), existing_urls=set(), daily_limit=1)
    assert a == b and a["queue"][0]["keyword"] == "단위 계산기"

def test_normalize_keyword():
    assert normalize_keyword("  ETF-세금! ") == "etf세금"

def test_winner_precedes_candidate():
    rows=[row(keyword="후보",status="CANDIDATE",suggested_url="/kor/a.html"),row(keyword="승자",status="WINNER",suggested_url="/kor/b.html")]
    assert select_launch_candidate(rows,daily_limit=1)["queue"][0]["keyword"] == "승자"

def test_published_similar_intent_and_daily_limit():
    rows=[row(keyword="단위 계산 방법",suggested_url="/kor/a.html")]
    assert select_launch_candidate(rows,published_keywords={"단위계산방법론"})["excluded"]["similar_intent"] == 1
    assert select_launch_candidate(rows,daily_limit=1,launched_count=1)["queue"] == []
