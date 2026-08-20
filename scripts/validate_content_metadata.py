#!/usr/bin/env python3
"""Build and validate sidecar metadata for performance-priority content."""

import argparse
import json
import re
import sys
from pathlib import Path


INTENTS = {"informational", "commercial", "transactional", "navigational"}
YMYL_TERMS = ("finance", "stock", "tax", "gov", "health", "insurance", "loan", "etf", "세금", "대출", "보험")


def _is_ymyl(page):
    text = f"{page.get('url', '')} {page.get('title', '')}".lower()
    return any(term in text for term in YMYL_TERMS)


def _topics(page):
    parts = [part for part in page["url"].strip("/").split("/") if part]
    return list(dict.fromkeys([page.get("category", "general")] + parts[-2:-1]))


def build_metadata(audit, performance):
    pages = {}
    for page in audit["pages"]:
        url = page["url"]
        pages[url] = page
        if url.endswith("/"):
            pages[url.rstrip("/")] = page
            pages[url + "index.html"] = page
    entries = {}
    for metric in performance["pages"]:
        if not metric.get("striking_distance") or metric["url"] not in pages:
            continue
        page = pages[metric["url"]]
        ymyl = _is_ymyl(page)
        entry = {
            "url": page["url"],
            "topics": _topics(page),
            "target_query": page.get("title", "").split("|")[0].strip(),
            "intent": "informational",
            "sources": [],
            "published": page.get("published_date", ""),
            "updated": page.get("updated_date", ""),
            "last_verified": "",
            "review_interval": 90 if ymyl else 180,
            "related": [],
            "content_value": 1.0,
            "ymyl": ymyl,
            "opportunity_score": metric.get("opportunity_score", 0),
        }
        existing = entries.get(page["url"])
        if not existing or entry["opportunity_score"] > existing["opportunity_score"]:
            entries[page["url"]] = entry
    return sorted(entries.values(), key=lambda entry: (-entry["opportunity_score"], entry["url"]))


def validate_metadata(entries, audit_urls):
    errors = []
    seen = set()
    required = {"url", "topics", "target_query", "intent", "sources", "published", "updated", "last_verified", "review_interval", "related", "content_value", "ymyl"}
    for entry in entries:
        url = entry.get("url", "")
        if url in seen:
            errors.append(f"duplicate_url:{url}")
        seen.add(url)
        if url not in audit_urls:
            errors.append(f"unknown_url:{url}")
        for field in sorted(required - set(entry)):
            errors.append(f"missing_field:{url}:{field}")
        if entry.get("intent") not in INTENTS:
            errors.append(f"invalid_intent:{url}")
        if not isinstance(entry.get("topics"), list) or not entry.get("topics"):
            errors.append(f"missing_topics:{url}")
        if entry.get("ymyl"):
            if not entry.get("sources"):
                errors.append(f"ymyl_missing_sources:{url}")
            if not entry.get("last_verified"):
                errors.append(f"ymyl_missing_last_verified:{url}")
        for source in entry.get("sources") or []:
            if not source.get("name") or not re.match(r"^https://", source.get("url", "")):
                errors.append(f"invalid_source:{url}")
    return sorted(set(errors))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, default=Path("data/site-audit.json"))
    parser.add_argument("--performance", type=Path, default=Path("data/performance/2026-08-01.json"))
    parser.add_argument("--metadata", type=Path, default=Path("data/content-metadata.json"))
    parser.add_argument("--generate", action="store_true")
    args = parser.parse_args()
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    if args.generate:
        performance = json.loads(args.performance.read_text(encoding="utf-8"))
        entries = build_metadata(audit, performance)
        args.metadata.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    else:
        entries = json.loads(args.metadata.read_text(encoding="utf-8"))
    errors = validate_metadata(entries, {page["url"] for page in audit["pages"]})
    print(json.dumps({"entries": len(entries), "ymyl": sum(entry.get("ymyl", False) for entry in entries), "errors": errors}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
