#!/usr/bin/env python3
"""Release at most one vetted Korean article from a dated GitHub queue per run."""
from __future__ import annotations
import argparse
from datetime import datetime, time
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
SITE = "https://emfls.github.io"
DAILY_LIMIT = 12
CATEGORIES = {"ai","car","compare","daiso","gov","it","parenting","seasonal","travel","costco","gift","fashion","camp","fitness","animal"}
ROUTE = re.compile(r"kor/report/([a-z0-9-]+)/([a-z0-9-]+)\.html\Z")
SLUG = re.compile(r"[a-z0-9][a-z0-9-]{4,80}\Z")

class MarkupCheck(HTMLParser):
    def __init__(self):
        super().__init__()
        self.lang = self.canonical = self.title_text = ""
        self.title_seen = self.h1_seen = self.viewport = self.in_title = False
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "html": self.lang = d.get("lang", "")
        if tag == "link" and "canonical" in d.get("rel", "").split(): self.canonical = d.get("href", "")
        if tag == "meta" and d.get("name", "").lower() == "viewport": self.viewport = True
        if tag == "title": self.in_title = self.title_seen = True
        if tag == "h1": self.h1_seen = True
    def handle_endtag(self, tag):
        if tag == "title": self.in_title = False
    def handle_data(self, data):
        if self.in_title: self.title_text += data

def added_pages_today(root: Path, now: datetime) -> set[str]:
    start = datetime.combine(now.astimezone(KST).date(), time.min, tzinfo=KST)
    p = subprocess.run(
        ["git","log",f"--since={start.isoformat()}","--diff-filter=A","--name-only","--format=","--","kor/"],
        cwd=root, capture_output=True, text=True, check=False)
    if p.returncode: raise RuntimeError("Cannot read current-day Git history: " + p.stderr[:200])
    return {s.strip() for s in p.stdout.splitlines() if s.strip().startswith("kor/") and s.strip().endswith(".html")}

def validate_article(candidate: dict, root: Path):
    if not isinstance(candidate, dict): raise ValueError("Queue entry must be JSON object")
    route, title, html, sources = (candidate.get(k) for k in ("destination","title","html","sources"))
    m = ROUTE.fullmatch(route or "")
    if not m or m.group(1) not in CATEGORIES or not SLUG.fullmatch(m.group(2)):
        raise ValueError("Category/slug invalid or not supported")
    if (root / route).exists(): raise ValueError("Refuse duplicate/overwrite: " + route)
    if not isinstance(title,str) or len(title.strip()) < 16: raise ValueError("Missing descriptive title")
    if not isinstance(html,str) or len(html) < 2400 or len(re.findall(r"[가-힣]",html)) < 280:
        raise ValueError("Article is incomplete or thin")
    if not isinstance(sources,list) or not sources or not all(
        isinstance(x,str) and urlsplit(x).scheme == "https" and urlsplit(x).hostname for x in sources
    ): raise ValueError("Sources require at least one HTTPS official reference")
    p = MarkupCheck()
    p.feed(html)
    url = SITE + "/" + route
    if p.lang.lower() not in {"ko","ko-kr"} or p.canonical != url or not p.h1_seen or not p.viewport or not p.title_seen or title.strip() not in p.title_text:
        raise ValueError("HTML title/H1/Korean/viewport/canonical mismatch")
    if "<html" not in html.lower() or "</html>" not in html.lower(): raise ValueError("Incomplete HTML document")
    return route, url, html

def previous_release_is_live(root: Path) -> bool:
    ledger = root / "data/scheduled-publication-ledger.jsonl"
    if not ledger.is_file(): return True
    rows = [x for x in ledger.read_text(encoding="utf-8").splitlines() if x.strip()]
    if not rows: return True
    last = json.loads(rows[-1])
    url = last.get("url","")
    expected = last.get("title","")
    if not url.startswith(SITE + "/kor/") or not expected:
        raise RuntimeError("Previous publication ledger entry is invalid")
    try:
        req = Request(url + "?scheduled-live-check=1", headers={"Cache-Control":"no-cache"})
        with urlopen(req, timeout=15) as response:
            html = response.read().decode("utf-8", errors="replace")
            return response.status == 200 and expected in html
    except (HTTPError, URLError, TimeoutError):
        return False

def plan(root: Path, now: datetime):
    now = now.astimezone(KST)
    if now.date().isoformat() < "2026-10-23": return {"status":"NOT_STARTED","kst":now.isoformat()}
    if not previous_release_is_live(root):
        raise RuntimeError("PREVIOUS_RELEASE_NOT_LIVE: repair official Pages build before publishing another page")
    existing = added_pages_today(root,now)
    if len(existing) >= DAILY_LIMIT: return {"status":"DAILY_LIMIT_REACHED","today":len(existing)}
    queue = root / "data/scheduled-publication-queue"
    for q in sorted(queue.glob("*.json")) if queue.is_dir() else []:
        candidate = json.loads(q.read_text(encoding="utf-8"))
        due = candidate.get("available_from_kst")
        if due:
            at = datetime.fromisoformat(due)
            if at.tzinfo is None: raise ValueError("Due datetime must have timezone")
            if at.astimezone(KST) > now: continue
        route,url,html = validate_article(candidate,root)
        return {"status":"READY","queueFile":str(q.relative_to(root)),"destination":route,
                "url":url,"title":candidate["title"],"html":html,"kst":now.isoformat(),"today":len(existing)}
    return {"status":"QUEUE_EMPTY","today":len(existing),"kst":now.isoformat()}

def release(root: Path, item: dict):
    dest = root / item["destination"]
    sitemap = dest.parent / "sitemap.xml"
    if not sitemap.is_file(): raise RuntimeError("Category sitemap absent")
    old = sitemap.read_text(encoding="utf-8")
    if "</urlset>" not in old or item["url"] in old: raise RuntimeError("Invalid/duplicate sitemap entry")
    entry = "  <url>\n    <loc>"+escape(item["url"])+"</loc>\n    <lastmod>"+item["kst"][:10]+"</lastmod>\n  </url>\n"
    dest.write_text(item["html"],encoding="utf-8")
    sitemap.write_text(old.replace("</urlset>",entry+"</urlset>"),encoding="utf-8")
    (root / item["queueFile"]).unlink()
    ledger = root / "data/scheduled-publication-ledger.jsonl"
    with ledger.open("a",encoding="utf-8") as f:
        f.write(json.dumps({"url":item["url"],"title":item["title"],"slotKst":item["kst"],
                            "phase":"SOURCE_STAGED_NOT_YET_LIVE"},ensure_ascii=False)+"\n")
    return {k:v for k,v in item.items() if k!="html"} | {"status":"SOURCE_STAGED"}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",default=".")
    p.add_argument("--now")
    p.add_argument("--dry-run",action="store_true")
    args=p.parse_args()
    root=Path(args.root).resolve()
    now=datetime.fromisoformat(args.now) if args.now else datetime.now(KST)
    if now.tzinfo is None: raise SystemExit("--now requires timezone")
    try:
        item=plan(root,now)
        result=release(root,item) if item["status"]=="READY" and not args.dry_run else item
        print(json.dumps({k:v for k,v in result.items() if k!="html"},ensure_ascii=False))
    except (RuntimeError,ValueError,OSError) as exc:
        raise SystemExit("Scheduled publisher: "+str(exc))

if __name__=="__main__": main()
