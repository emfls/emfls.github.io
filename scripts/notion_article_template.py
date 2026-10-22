#!/usr/bin/env python3
"""Single, source-controlled site template for Notion-published Korean guides."""
from __future__ import annotations

from datetime import date
from html import escape, unescape
import json
from pathlib import Path
import re

TEMPLATE = Path(__file__).resolve().parent / "templates" / "notion_article.html"

CATEGORY_LABELS = {
    "ai": "AI · 기술", "car": "자동차", "compare": "구매 비교",
    "daiso": "다이소", "gov": "정부 정책·혜택", "it": "IT · 기기",
    "parenting": "육아", "seasonal": "시즌·생활정보", "travel": "여행",
    "costco": "코스트코", "gift": "선물", "fashion": "패션",
    "camp": "캠핑", "fitness": "운동·건강", "animal": "반려동물",
}

HEADING = re.compile(r"(<h2(?:\s+[^>]*)?>.*?</h2>)", flags=re.I | re.S)
TAG = re.compile(r"<[^>]*>")


def article_sections(body: str) -> tuple[str, str]:
    """Keep original section order/wording while building navigable cards."""
    body = re.sub(r"</ul>\s*<ul>", "", body)
    body = re.sub(r"</ol>\s*<ol>", "", body)
    pieces = HEADING.split(body)
    cards: list[str] = []
    toc: list[str] = []
    lead = pieces[0].strip()
    if lead:
        cards.append('<div class="intro">' + lead + '</div>')
    for pos in range(1, len(pieces), 2):
        head = pieces[pos]
        following = pieces[pos + 1].strip() if pos + 1 < len(pieces) else ""
        sid = f"section-{(pos + 1)//2:02d}"
        label = unescape(TAG.sub("", head)).strip()
        if not label:
            raise ValueError("Article heading has no text")
        safe_head = re.sub(r"<h2(?:\s+[^>]*)?>",
                           '<h2 id="' + sid + '">',
                           head, count=1, flags=re.I)
        cards.append('<section class="section" aria-labelledby="' + sid + '">' +
                     safe_head + following + '</section>')
        toc.append('<li><a href="#' + sid + '">' + escape(label) + '</a></li>')
    if not toc:
        raise ValueError("Cannot publish an article without h2 sections")
    return "\n".join(cards), "<ol>" + "".join(toc) + "</ol>"


def render_article(
    *, title: str, description: str, url: str, category: str,
    body: str, published_date: str, modified_date: str | None = None,
    highlights: list[tuple[str, str]] | None = None,
) -> str:
    if category not in CATEGORY_LABELS:
        raise ValueError("Unsupported article category: " + category)
    if not url.startswith("https://emfls.github.io/kor/report/"):
        raise ValueError("Unexpected article canonical")
    # Avoid silently introducing a changing publication date into JSON-LD.
    date.fromisoformat(published_date)
    modified_date = modified_date or published_date
    date.fromisoformat(modified_date)
    cards, toc = article_sections(body)
    ld = {
        "@context": "https://schema.org", "@type": "Article",
        "headline": title, "description": description,
        "url": url, "mainEntityOfPage": url, "inLanguage": "ko",
        "author": {"@type": "Organization", "name": "emfls"},
        "publisher": {"@type": "Organization", "name": "emfls", "url": "https://emfls.github.io"},
        "datePublished": published_date, "dateModified": modified_date,
    }
    structured = json.dumps(ld, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    highlight_html = ""
    if highlights:
        if len(highlights) > 3:
            raise ValueError("At most three hero highlights allowed")
        highlight_html = '<div class="highlight-row" aria-label="핵심 정보">' + "".join(
            '<div class="highlight"><span class="value">' + escape(value) +
            '</span><span class="label">' + escape(label) + '</span></div>'
            for value, label in highlights
        ) + "</div>"
    replacements = {
        "{{TITLE}}": escape(title),
        "{{DESCRIPTION}}": escape(description[:165], quote=True),
        "{{CANONICAL}}": escape(url, quote=True),
        "{{CATEGORY_HREF}}": "/kor/report/" + category + "/",
        "{{CATEGORY_LABEL}}": escape(CATEGORY_LABELS[category]),
        "{{PUBLISHED_DATE}}": escape(published_date),
        "{{MODIFIED_DATE}}": escape(modified_date),
        "{{YEAR}}": published_date[:4],
        "{{STRUCTURED_DATA}}": structured,
        "{{HIGHLIGHTS}}": highlight_html,
        "{{TABLE_OF_CONTENTS}}": toc,
        "{{ARTICLE_SECTIONS}}": cards,
    }
    content = TEMPLATE.read_text(encoding="utf-8")
    for token, value in replacements.items():
        if token not in content:
            raise ValueError("Missing template token: " + token)
        content = content.replace(token, value)
    if re.search(r"\{\{[A-Z_]+\}\}", content):
        raise ValueError("Unrendered article template token")
    if content.count("G-QP5Q67GE5B") != 2:
        raise ValueError("Unexpected GA4 snippet")
    if content.count("ca-pub-8830524482034754") != 1:
        raise ValueError("Unexpected AdSense snippet")
    return content
