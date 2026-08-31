#!/usr/bin/env python3
"""Validate and match verified Naver Search Advisor URL snapshots."""

import json
from collections import Counter
from pathlib import Path

try:
    from scripts.quality_site import normalize_url
except ModuleNotFoundError:
    from quality_site import normalize_url


def normalize_naver_url(url):
    return normalize_url(url)


def load_naver_snapshot(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate_naver_row(row):
    errors = []
    source_url = str(row.get("sourceUrl") or "")
    if not source_url.startswith(("http://", "https://")):
        errors.append("INVALID_URL")
    clicks = row.get("clicks")
    impressions = row.get("impressions")
    ctr = row.get("ctr")
    if not isinstance(clicks, (int, float)) or clicks < 0:
        errors.append("INVALID_CLICKS")
    if not isinstance(impressions, (int, float)) or impressions < 0:
        errors.append("INVALID_IMPRESSIONS")
    if not isinstance(ctr, (int, float)) or ctr < 0:
        errors.append("INVALID_CTR")
    if errors:
        return errors
    if impressions == 0:
        if clicks != 0:
            errors.append("CLICKS_WITHOUT_IMPRESSIONS")
        if ctr != 0:
            errors.append("CTR_WITHOUT_IMPRESSIONS")
    else:
        visible_percent = round(clicks / impressions * 100, 1)
        if abs(ctr * 100 - visible_percent) > 0.1000001:
            errors.append("CTR_MISMATCH")
    if row.get("status") != "VERIFIED":
        errors.append("UNVERIFIED_ROW")
    if row.get("averageRank") is not None or row.get("rankStatus") != "NOT_AVAILABLE":
        errors.append("INVALID_RANK_STATE")
    return errors


def match_naver_rows(snapshot, site_urls, canonical_map=None):
    canonical_map = {
        normalize_url(source): normalize_url(target)
        for source, target in (canonical_map or {}).items()
    }
    inventory = {normalize_url(url) for url in site_urls}
    normalized_rows = []
    invalid_rows = []
    for index, row in enumerate(snapshot.get("rows") or []):
        errors = validate_naver_row(row)
        normalized = normalize_naver_url(row.get("sourceUrl"))
        normalized_rows.append((normalized, row))
        if errors:
            invalid_rows.append({"index": index, "url": normalized, "errors": errors})

    counts = Counter(url for url, _ in normalized_rows)
    duplicates = sorted(url for url, count in counts.items() if count > 1)
    matched = {}
    unmatched = []
    for normalized, row in normalized_rows:
        target = canonical_map.get(normalized, normalized)
        if normalized in duplicates:
            continue
        if target in inventory:
            matched[target] = {**row, "url": target}
        else:
            unmatched.append(normalized)

    unique_count = len(counts)
    match_rate = len(matched) / unique_count if unique_count else 0.0
    failures = []
    if not normalized_rows:
        failures.append("NO_ROWS")
    if match_rate < 0.95:
        failures.append("MATCH_RATE_BELOW_95_PERCENT")
    if invalid_rows:
        failures.append("INVALID_ROWS")
    if duplicates:
        failures.append("DUPLICATE_NORMALIZED_URLS")
    quality = {
        "rows": len(normalized_rows),
        "uniqueUrls": unique_count,
        "matched": len(matched),
        "matchRate": round(match_rate, 4),
        "unmatched": sorted(set(unmatched)),
        "duplicateNormalizedUrls": duplicates,
        "invalidRows": invalid_rows,
        "rankAvailability": "NOT_AVAILABLE",
        "periodStatus": "PERIOD_MISMATCH",
        "gatePassed": not failures,
        "gateFailures": failures,
    }
    return {"matchedByUrl": matched, "quality": quality}


def build_naver_quality_report(snapshot_path, site_urls, canonical_map=None):
    snapshot = load_naver_snapshot(snapshot_path)
    result = match_naver_rows(snapshot, site_urls, canonical_map=canonical_map)
    quality = result["quality"]
    limitations = snapshot.get("limitations") or []
    lines = [
        "# Naver URL Data Quality",
        "",
        f"- Source: {snapshot.get('source')}",
        f"- Period: {(snapshot.get('period') or {}).get('start')} ~ {(snapshot.get('period') or {}).get('end')}",
        f"- Rows: {quality['rows']}",
        f"- Unique URLs: {quality['uniqueUrls']}",
        f"- Matched: {quality['matched']}",
        f"- Match rate: {quality['matchRate']:.1%}",
        f"- Invalid rows: {len(quality['invalidRows'])}",
        f"- Duplicate normalized URLs: {len(quality['duplicateNormalizedUrls'])}",
        f"- Rank availability: {quality['rankAvailability']}",
        f"- Cross-source period: {quality['periodStatus']}",
        f"- Quality gate: {'PASS' if quality['gatePassed'] else 'FAIL'}",
        f"- Limitations: {', '.join(limitations) if limitations else 'NONE'}",
        "- TOP 30 밖 사이트 URL은 NOT_AVAILABLE이며 0으로 간주하지 않습니다.",
    ]
    if quality["unmatched"]:
        lines.extend(("", "## Unmatched", "", *(f"- `{url}`" for url in quality["unmatched"])))
    if quality["gateFailures"]:
        lines.extend(("", "## Gate Failures", "", *(f"- {item}" for item in quality["gateFailures"])))
    return result, "\n".join(lines).rstrip() + "\n"
