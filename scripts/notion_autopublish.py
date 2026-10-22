#!/usr/bin/env python3
"""Publish one Notion database draft into this static GitHub Pages repository."""
import argparse
from datetime import datetime, timedelta, timezone
from html import escape
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from publish_scheduled_queue import KST, SITE, validate_article, previous_release_is_live

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "data/scheduled-publication-ledger.jsonl"
SOURCE_ID = "bf74df89-89b9-4fa7-b89f-1dfe513162e9"
API = "https://api.notion.com/v1"


def api(method, path, payload=None):
    token = os.environ.get("NOTION_API_TOKEN")
    if not token:
        raise RuntimeError("GitHub secret NOTION_API_TOKEN is missing")
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(API + path, data=data, method=method, headers={
        "Authorization": "Bearer " + token,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json",
    })
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def text_prop(prop):
    key = "title" if prop.get("type") == "title" else "rich_text"
    return "".join(p.get("plain_text", "") for p in prop.get(key, [])).strip()


def ready_rows():
    rows = []
    cursor = None
    while True:
        body = {
            "filter": {"property": "상태", "select": {"equals": "발행대기"}},
            "sorts": [{"property": "발행순서", "direction": "ascending"}],
            "page_size": 100,
        }
        if cursor:
            body["start_cursor"] = cursor
        response = api("POST", "/data_sources/" + SOURCE_ID + "/query", body)
        rows += response["results"]
        if not response.get("has_more"):
            return rows
        cursor = response["next_cursor"]


def get_blocks(page_id):
    rows = []
    cursor = None
    while True:
        url = "/blocks/" + page_id + "/children?page_size=100"
        if cursor:
            url += "&start_cursor=" + quote(cursor)
        response = api("GET", url)
        rows += response["results"]
        if not response.get("has_more"):
            return rows
        cursor = response["next_cursor"]


def to_html(page_id):
    rendered, sources, summary = [], [], ""
    active_list = None
    for block in get_blocks(page_id):
        kind = block["type"]
        if block.get("has_children"):
            raise ValueError("Nested blocks are not supported: " + kind)
        if kind == "divider":
            if active_list:
                rendered.append("</" + active_list + ">")
                active_list = None
            rendered.append("<hr>")
            continue
        if kind not in ("paragraph", "heading_1", "heading_2", "heading_3",
                        "bulleted_list_item", "numbered_list_item", "quote"):
            raise ValueError("Unsupported block (no silent content loss): " + kind)
        chunks = []
        for item in block[kind].get("rich_text", []):
            v = escape(item.get("plain_text", ""))
            annotations = item.get("annotations") or {}
            if annotations.get("bold"):
                v = "<strong>" + v + "</strong>"
            if annotations.get("italic"):
                v = "<em>" + v + "</em>"
            url = item.get("href")
            if url and urlparse(url).scheme == "https":
                sources.append(url)
                v = '<a href="' + escape(url, quote=True) + '" rel="noopener noreferrer">' + v + "</a>"
            chunks.append(v)
        val = "".join(chunks)
        if not val:
            continue
        if kind == "paragraph" and not summary:
            summary = re.sub(r"<[^>]+>", "", val)[:150]
        tag = {
            "paragraph": "p", "heading_1": "h2", "heading_2": "h2",
            "heading_3": "h3", "quote": "blockquote",
            "bulleted_list_item": "li", "numbered_list_item": "li",
        }[kind]
        desired_list = ("ul" if kind == "bulleted_list_item" else
                        "ol" if kind == "numbered_list_item" else None)
        if active_list != desired_list:
            if active_list:
                rendered.append("</" + active_list + ">")
            if desired_list:
                rendered.append("<" + desired_list + ">")
            active_list = desired_list
        rendered.append("<" + tag + ">" + val + "</" + tag + ">")
    if active_list:
        rendered.append("</" + active_list + ">")
    return "\n".join(rendered), list(dict.fromkeys(sources)), summary


