#!/usr/bin/env python3
"""Publish one Notion database draft into this static GitHub Pages repository."""
import argparse
from datetime import datetime, timedelta, timezone
from html import escape, unescape
import json
import math
import os
from pathlib import Path
import re
import sys
import time
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from publish_scheduled_queue import KST, SITE, validate_article, previous_release_is_live
from notion_article_template import render_article

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
            break
        cursor = response["next_cursor"]
    # Enforce ordering across all pagination pages even if API pages arrive
    # with inconsistent sort order; never silently place missing-order first.
    def order_key(page):
        prop = (page.get("properties") or {}).get("발행순서") or {}
        value = prop.get("number")
        valid = (type(value) in (int, float) and
                 math.isfinite(value) and value > 0)
        return (0 if valid else 1, value if valid else 0, page["id"])
    rows.sort(key=order_key)
    if rows:
        first = rows[0]
        print("NOTION_QUEUE_FIRST: order=" +
              str(((first.get("properties") or {}).get("발행순서") or {}).get("number")) +
              " page=" + first["id"] + " pending=" + str(len(rows)), file=sys.stderr)
    return rows


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


def rich_text_to_html(items, sources):
    """Render text and links in either ordinary blocks or native table cells."""
    chunks = []
    for item in items:
        value = escape(item.get("plain_text", ""))
        annotations = item.get("annotations") or {}
        if annotations.get("bold"):
            value = "<strong>" + value + "</strong>"
        if annotations.get("italic"):
            value = "<em>" + value + "</em>"
        if annotations.get("strikethrough"):
            value = "<del>" + value + "</del>"
        href = item.get("href")
        if href and urlparse(href).scheme == "https":
            sources.append(href)
            value = '<a href="' + escape(href, quote=True) + '" rel="noopener noreferrer">' + value + "</a>"
        chunks.append(value)
    return "".join(chunks)


def render_table(block, sources):
    """Fetch table_row children and keep every Notion table cell in the output."""
    details = block.get("table") or {}
    width = details.get("table_width")
    rows = get_blocks(block["id"])
    if not rows:
        raise ValueError("Notion table has no rows: " + block["id"])
    rendered = ['<div class="details-table"><table>']
    has_header = bool(details.get("has_column_header"))
    row_headers = bool(details.get("has_row_header"))
    for index, row in enumerate(rows):
        if row.get("type") != "table_row" or row.get("has_children"):
            raise ValueError("Invalid nested Notion table row: " + str(row.get("type")))
        cells = (row.get("table_row") or {}).get("cells") or []
        if not cells or (width is not None and len(cells) != width):
            raise ValueError("Notion table row has missing or mismatched cells: " + block["id"])
        if index == 0:
            rendered.append("<thead>" if has_header else "<tbody>")
        if index == 1 and has_header:
            rendered.append("</thead><tbody>")
        rendered.append("<tr>")
        for cell_index, cell in enumerate(cells):
            is_col_header = has_header and index == 0
            is_row_header = row_headers and cell_index == 0 and not is_col_header
            tag = "th" if is_col_header or is_row_header else "td"
            scope = ' scope="col"' if is_col_header else (' scope="row"' if is_row_header else "")
            rendered.append("<" + tag + scope + ">" + rich_text_to_html(cell, sources) + "</" + tag + ">")
        rendered.append("</tr>")
    rendered.append("</tbody></table></div>")
    return "".join(rendered)


def render_nested_children(block_id, sources, depth=0):
    """Preserve indented Notion list blocks instead of dropping child text."""
    if depth >= 12:
        raise ValueError("Notion list nesting exceeds supported depth")
    children = get_blocks(block_id)
    if not children:
        raise ValueError("Notion nested block has no children: " + block_id)
    rendered, active_list = [], None
    for block in children:
        kind = block["type"]
        desired = ("ol" if kind == "numbered_list_item" else
                   "ul" if kind in ("bulleted_list_item", "to_do") else None)
        if active_list != desired:
            if active_list:
                rendered.append("</" + active_list + ">")
            if desired:
                rendered.append("<" + desired + ">")
            active_list = desired
        if kind in ("numbered_list_item", "bulleted_list_item", "to_do"):
            value = rich_text_to_html((block.get(kind) or {}).get("rich_text", []), sources)
            if kind == "to_do":
                value = ("☑ " if (block.get(kind) or {}).get("checked") else "☐ ") + value
            nested = (render_nested_children(block["id"], sources, depth + 1)
                      if block.get("has_children") else "")
            if not value and not nested:
                raise ValueError("Empty nested Notion list item")
            rendered.append("<li>" + value + nested + "</li>")
        elif kind == "paragraph" and not block.get("has_children"):
            value = rich_text_to_html((block.get(kind) or {}).get("rich_text", []), sources)
            rendered.append("<p>" + value + "</p>")
        else:
            raise ValueError("Unsupported nested Notion block (no content loss): " + kind)
    if active_list:
        rendered.append("</" + active_list + ">")
    return "".join(rendered)


