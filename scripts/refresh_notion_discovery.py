#!/usr/bin/env python3
"""Make each published Notion guide discoverable through static HTML links.

Runs on the staged article before the protected-main publishing PR is created.
Does not change the publication cadence, Notion status, or article topics.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from email.utils import format_datetime
from html import escape, unescape
from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "data/scheduled-publication-ledger.jsonl"
SITE = "https://emfls.github.io"
BEGIN = "<!-- notion-discovery:start -->"
END = "<!-- notion-discovery:end -->"
ROUTE = re.compile(r"^kor/report/([a-z0-9-]+)/([a-z0-9-]+)\.html$")
WORDS = re.compile(r"[가-힣A-Za-z0-9]{2,}")
STOP = {"2026", "2027", "방법", "해결", "설정", "안내", "정리", "가이드", "확인", "총정리", "하기", "없음", "이유"}
LABELS = {
    "ai": "AI", "car": "자동차", "compare": "비교", "daiso": "다이소",
    "gov": "정부·생활", "it": "IT·디지털", "parenting": "육아",
    "seasonal": "시즌·생활", "travel": "여행", "costco": "코스트코",
    "gift": "선물", "fashion": "패션", "camp": "캠핑",
    "fitness": "운동", "animal": "반려동물",
}


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def put(path: Path, body: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or read(path) != body:
        path.write_text(body, encoding="utf-8")


def title_from_page(path: Path) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", read(path), re.I | re.S)
    if not match:
        raise ValueError("Missing HTML title: " + str(path))
    return " ".join(unescape(re.sub(r"<[^>]+>", "", match.group(1))).split())


def get_entries() -> list[dict]:
    """Only link to real, already-staged HTML pages from the Notion ledger."""
    latest = {}
    for line in read(LEDGER).splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        if not item.get("notionPageId"):
            continue
        url = item.get("url", "")
        if not url.startswith(SITE + "/"):
            continue
        relative = url[len(SITE) + 1:]
        match = ROUTE.fullmatch(relative)
        if not match:
            continue
        path = ROOT / relative
        if not path.is_file():
            continue
        when = item.get("slotKst", "")
        try:
            published = datetime.fromisoformat(when)
            if published.tzinfo is None:
                continue
        except (ValueError, TypeError):
            continue
        latest[relative] = {
            "relative": relative,
            "url": "/" + relative,
            "category": match.group(1),
            "title": title_from_page(path),
            "published": published,
        }
    return sorted(latest.values(), key=lambda row: (row["published"], row["relative"]), reverse=True)


def marked_section(source: str, anchor: str, section: str) -> str:
    block = "\n" + BEGIN + "\n" + section + "\n" + END + "\n"
    if BEGIN in source or END in source:
        if source.count(BEGIN) != 1 or source.count(END) != 1:
            raise ValueError("Ambiguous discovery markers")
        start, stop = source.index(BEGIN), source.index(END) + len(END)
        return source[:start] + block.strip("\n") + source[stop:]
    if anchor not in source:
        raise ValueError("Could not locate static discovery insertion point")
    prefix, suffix = source.split(anchor, 1)
    # Some legacy category pages indent the insertion point on a blank line.
    # Avoid turning that indentation into a newly added trailing-space line.
    return prefix.rstrip(" \t") + block + anchor + suffix


def a(row: dict) -> str:
    return '<a href="' + escape(row["url"], quote=True) + '">' + escape(row["title"]) + "</a>"


def update_home(entries: list[dict]) -> None:
    path = ROOT / "index.html"
    rows = entries[:12]
    cards = "\n".join(
        '<a class="feed-card" href="' + escape(row["url"], quote=True) + '"><strong>' +
        escape(row["title"]) + '</strong><small>' + escape(LABELS.get(row["category"], row["category"])) +
        " · " + row["published"].date().isoformat() + "</small></a>"
        for row in rows
    )
    section = (
        '<section class="section" aria-labelledby="notion-newest-title">'
        '<h2 id="notion-newest-title">새로 발행한 글</h2>'
        '<div class="feed-grid">' + cards + '</div>'
        '<p><a href="/kor/report/recent/">분야별 전체 발행 글 보기</a></p></section>'
    )
    put(path, marked_section(read(path), '    <section class="section"><h2>최신 콘텐츠', section))


def update_category(entries: list[dict], category: str) -> None:
    path = ROOT / "kor" / "report" / category / "index.html"
    if not path.is_file():
        raise ValueError("Category page does not exist: " + str(path))
    source = read(path)
    rows = [row for row in entries if row["category"] == category][:24]
    if not rows:
        return
    links = "\n".join("<li>" + a(row) + "</li>" for row in rows)
    section = (
        '<section aria-label="최근 발행 글" style="max-width:1100px;margin:24px auto;'
        'padding:20px;border:1px solid #7484a6;border-radius:12px">'
        '<h2 style="margin:0 0 12px;font-size:1.2rem">최근 발행 글</h2>'
        '<ul style="padding-left:22px;line-height:1.9">' + links + '</ul>'
        '<p><a href="/kor/report/recent/#category-' + escape(category) +
        '">이 분야의 이전 글도 보기</a></p></section>'
    )
    match = re.search(r'<div class="grid"(?:\s[^>]*)?>', source)
    if match:
        anchor = match.group(0)
    elif '<aside class="guide-note"' in source:
        # The travel hub is a bespoke <main> layout, not a generic card grid.
        anchor = '<aside class="guide-note"'
    elif BEGIN in source:
        anchor = ""
    else:
        raise ValueError("Category page discovery insertion point missing: " + str(path))
    put(path, marked_section(source, anchor, section))


def relevant(entries: list[dict], current: dict) -> list[dict]:
    def words(title: str) -> set[str]:
        return {w.lower() for w in WORDS.findall(title) if w.lower() not in STOP}
    base = words(current["title"])
    options = [row for row in entries if row["category"] == current["category"]
               and row["relative"] != current["relative"]]
    options.sort(key=lambda row: (len(base & words(row["title"])),
                                 row["published"], row["relative"]), reverse=True)
    return options[:4]


def update_article(entries: list[dict], current: dict) -> None:
    path = ROOT / current["relative"]
    rows = relevant(entries, current)
    if not rows:
        return
    section = (
        '<section class="section" aria-label="관련 글">'
        '<h2>함께 읽으면 좋은 같은 분야의 글</h2>'
        '<ul>' + "\n".join("<li>" + a(row) + "</li>" for row in rows) + '</ul>'
        '</section>'
    )
    put(path, marked_section(read(path), '<section class="info-bottom">', section))


def archive(entries: list[dict]) -> None:
    grouped = defaultdict(list)
    for row in entries:
        grouped[row["category"]].append(row)
    sections = []
    for category in sorted(grouped, key=lambda key: (LABELS.get(key, key), key)):
        links = "\n".join(
            '<li>' + a(row) + ' <time datetime="' + row["published"].date().isoformat() +
            '">' + row["published"].date().isoformat() + '</time></li>'
            for row in grouped[category]
        )
        sections.append(
            '<section id="category-' + escape(category) + '"><h2>' +
            escape(LABELS.get(category, category)) + ' (' + str(len(grouped[category])) +
            ')</h2><p><a href="/kor/report/' + escape(category) +
            '/">분야별 목록으로 이동</a></p><ul>' + links + '</ul></section>'
        )
    page = """<!doctype html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow"><title>분야별 발행 글 모음 | emfls</title>
