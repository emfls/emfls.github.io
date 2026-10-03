#!/usr/bin/env python3
"""Collect exact-period, per-URL GSC query evidence for current opportunities."""

import argparse
import base64
import json
import math
import os
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

try:
    from .collect_gsc_snapshot import PROPERTY_URL, SOURCE, normalize_url
except ImportError:
    from collect_gsc_snapshot import PROPERTY_URL, SOURCE, normalize_url


ROW_LIMIT = 25_000
LIMITATIONS = [
    "SEARCH_CONSOLE_TOP_ROWS_ONLY",
    "QUERY_PRIVACY_FILTERING_POSSIBLE",
    "QUERY_ROWS_ARE_NOT_COMPLETE_COVERAGE",
    "QUERY_ROWS_MAY_NOT_RECONCILE_TO_PAGE_TOTALS",
    "NOT_FOR_REVENUE_CLASSIFICATION",
]


def _load_json(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def _normalize_candidate_path(value):
    if not isinstance(value, str) or not value.startswith("/"):
        raise ValueError("opportunity URL must be a relative site path")
    if "?" in value or "#" in value:
        raise ValueError("opportunity URL must not contain a query or fragment")
    normalized = normalize_url(value)
    if normalized != value:
        raise ValueError("opportunity URL must already be normalized")
    return normalized


def current_opportunity_urls(page_performance, revenue_opportunities):
    """Read exhaustive classifications and fail closed against summary counts."""
    rows = page_performance.get("pages") if isinstance(page_performance, dict) else None
    counts = revenue_opportunities.get("classificationCounts") if isinstance(revenue_opportunities, dict) else None
    if not isinstance(rows, list) or not isinstance(counts, dict):
        raise ValueError("measurement artifacts are missing page inventory or classification counts")
    expected = counts.get("OPPORTUNITY")
    if isinstance(expected, bool) or not isinstance(expected, int) or expected < 0:
        raise ValueError("revenue opportunity summary has an invalid OPPORTUNITY count")
    urls = []
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or row.get("classification") != "OPPORTUNITY":
            continue
        url = _normalize_candidate_path(row.get("url"))
        if url in seen:
            raise ValueError(f"duplicate normalized opportunity URL: {url}")
        seen.add(url)
        urls.append(url)
    if len(urls) != expected:
        raise ValueError(
            f"page-performance OPPORTUNITY count {len(urls)} does not match revenue-opportunities summary {expected}"
        )
    return sorted(urls)


def get_snapshot_period(gsc_snapshot):
    if not isinstance(gsc_snapshot, dict) or gsc_snapshot.get("status") != "VERIFIED":
        raise ValueError("a VERIFIED GSC page snapshot is required")
    if gsc_snapshot.get("source") != SOURCE or gsc_snapshot.get("property") != PROPERTY_URL:
        raise ValueError("GSC snapshot source or property does not match the canonical property")
    start, end = gsc_snapshot.get("periodStart"), gsc_snapshot.get("periodEnd")
    try:
        parsed_start, parsed_end = date.fromisoformat(start), date.fromisoformat(end)
    except (TypeError, ValueError) as exc:
        raise ValueError("GSC snapshot has invalid period metadata") from exc
    if parsed_start > parsed_end:
        raise ValueError("GSC snapshot period start is after its end")
    return start, end


def _canonical_page_url(path, property_url):
    normalized = _normalize_candidate_path(path)
    expected = urlsplit(PROPERTY_URL)
    actual = urlsplit(property_url)
    if actual.scheme != "https" or actual.netloc.lower() != expected.netloc.lower() or actual.path != "/":
        raise ValueError("refusing a non-canonical Search Console property")
    return property_url.rstrip("/") + normalized if normalized != "/" else property_url


def collect_with_service(service, property_url, period_start, period_end, opportunity_urls, *, row_limit=ROW_LIMIT):
    if property_url != PROPERTY_URL:
        raise ValueError("refusing to query a non-canonical Search Console property")
    metadata = service.sites().get(siteUrl=PROPERTY_URL).execute()
    if not isinstance(metadata, dict) or metadata.get("siteUrl") != PROPERTY_URL:
        raise ValueError("Search Console API property mismatch")

    results = {}
    for path in opportunity_urls:
        page_url = _canonical_page_url(path, property_url)
        rows, start_row = [], 0
        while True:
            response = service.searchanalytics().query(
                siteUrl=PROPERTY_URL,
                body={
                    "startDate": period_start,
                    "endDate": period_end,
                    "dimensions": ["query"],
                    "aggregationType": "auto",
                    "dimensionFilterGroups": [{"filters": [{
                        "dimension": "page", "operator": "equals", "expression": page_url,
                    }]}],
                    "rowLimit": row_limit,
                    "startRow": start_row,
                },
            ).execute()
            page_rows = response.get("rows") or []
            rows.extend(page_rows)
            if len(page_rows) < row_limit:
                break
            start_row += row_limit
        results[path] = rows
    return results


def _metric_int(row, name):
    value = row.get(name)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"Search Console query row has invalid {name}")
    return value


