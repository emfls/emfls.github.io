#!/usr/bin/env python3
"""Validate the generated URL-performance artifact before it is consumed."""

import argparse
import json
from datetime import date
from pathlib import Path

try:
    from scripts.quality_site import normalize_url
except ModuleNotFoundError:
    from quality_site import normalize_url

try:
    from scripts.revenue_opportunity import ALLOWED_STATUSES
except ModuleNotFoundError:
    from revenue_opportunity import ALLOWED_STATUSES


REQUIRED_KEYS = {"schemaVersion", "asOf", "summary", "pages"}
GA4_MAX_AGE_DAYS = 7
ALLOWED_CLASSIFICATIONS = {"WINNER", "OPPORTUNITY", "EXPERIMENT", "DEAD_CANDIDATE"}
REQUIRED_CHANNEL_FIELDS = {
    "ga4": {"status", "period", "source", "views", "users", "engagementSeconds", "revenue", "revenueMetric"},
    "google": {"status", "period", "source", "clicks", "impressions", "ctr", "position"},
    "naver": {"status", "period", "source", "clicks", "impressions", "ctr", "position"},
    "adsense": {"status", "period", "source", "revenue", "rpm", "revenueMetric", "coverageStatus"},
}
UNCONNECTED_CHANNEL_METRICS = {
    "ga4": ("views", "users", "engagementSeconds", "revenue"),
    "google": ("clicks", "impressions", "ctr", "position"),
    "naver": ("clicks", "impressions", "ctr", "position"),
    "adsense": ("revenue", "rpm"),
}


def _validate_ga4_freshness(page, as_of):
    ga4 = page.get("ga4") or {}
    period = ga4.get("period") or {}
    end = period.get("end")
    if not end or ga4.get("status") == "NOT_CONNECTED":
        return
    try:
        age = (date.fromisoformat(as_of) - date.fromisoformat(end)).days
    except (TypeError, ValueError) as exc:
        raise ValueError(f"invalid GA4 period for {page.get('url')}: {end!r}") from exc
    if age > GA4_MAX_AGE_DAYS and ga4.get("status") == "VERIFIED":
        raise ValueError(
            f"GA4 freshness contract violated for {page.get('url')}: "
            f"period ended {end}, asOf {as_of}, age {age}d; use STALE_DATA"
        )


def _normalized_url_set(rows, source):
    urls = set()
    for row in rows:
        url = row.get("url") if isinstance(row, dict) else None
        if not isinstance(url, str) or not url.strip():
            raise ValueError(f"{source} contains a page without a URL")
        normalized = normalize_url(url)
        if normalized in urls:
            raise ValueError(f"{source} contains a duplicate normalized URL: {normalized}")
        urls.add(normalized)
    return urls


def _validate_inventory_coverage(pages, page_scores_path, as_of):
    inventory = json.loads(page_scores_path.read_text(encoding="utf-8"))
    inventory_pages = inventory.get("pages")
    if not isinstance(inventory_pages, list):
        raise ValueError("page-score inventory pages must be a list")
    expected_count = (inventory.get("summary") or {}).get("evaluated_indexable_pages")
    if expected_count != len(inventory_pages):
        raise ValueError("page-score inventory count does not match pages")
    if inventory.get("as_of") != as_of:
        raise ValueError(
            f"page-score inventory asOf {inventory.get('as_of')!r} does not match "
            f"page-performance asOf {as_of!r}"
        )

    expected_urls = _normalized_url_set(inventory_pages, "page-score inventory")
    actual_urls = _normalized_url_set(pages, "page-performance")
    missing = sorted(expected_urls - actual_urls)
    unexpected = sorted(actual_urls - expected_urls)
    if missing:
        raise ValueError(
            "missing current indexable URL(s) from page-performance: "
            + ", ".join(missing[:10])
        )
    if unexpected:
        raise ValueError(
            "unexpected page-performance URL(s) outside current indexable inventory: "
            + ", ".join(unexpected[:10])
        )


def _validate_unconnected_channels(page):
    for channel_name, metric_names in UNCONNECTED_CHANNEL_METRICS.items():
        channel = page.get(channel_name)
        if channel["status"] != "NOT_CONNECTED":
            continue
        populated = [name for name in metric_names if channel.get(name) is not None]
        if populated:
            raise ValueError(
                f"NOT_CONNECTED {channel_name} metrics must be null: "
                + ", ".join(populated)
            )


def _validate_page_shape(page):
    if not isinstance(page, dict):
        raise ValueError("page-performance page rows must be objects")
    if not isinstance(page.get("url"), str) or not page["url"].strip():
        raise ValueError("page-performance contains a page without a URL")
    if "classification" not in page:
        raise ValueError(f"page-performance page is missing classification: {page['url']}")
    classification = page["classification"]
    if classification is not None and (
        not isinstance(classification, str) or classification not in ALLOWED_CLASSIFICATIONS
    ):
        raise ValueError(
            f"page-performance has an unsupported classification for {page['url']}: {classification!r}"
        )

    for channel_name, required_fields in REQUIRED_CHANNEL_FIELDS.items():
        channel = page.get(channel_name)
        if not isinstance(channel, dict):
            raise ValueError(f"page-performance {channel_name} channel must be an object for {page['url']}")
        missing = required_fields - set(channel)
        if missing:
            raise ValueError(
                f"page-performance {channel_name} channel is missing required field(s) for {page['url']}: "
                + ", ".join(sorted(missing))
            )
        status = channel["status"]
        if not isinstance(status, str) or status not in ALLOWED_STATUSES:
            raise ValueError(
                f"page-performance {channel_name} channel has unsupported status for {page['url']}: {status!r}"
            )
        period = channel["period"]
        if period is not None and not isinstance(period, dict):
            raise ValueError(f"page-performance {channel_name} period must be null or an object for {page['url']}")


def validate(path: Path, *, page_scores_path: Path, minimum_pages: int = 1):
    payload = json.loads(path.read_text(encoding="utf-8"))
    missing = REQUIRED_KEYS - set(payload)
    if missing:
        raise ValueError(f"missing keys: {', '.join(sorted(missing))}")
    pages = payload.get("pages")
    if not isinstance(pages, list) or len(pages) < minimum_pages:
        raise ValueError(f"expected at least {minimum_pages} generated pages, got {len(pages) if isinstance(pages, list) else 'non-list'}")
    if not payload.get("asOf"):
        raise ValueError("asOf is empty")
    if payload.get("summary", {}).get("evaluatedIndexablePages") != len(pages):
        raise ValueError("summary page count does not match pages")
    for page in pages:
        _validate_page_shape(page)
    _validate_inventory_coverage(pages, page_scores_path, payload["asOf"])
    for page in pages:
        _validate_ga4_freshness(page, payload["asOf"])
        _validate_unconnected_channels(page)
    return {"pages": len(pages), "asOf": payload["asOf"]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    parser.add_argument("--page-scores", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(validate(args.path, page_scores_path=args.page_scores), ensure_ascii=False))


if __name__ == "__main__":
    main()
