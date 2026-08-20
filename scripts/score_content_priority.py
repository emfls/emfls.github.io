#!/usr/bin/env python3
"""Score content quality and rank measured SEO improvement opportunities."""

import argparse
import json
from datetime import datetime
from pathlib import Path


def _date(value):
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def quality_score(page, metadata, as_of):
    score = 0
    reasons = []
    for field, points in (("title", 5), ("description", 5), ("canonical", 5)):
        if page.get(field):
            score += points
        else:
            reasons.append(f"missing_{field}")
    if page.get("h1_count") == 1:
        score += 5
    else:
        reasons.append("h1_not_one")
    if page.get("structured_data_types"):
        score += 5
    else:
        reasons.append("missing_structured_data")
    if page.get("indexable", True):
        score += 5
    else:
        reasons.append("not_indexable")

    words = page.get("word_count", 0)
    if words >= 1500:
        score += 20
    elif words >= 800:
        score += 14
        reasons.append("content_depth_medium")
    elif words >= 400:
        score += 8
        reasons.append("content_depth_low")
    else:
        reasons.append("thin_content")

    if page.get("external_links", 0) > 0:
        score += 5
    else:
        reasons.append("no_external_reference")
    if metadata.get("sources"):
        score += 10
    else:
        reasons.append("missing_curated_sources")

    checked = _date(metadata.get("last_verified")) or _date(metadata.get("updated")) or _date(page.get("updated_date"))
    if checked:
        age = (datetime.strptime(as_of, "%Y-%m-%d").date() - checked).days
        if age <= 90:
            score += 15
        elif age <= 365:
            score += 10
            reasons.append("freshness_review_due_soon")
        else:
            score += 3
            reasons.append("stale_content")
    else:
        reasons.append("unknown_freshness")

    links = page.get("internal_links", 0)
    if links >= 6:
        score += 10
    elif links >= 3:
        score += 7
        reasons.append("internal_links_can_improve")
    elif links >= 1:
        score += 3
        reasons.append("few_internal_links")
    else:
        reasons.append("no_internal_links")

    if metadata.get("target_query") and metadata.get("topics"):
        score += 5
    else:
        reasons.append("incomplete_search_metadata")
    return {"score": min(score, 100), "reasons": reasons}


def _url_key(url):
    value = str(url).replace("/index.html", "/")
    return value.rstrip("/") or "/"


def rank_candidates(audit, metadata, performance, as_of):
    pages = {_url_key(page["url"]): page for page in audit["pages"]}
    metrics = {_url_key(row["url"]): row for row in performance["pages"]}
    max_opportunity = max((entry.get("opportunity_score", 0) for entry in metadata), default=1) or 1
    max_impressions = max((row.get("impressions") or 0 for row in metrics.values()), default=1) or 1
    ranked = []
    for entry in metadata:
        key = _url_key(entry["url"])
        if key not in pages:
            continue
        quality = quality_score(pages[key], entry, as_of)
        metric = metrics.get(key, {})
        opportunity = entry.get("opportunity_score", 0)
        impressions = metric.get("impressions") or 0
        priority = (
            opportunity / max_opportunity * 45
            + (100 - quality["score"]) / 100 * 35
            + impressions / max_impressions * 10
            + min(float(entry.get("content_value", 1)), 5) / 5 * 10
        )
        ranked.append({
            "url": entry["url"],
            "quality_score": quality["score"],
            "priority_score": round(priority, 2),
            "opportunity_score": opportunity,
            "impressions": impressions,
            "average_position": metric.get("average_position"),
            "reasons": quality["reasons"],
        })
    return sorted(ranked, key=lambda row: (-row["priority_score"], row["url"]))


def render_report(rows):
    lines = [
        "# Content Improvement Priorities", "",
        f"- Candidates scored: {len(rows):,}",
        "- Quality Score: technical SEO, depth, sources, freshness, internal links, and search metadata",
        "- Priority Score: 45% measured opportunity, 35% quality gap, 10% impressions, 10% content value", "",
        "## Priority order", "",
    ]
    for index, row in enumerate(rows, 1):
        reasons = ", ".join(row["reasons"][:4]) or "no major structural gap"
        lines.append(f"{index}. `{row['url']}` — priority {row['priority_score']:.2f}, quality {row['quality_score']}/100; {reasons}")
    lines.extend(("", "Scores rank human review work. They do not automatically publish, merge, delete, or noindex a page."))
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, default=Path("data/site-audit.json"))
    parser.add_argument("--metadata", type=Path, default=Path("data/content-metadata.json"))
    parser.add_argument("--performance", type=Path, default=Path("data/performance/2026-08-01.json"))
    parser.add_argument("--as-of", default="2026-08-20")
    parser.add_argument("--output", type=Path, default=Path("data/content-priority.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/content-priorities.md"))
    args = parser.parse_args()
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
    performance = json.loads(args.performance.read_text(encoding="utf-8"))
    rows = rank_candidates(audit, metadata, performance, args.as_of)
    args.output.write_text(json.dumps({"as_of": args.as_of, "pages": rows}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.report.write_text(render_report(rows), encoding="utf-8")
    print(json.dumps({"pages": len(rows), "top": rows[0]["url"] if rows else None}, ensure_ascii=False))


if __name__ == "__main__":
    main()