def build_snapshot(opportunity_urls, query_rows_by_url, *, period_start, period_end, generated_at, property_url=PROPERTY_URL):
    start, end = date.fromisoformat(period_start), date.fromisoformat(period_end)
    if start > end:
        raise ValueError("period start is after period end")
    urls = [_normalize_candidate_path(url) for url in opportunity_urls]
    if len(set(urls)) != len(urls):
        raise ValueError("opportunity URL list contains duplicates")
    if set(query_rows_by_url) != set(urls):
        raise ValueError("query results must include exactly the current opportunity URLs")

    pages, total_query_rows = [], 0
    for url in sorted(urls):
        grouped = {}
        for row in query_rows_by_url[url]:
            keys = row.get("keys") if isinstance(row, dict) else None
            query = keys[0].strip() if isinstance(keys, list) and keys and isinstance(keys[0], str) else ""
            if not query:
                raise ValueError("Search Console query row is missing keys[0]")
            clicks, impressions = _metric_int(row, "clicks"), _metric_int(row, "impressions")
            position = row.get("position")
            if position is not None and (isinstance(position, bool) or not isinstance(position, (int, float)) or not math.isfinite(position) or position < 0):
                raise ValueError("Search Console query row has invalid position")
            bucket = grouped.setdefault(query, {"clicks": 0, "impressions": 0, "positions": []})
            bucket["clicks"] += clicks
            bucket["impressions"] += impressions
            if position is not None and impressions:
                bucket["positions"].append((float(position), impressions))

        queries = []
        for query, values in grouped.items():
            impressions = values["impressions"]
            clicks = values["clicks"]
            positions = values["positions"]
            queries.append({
                "query": query,
                "clicks": clicks,
                "impressions": impressions,
                "ctr": clicks / impressions if impressions else None,
                "position": round(sum(pos * weight for pos, weight in positions) / sum(weight for _, weight in positions), 2) if positions else None,
            })
        queries.sort(key=lambda row: (-row["impressions"], -row["clicks"], row["query"]))
        total_query_rows += len(queries)
        pages.append({
            "url": url,
            "queries": queries,
            "queryCount": len(queries),
            "status": "PARTIAL_QUERY_EVIDENCE" if queries else "NO_QUERY_ROWS_RETURNED",
        })

    return {
        "status": "VERIFIED",
        "source": SOURCE,
        "property": property_url,
        "periodStart": start.isoformat(),
        "periodEnd": end.isoformat(),
        "generatedAt": generated_at,
        "limitations": LIMITATIONS,
        "pages": pages,
        "summary": {"opportunityUrls": len(pages), "urlsWithQueryRows": sum(bool(page["queries"]) for page in pages), "urlsWithoutQueryRows": sum(not page["queries"] for page in pages), "queryRows": total_query_rows},
    }