def article(page):
    prop = page["properties"]
    title = text_prop(prop["제목"])
    category = (prop["카테고리"].get("select") or {}).get("name", "")
    slug = text_prop(prop["슬러그"])
    destination = "kor/report/" + category + "/" + slug + ".html"
    url = SITE + "/" + destination
    body, sources, summary = to_html(page["id"])
    doc = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width, initial-scale=1">'
           '<title>' + escape(title) + '</title>'
           '<meta name="description" content="' + escape(summary, quote=True) + '">'
           '<link rel="canonical" href="' + escape(url, quote=True) + '">'
           '<style>body{font-family:system-ui,"Noto Sans KR",sans-serif;line-height:1.8;color:#222;margin:0}'
           'main{max-width:780px;margin:auto;padding:30px 18px 80px}'
           'h1{line-height:1.4}h2{margin-top:2.3rem}h3{margin-top:1.7rem}'
           'a{color:#185b91;overflow-wrap:anywhere}li{margin:.35rem 0}'
           'blockquote{border-left:4px solid #ccd;padding-left:15px}</style>'
           '</head><body><main><nav><a href="/">EMFLS</a></nav><article>'
           '<h1>' + escape(title) + '</h1>' + body +
           '</article><footer>자료 확인일: ' + datetime.now(KST).strftime("%Y-%m-%d") +
           '</footer></main></body></html>')
    draft = {"title": title, "destination": destination, "html": doc, "sources": sources}
    validate_article(draft, ROOT)
    return draft, url


def ledger_rows():
    if not LEDGER.exists():
        return []
    return [json.loads(line) for line in LEDGER.read_text(encoding="utf-8").splitlines() if line.strip()]


def live(url, title):
    try:
        with urlopen(Request(url + "?notion-check=1", headers={"Cache-Control": "no-cache"}), timeout=15) as r:
            return r.status == 200 and escape(title) in r.read().decode("utf-8", errors="replace")
    except (OSError, TimeoutError):
        return False


def finalize(page_id, url):
    if not url.startswith(SITE + "/kor/report/"):
        raise ValueError("Unexpected public URL")
    api("PATCH", "/pages/" + page_id, {"properties": {
        "상태": {"select": {"name": "발행완료"}},
        "게시 URL": {"url": url},
        "발행일시": {"date": {"start": datetime.now(timezone.utc).isoformat(timespec="seconds")}},
    }})
    return {"status": "NOTION_COMPLETED", "url": url}


def stage():
    if not os.environ.get("NOTION_API_TOKEN"):
        return {"status": "NEEDS_NOTION_API_TOKEN"}
    if not previous_release_is_live(ROOT):
        raise RuntimeError("Previous publication has not been confirmed live")
    history = ledger_rows()
    ready = ready_rows()
    for row in ready:
        entry = next((r for r in reversed(history) if r.get("notionPageId") == row["id"]), None)
        if entry:
            if not live(entry["url"], entry["title"]):
                raise RuntimeError("A previously staged Notion article is still not live")
            finalize(row["id"], entry["url"])
            return {"status": "RECONCILED", "url": entry["url"]}
    last = next((r for r in reversed(history) if r.get("notionPageId")), None)
    now = datetime.now(KST)
    # One-time operator-requested new publishing anchor, strictly limited to the
    # known first queued page. Normal scheduled and manual runs never bypass cooldown.
    initial_page = os.environ.get("NOTION_INITIAL_PAGE_ID", "").strip()
    if initial_page and (not ready or ready[0]["id"] != initial_page):
        return {"status": "INITIAL_PAGE_ALREADY_CONSUMED"}
    if not initial_page and last and now - datetime.fromisoformat(last["slotKst"]).astimezone(KST) < timedelta(hours=2):
        return {"status": "COOLDOWN"}
    if not ready:
        return {"status": "QUEUE_EMPTY"}
    page = ready[0]
    draft, url = article(page)
    dest = ROOT / draft["destination"]
    sitemap = dest.parent / "sitemap.xml"
    if not sitemap.is_file():
        raise RuntimeError("Category sitemap not found")
    old = sitemap.read_text(encoding="utf-8")
    if "</urlset>" not in old or url in old:
        raise RuntimeError("Category sitemap missing terminator or URL is duplicated")
    element = ("  <url>\n    <loc>" + escape(url) + "</loc>\n"
               "    <lastmod>" + now.strftime("%Y-%m-%d") + "</lastmod>\n  </url>\n")
    dest.write_text(draft["html"], encoding="utf-8")
    sitemap.write_text(old.replace("</urlset>", element + "</urlset>"), encoding="utf-8")
    with LEDGER.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"notionPageId": page["id"], "url": url,
                            "title": draft["title"], "slotKst": now.isoformat(),
                            "phase": "SOURCE_STAGED_NOT_YET_LIVE"}, ensure_ascii=False) + "\n")
    return {"status": "SOURCE_STAGED", "destination": draft["destination"],
            "url": url, "page_id": page["id"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("stage", "finalize"))
    parser.add_argument("--page-id")
    parser.add_argument("--url")
    args = parser.parse_args()
    try:
        result = finalize(args.page_id, args.url) if args.command == "finalize" else stage()
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print("Notion publisher failed: " + str(e), file=sys.stderr)
        sys.exit(1)