<meta name="description" content="자동 발행된 여러 주제의 정보를 분야별로 모아 볼 수 있는 전체 목록입니다.">
<link rel="canonical" href="https://emfls.github.io/kor/report/recent/">
<style>body{max-width:980px;margin:auto;padding:24px;font:16px/1.7 system-ui,sans-serif;color:#e6edf3;background:#0d1117}
a{color:#80c4ff}section{margin:32px 0;padding:20px;border:1px solid #30363d;border-radius:12px}
li{margin:5px 0}time{color:#b5becb;font-size:.8rem}h1,h2{line-height:1.35}</style>
</head><body><nav><a href="/">홈</a> · <a href="/kor/report/">생활정보 전체</a></nav>
<h1>분야별 발행 글 모음</h1><p>주제에 관계없이 발행한 원고를 분야별로 찾아볼 수 있습니다.</p>
""" + "\n".join(sections) + "\n</body></html>\n"
    put(ROOT / "kor/report/recent/index.html", page)


def update_rss(current: dict) -> None:
    path = ROOT / "feed.xml"
    document = ET.parse(path)
    root = document.getroot()
    channel = root.find("channel")
    if channel is None:
        raise ValueError("RSS channel missing")
    for old in list(channel.findall("item")):
        if old.findtext("link") == SITE + current["url"]:
            channel.remove(old)
    item = ET.Element("item")
    for name, value in [
        ("title", current["title"]),
        ("link", SITE + current["url"]),
        ("guid", SITE + current["url"]),
        ("pubDate", format_datetime(current["published"])),
        ("description", current["title"]),
    ]:
        child = ET.SubElement(item, name)
        child.text = value
        if name == "guid":
            child.set("isPermaLink", "true")
    first_item = next((index for index, child in enumerate(channel) if child.tag == "item"), len(channel))
    channel.insert(first_item, item)
    dated = channel.find("lastBuildDate")
    if dated is None:
        dated = ET.Element("lastBuildDate")
        channel.insert(first_item, dated)
    dated.text = format_datetime(current["published"])
    for old in list(channel.findall("item"))[300:]:
        channel.remove(old)
    ET.indent(document, space="  ")
    content = ET.tostring(root, encoding="unicode", xml_declaration=True) + "\n"
    put(path, content)


def main() -> None:
    if len(sys.argv) != 2 or not ROUTE.fullmatch(sys.argv[1]):
        raise SystemExit("Usage: refresh_notion_discovery.py kor/report/CATEGORY/SLUG.html")
    entries = get_entries()
    current = next((row for row in entries if row["relative"] == sys.argv[1]), None)
    if not current:
        raise SystemExit("Staged article not found in Notion publication ledger")
    update_home(entries)
    update_category(entries, current["category"])
    update_article(entries, current)
    archive(entries)
    update_rss(current)
    print(json.dumps({"staged": current["url"], "notion_articles": len(entries),
                      "category": current["category"], "related": len(relevant(entries, current))},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