def validate_snapshot(payload):
    if payload.get("status") != "VERIFIED" or payload.get("source") != SOURCE or payload.get("property") != PROPERTY_URL:
        raise ValueError("opportunity query artifact source contract is invalid")
    start, end = date.fromisoformat(payload["periodStart"]), date.fromisoformat(payload["periodEnd"])
    if start > end:
        raise ValueError("opportunity query artifact period is invalid")
    generated_at = datetime.fromisoformat(payload["generatedAt"].replace("Z", "+00:00"))
    if generated_at.tzinfo is None:
        raise ValueError("opportunity query artifact generatedAt must include timezone")
    limitations = payload.get("limitations")
    if not isinstance(limitations, list) or not set(LIMITATIONS).issubset(limitations):
        raise ValueError("opportunity query artifact limitations are incomplete")
    pages = payload.get("pages")
    if not isinstance(pages, list) or not pages:
        raise ValueError("opportunity query artifact must retain the current URL inventory")
    seen, row_count = set(), 0
    for page in pages:
        url = _normalize_candidate_path(page.get("url"))
        if url in seen:
            raise ValueError("opportunity query artifact has duplicate URLs")
        seen.add(url)
        queries = page.get("queries")
        if not isinstance(queries, list) or page.get("queryCount") != len(queries):
            raise ValueError("opportunity query artifact query count is inconsistent")
        expected_status = "PARTIAL_QUERY_EVIDENCE" if queries else "NO_QUERY_ROWS_RETURNED"
        if page.get("status") != expected_status:
            raise ValueError("opportunity query artifact page status is inconsistent")
        seen_queries = set()
        for query in queries:
            text = query.get("query")
            if not isinstance(text, str) or not text.strip() or text in seen_queries:
                raise ValueError("opportunity query artifact has invalid or duplicate query text")
            seen_queries.add(text)
            clicks, impressions = _metric_int(query, "clicks"), _metric_int(query, "impressions")
            expected_ctr = clicks / impressions if impressions else None
            if query.get("ctr") != expected_ctr:
                raise ValueError("opportunity query artifact CTR is inconsistent")
            position = query.get("position")
            if position is not None and (isinstance(position, bool) or not isinstance(position, (int, float)) or not math.isfinite(position) or position < 0):
                raise ValueError("opportunity query artifact has invalid position")
            row_count += 1
    summary = payload.get("summary")
    expected_summary = {
        "opportunityUrls": len(pages),
        "urlsWithQueryRows": sum(bool(page["queries"]) for page in pages),
        "urlsWithoutQueryRows": sum(not page["queries"] for page in pages),
        "queryRows": row_count,
    }
    if summary != expected_summary:
        raise ValueError("opportunity query artifact summary is inconsistent")
    return expected_summary | {"period": {"start": start.isoformat(), "end": end.isoformat()}}


def write_atomically(path, payload):
    validate_snapshot(payload)
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target.parent, delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        temporary.replace(target)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def run_collection(service, property_url, period_start, period_end, opportunity_urls, output, *, generated_at):
    rows = collect_with_service(service, property_url, period_start, period_end, opportunity_urls)
    payload = build_snapshot(opportunity_urls, rows, period_start=period_start, period_end=period_end, generated_at=generated_at, property_url=property_url)
    write_atomically(output, payload)
    return payload


def _create_service(service_account_info):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    credentials = service_account.Credentials.from_service_account_info(
        service_account_info, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    return build("searchconsole", "v1", credentials=credentials, cache_discovery=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--page-performance", type=Path, default=Path("data/page-performance.json"))
    parser.add_argument("--revenue-opportunities", type=Path, default=Path("data/revenue-opportunities.json"))
    parser.add_argument("--gsc-snapshot", type=Path, default=Path("data/performance/gsc-latest.json"))
    parser.add_argument("--output", type=Path, default=Path("data/performance/gsc-opportunity-queries-latest.json"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    page_performance = _load_json(args.page_performance)
    opportunity_summary = _load_json(args.revenue_opportunities)
    gsc_snapshot = _load_json(args.gsc_snapshot)
    urls = current_opportunity_urls(page_performance, opportunity_summary)
    period_start, period_end = get_snapshot_period(gsc_snapshot)
    if args.dry_run:
        print(json.dumps({"mode": "DRY_RUN", "plannedUrls": len(urls), "period": {"start": period_start, "end": period_end}, "output": str(args.output)}))
        return

    encoded = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON_B64") or os.environ.get("GA4_SERVICE_ACCOUNT_JSON_B64")
    if not encoded:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON_B64 or GA4_SERVICE_ACCOUNT_JSON_B64 is required")
    try:
        service_account_info = json.loads(base64.b64decode(encoded).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("service account secret is not valid base64 JSON") from exc
    if not isinstance(service_account_info, dict) or service_account_info.get("type") != "service_account":
        raise RuntimeError("service account JSON is missing type=service_account")
    payload = run_collection(
        _create_service(service_account_info), PROPERTY_URL, period_start, period_end, urls, args.output,
        generated_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    )
    print(json.dumps({"output": str(args.output), **payload["summary"], "period": {"start": period_start, "end": period_end}}))


if __name__ == "__main__":
    main()