def to_html(page_id):
    rendered, sources, summary = [], [], ""
    active_list = None
    for block in get_blocks(page_id):
        kind = block["type"]
        if kind == "table":
            if active_list:
                rendered.append("</" + active_list + ">")
                active_list = None
            rendered.append(render_table(block, sources))
            continue
        nested = ""
        if block.get("has_children"):
            if kind not in ("numbered_list_item", "bulleted_list_item", "to_do"):
                raise ValueError("Unsupported nested Notion block (no content loss): " + kind)
            nested = render_nested_children(block["id"], sources)
        if kind == "divider":
            if active_list:
                rendered.append("</" + active_list + ">")
                active_list = None
            rendered.append("<hr>")
            continue
        if kind == "code":
            # Code blocks must preserve literal text and newlines (including <,
            # >, and &), without interpreting rich-text markup as HTML.
            if active_list:
                rendered.append("</" + active_list + ">")
                active_list = None
            details = block.get("code") or {}
            code_text = "".join(item.get("plain_text", "") for item in details.get("rich_text", []))
            rendered.append('<pre class="notion-code"><code>' + escape(code_text) + "</code></pre>")
            caption = details.get("caption") or []
            if caption:
                rendered.append('<p class="notion-code-caption">' +
                                rich_text_to_html(caption, sources) + "</p>")
            continue
        if kind not in ("paragraph", "heading_1", "heading_2", "heading_3",
                        "bulleted_list_item", "numbered_list_item", "quote", "to_do"):
            raise ValueError("Unsupported block (no silent content loss): " + kind)
        val = rich_text_to_html((block.get(kind) or {}).get("rich_text", []), sources)
        if kind == "to_do":
            val = ("☑ " if (block.get("to_do") or {}).get("checked") else "☐ ") + val
        if not val and not nested:
            continue
        if kind == "paragraph" and not summary:
            summary = re.sub(r"<[^>]+>", "", val)[:150]
        tag = {
            "paragraph": "p", "heading_1": "h2", "heading_2": "h2",
            "heading_3": "h3", "quote": "blockquote",
            "bulleted_list_item": "li", "numbered_list_item": "li",
            "to_do": "li",
        }[kind]
        desired_list = ("ul" if kind in ("bulleted_list_item", "to_do") else
                        "ol" if kind == "numbered_list_item" else None)
        if active_list != desired_list:
            if active_list:
                rendered.append("</" + active_list + ">")
            if desired_list:
                rendered.append("<" + desired_list + ">")
            active_list = desired_list
        rendered.append("<" + tag + ">" + val + nested + "</" + tag + ">")
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
    doc = render_article(
        title=title, description=unescape(summary) or title, url=url,
        category=category, body=body, published_date=datetime.now(KST).date().isoformat(),
    )
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
        "오류": {"rich_text": []},
    }})
    # A successful PATCH is not sufficient evidence that the Notion fields
    # read back correctly. Keep the run failed if server-side state disagrees.
    published = api("GET", "/pages/" + page_id)
    props = published["properties"]
    saved_status = (props["상태"].get("select") or {}).get("name")
    saved_url = (props["게시 URL"].get("url") or "")
    published_at = (props["발행일시"].get("date") or {}).get("start")
    if saved_status != "발행완료" or saved_url != url or not published_at:
        raise RuntimeError("NOTION_STATUS_READBACK_MISMATCH: page=" + page_id +
                           " status=" + str(saved_status) +
                           " url_matches=" + str(saved_url == url) +
                           " timestamp_present=" + str(bool(published_at)))
    order = (props.get("발행순서") or {}).get("number")
    print("NOTION_STATUS_READBACK_PASS: order=" + str(order) +
          " page=" + page_id + " status=" + saved_status +
          " url=" + saved_url, file=sys.stderr)
    return {"status": "NOTION_COMPLETED", "url": url, "order": order}


def mark_failed(page_id, error):
    """Quarantine a content-invalid draft without touching the publishing ledger."""
    reason = (type(error).__name__ + ": " + str(error)).strip()[:1800]
    # The state and reason are written in one Notion PATCH. If the PATCH fails,
    # abort the entire run rather than repeatedly attempting the same draft.
    api("PATCH", "/pages/" + page_id, {"properties": {
        "상태": {"select": {"name": "발행실패"}},
        "오류": {"rich_text": [{"type": "text", "text": {"content": reason}}]},
    }})
    print("NOTION_DRAFT_FAILED: " + page_id + ": " + reason, file=sys.stderr)


