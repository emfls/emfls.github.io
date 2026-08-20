#!/usr/bin/env python3
"""Inventory finance content and rank pages that need human fact review."""

import argparse
import json
import re
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path


FINANCE_PATHS = ("kor/report/finance/", "kor/report/stock/", "kor/stockwiki/", "stockwiki/")
KOREAN_FINANCE_TERMS = (
    "주식", "배당", "세금", "양도소득", "금융소득", "연금", "대출", "보험",
    "신용카드", "환율", "복리", "리밸런싱",
)
LATIN_FINANCE_RE = re.compile(r"(?<![a-z0-9])(?:etf|isa|cagr|fire)(?![a-z0-9])", re.I)
YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")
AMOUNT_RE = re.compile(r"\d[\d,]*(?:\.\d+)?\s*(?:원|만원|억원|달러|USD|KRW)", re.I)
PERCENT_RE = re.compile(r"\d+(?:\.\d+)?\s*%")
TICKER_RE = re.compile(r"\b[A-Z]{2,5}\b")


class _VisibleTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hidden_depth = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() in {"script", "style", "noscript", "template"}:
            self.hidden_depth += 1

    def handle_endtag(self, tag):
        if tag.lower() in {"script", "style", "noscript", "template"} and self.hidden_depth:
            self.hidden_depth -= 1

    def handle_data(self, data):
        if not self.hidden_depth:
            self.parts.append(data)


def _visible_text(html):
    parser = _VisibleTextParser()
    parser.feed(html)
    parser.close()
    return " ".join(parser.parts)


def _is_finance_page(page):
    path = str(page.get("path") or "").lower()
    title = str(page.get("title") or "").lower()
    return (
        path.startswith(FINANCE_PATHS)
        or any(term in title for term in KOREAN_FINANCE_TERMS)
        or bool(LATIN_FINANCE_RE.search(title))
    )


def _intent_key(title):
    value = YEAR_RE.sub("", str(title or "").split("|")[0]).lower()
    return re.sub(r"[^0-9a-z가-힣]", "", value)


def _metadata_by_url(metadata):
    return {str(item.get("url")): item for item in metadata if item.get("url")}


def audit_finance_content(audit, metadata, html_by_url):
    meta_by_url = _metadata_by_url(metadata)
    selected = [
        page for page in audit.get("pages", [])
        if page.get("indexable", True) and _is_finance_page(page)
    ]
    intent_urls = defaultdict(list)
    for page in selected:
        key = _intent_key(page.get("title"))
        if key:
            intent_urls[key].append(page["url"])
    duplicate_keys = {key for key, urls in intent_urls.items() if len(urls) > 1}

    pages = []
    for page in selected:
        url = page["url"]
        meta = meta_by_url.get(url, {})
        text = _visible_text(html_by_url.get(url, ""))
        signals = []
        if not meta.get("sources"):
            signals.append("missing_curated_sources")
        if not meta.get("last_verified"):
            signals.append("missing_last_verified")
        if AMOUNT_RE.search(text):
            signals.append("contains_amount")
        if PERCENT_RE.search(text):
            signals.append("contains_percentage")
        if TICKER_RE.search(text):
            signals.append("contains_ticker")
        key = _intent_key(page.get("title"))
        if key in duplicate_keys:
            signals.append("duplicate_search_intent")

        weights = {
            "missing_curated_sources": 25,
            "missing_last_verified": 20,
            "contains_amount": 10,
            "contains_percentage": 10,
            "contains_ticker": 8,
            "duplicate_search_intent": 15,
        }
        opportunity = float(meta.get("opportunity_score") or 0)
        priority = round(sum(weights[item] for item in signals) + min(opportunity, 20), 2)
        pages.append({
            "url": url,
            "title": page.get("title", ""),
            "path": page.get("path", ""),
            "word_count": page.get("word_count", 0),
            "external_links": page.get("external_links", 0),
            "opportunity_score": opportunity,
            "priority_score": priority,
            "review_signals": signals,
        })

    pages.sort(key=lambda item: (-item["priority_score"], item["url"]))
    duplicate_intents = [
        {"intent_key": key, "urls": sorted(urls), "count": len(urls)}
        for key, urls in intent_urls.items() if len(urls) > 1
    ]
    duplicate_intents.sort(key=lambda item: (-item["count"], item["intent_key"]))
    return {
        "summary": {
            "finance_pages": len(pages),
            "duplicate_intent_groups": len(duplicate_intents),
            "missing_curated_sources": sum("missing_curated_sources" in p["review_signals"] for p in pages),
            "missing_last_verified": sum("missing_last_verified" in p["review_signals"] for p in pages),
            "numeric_review_candidates": sum(any(s in p["review_signals"] for s in ("contains_amount", "contains_percentage")) for p in pages),
        },
        "duplicate_intents": duplicate_intents,
        "pages": pages,
        "method_notes": [
            "Review signals identify facts that need verification; they do not assert that content is wrong.",
            "Duplicate intent uses normalized titles and is a manual consolidation candidate only.",
            "No page is edited, redirected, deleted, or noindexed by this audit.",
        ],
    }


def _html_by_url(root, pages):
    result = {}
    for page in pages:
        if not _is_finance_page(page):
            continue
        path = root / page["path"]
        try:
            result[page["url"]] = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            result[page["url"]] = ""
    return result


def render_markdown(result, limit=200):
    summary = result["summary"]
    lines = [
        "# Finance Content Audit", "",
        "금융 수치가 틀렸다고 판정하는 보고서가 아니라, 공식 출처로 사람이 재검증할 순서를 정하는 보고서입니다.", "",
        f"- Finance pages: {summary['finance_pages']:,}",
        f"- Duplicate intent groups: {summary['duplicate_intent_groups']:,}",
        f"- Missing curated sources: {summary['missing_curated_sources']:,}",
        f"- Missing last verified date: {summary['missing_last_verified']:,}",
        f"- Numeric review candidates: {summary['numeric_review_candidates']:,}", "",
        "## Priority review queue", "",
    ]
    for index, page in enumerate(result["pages"][:limit], 1):
        signals = ", ".join(page["review_signals"]) or "no automated signal"
        lines.append(f"{index}. `{page['url']}` — {page['priority_score']:.2f}; {signals}")
    lines.extend(("", "## Duplicate search-intent candidates", ""))
    for group in result["duplicate_intents"][:100]:
        lines.append(f"- `{group['intent_key']}` — " + ", ".join(f"`{url}`" for url in group["urls"]))
    lines.extend(("", "## Method safeguards", ""))
    lines.extend(f"- {note}" for note in result["method_notes"])
    return "\n".join(lines).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, nargs="?", default=Path("."))
    parser.add_argument("--audit", type=Path, default=Path("data/site-audit.json"))
    parser.add_argument("--metadata", type=Path, default=Path("data/content-metadata.json"))
    parser.add_argument("--json", type=Path, default=Path("data/finance-content-audit.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/finance-content-audit.md"))
    args = parser.parse_args()

    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
    result = audit_finance_content(audit, metadata, _html_by_url(args.root.resolve(), audit.get("pages", [])))
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.report.write_text(render_markdown(result), encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