def candidate_sitemap(draft, url):
    """Check draft-specific publishability before any repository writes."""
    dest = ROOT / draft["destination"]
    sitemap = dest.parent / "sitemap.xml"
    if not sitemap.is_file():
        raise ValueError("Category sitemap not found: " + str(sitemap.relative_to(ROOT)))
    old = sitemap.read_text(encoding="utf-8")
    if "</urlset>" not in old:
        raise ValueError("Category sitemap missing closing urlset: " + str(sitemap.relative_to(ROOT)))
    if url in old:
        raise ValueError("Category sitemap already contains draft URL: " + url)
    return dest, sitemap, old


def stage():
    if not os.environ.get("NOTION_API_TOKEN"):
        return {"status": "NEEDS_NOTION_API_TOKEN"}
    # Pages deployments can become readable shortly after the workflow starts.
    # Retry this guard without ever bypassing it: a missing previous page still
    # prevents all new publication after the bounded retry window.
    for attempt in range(9):
        if previous_release_is_live(ROOT):
            break
        if attempt == 8:
            raise RuntimeError("Previous publication has not been confirmed live after 120s")
        print("PAGES_PREVIOUS_NOT_LIVE: retrying in 15s (" +
              str(attempt + 1) + "/8)", file=sys.stderr)
        time.sleep(15)
    history = ledger_rows()
    ready = ready_rows()
    reconciled_ids = set()
    for row in ready:
        entry = next((r for r in reversed(history) if r.get("notionPageId") == row["id"]), None)
        if entry:
            if not live(entry["url"], entry["title"]):
                raise RuntimeError("A previously staged Notion article is still not live")
            finalize(row["id"], entry["url"])
            reconciled_ids.add(row["id"])
            print("NOTION_RECONCILED_ALREADY_LIVE: " + row["id"], file=sys.stderr)
    # Finalization of an already-live page must not waste the next available
    # 30-minute publication slot. Only still-pending rows can be staged.
    if reconciled_ids:
        ready = [row for row in ready if row["id"] not in reconciled_ids]
    last = next((r for r in reversed(history) if r.get("notionPageId")), None)
    now = datetime.now(KST)
    # One-time operator-requested new publishing anchor, strictly limited to the
    # known first queued page. Normal scheduled and manual runs never bypass cooldown.
    initial_page = os.environ.get("NOTION_INITIAL_PAGE_ID", "").strip()
    if initial_page and (not ready or ready[0]["id"] != initial_page):
        return {"status": "INITIAL_PAGE_ALREADY_CONSUMED"}
    if not initial_page and last and now - datetime.fromisoformat(last["slotKst"]).astimezone(KST) < timedelta(minutes=30):
        return {"status": "COOLDOWN"}
    if not ready:
        return {"status": "QUEUE_EMPTY"}
    failed_count = 0
    # On scheduled runs, try the next ready draft immediately if content is
    # invalid. The one-time initial-page override must not publish a different
    # page in the same special run.
    candidates = ready[:1] if initial_page else ready
    for page in candidates:
        queue_order = ((page.get("properties") or {}).get("발행순서") or {}).get("number")
        print("NOTION_QUEUE_ATTEMPT: order=" + str(queue_order) +
              " page=" + page["id"], file=sys.stderr)
        try:
            if (type(queue_order) not in (int, float) or
                    not math.isfinite(queue_order) or queue_order <= 0):
                raise ValueError("Invalid or missing 발행순서")
            draft, url = article(page)
            dest, sitemap, old = candidate_sitemap(draft, url)
        except (ValueError, RuntimeError) as exc:
            # Only deterministic draft validation/rendering errors are
            # quarantined. Notion HTTP/network failures, GitHub push/merge
            # failures, local I/O failures, and live-verification failures
            # still abort the run for safe retry, without mislabeling content.
            mark_failed(page["id"], exc)
            failed_count += 1
            continue
        element = ("  <url>\n    <loc>" + escape(url) + "</loc>\n"
                   "    <lastmod>" + now.strftime("%Y-%m-%d") + "</lastmod>\n  </url>\n")
        dest.write_text(draft["html"], encoding="utf-8")
        sitemap.write_text(old.replace("</urlset>", element + "</urlset>"), encoding="utf-8")
        with LEDGER.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"notionPageId": page["id"], "url": url,
                                "title": draft["title"], "slotKst": now.isoformat(),
                                "phase": "SOURCE_STAGED_NOT_YET_LIVE"}, ensure_ascii=False) + "\n")
        return {"status": "SOURCE_STAGED", "destination": draft["destination"],
                "url": url, "page_id": page["id"], "order": queue_order,
                "failed_count": failed_count}
    return {"status": "QUEUE_ALL_FAILED", "failed_count": failed_count}


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
