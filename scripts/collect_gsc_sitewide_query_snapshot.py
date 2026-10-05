#!/usr/bin/env python3
"""Collect partial, finalized, site-wide Search Console page-query evidence."""

import argparse
import base64
import json
import math
import os
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

try:
    from .collect_gsc_snapshot import PROPERTY_URL, SOURCE, decode_service_account
except ImportError:
    from collect_gsc_snapshot import PROPERTY_URL, SOURCE, decode_service_account


SEARCH_TYPE = "web"
ROW_LIMIT = 25_000
MAX_PAGES = 20  # Bounds the manual Actions run and the temporary artifact size.
COVERAGE_STATUS = "PARTIAL_TOP_ROWS"
COMPLETENESS_NOTE = (
    "Search Analytics returns top rows and may omit queries or page-query pairs; "
    "an absent row does not mean zero demand or zero impressions."
)


def _load_json(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def _valid_period(start, end):
    try:
        parsed_start = date.fromisoformat(start)
        parsed_end = date.fromisoformat(end)
    except (TypeError, ValueError) as exc:
        raise ValueError("GSC snapshot has invalid period metadata") from exc
    if parsed_start.isoformat() != start or parsed_end.isoformat() != end:
        raise ValueError("GSC snapshot period must use YYYY-MM-DD dates")
    if parsed_start > parsed_end:
        raise ValueError("GSC snapshot period start is after its end")
    return start, end


def get_snapshot_period(gsc_snapshot):
    if not isinstance(gsc_snapshot, dict) or gsc_snapshot.get("status") != "VERIFIED":
        raise ValueError("a VERIFIED GSC page snapshot is required")
    if gsc_snapshot.get("source") != SOURCE or gsc_snapshot.get("property") != PROPERTY_URL:
        raise ValueError("GSC snapshot source or property does not match the canonical property")
    start, end = _valid_period(gsc_snapshot.get("periodStart"), gsc_snapshot.get("periodEnd"))
    periods = gsc_snapshot.get("periods")
    if periods is not None and not isinstance(periods, dict):
        raise ValueError("GSC snapshot period metadata must be an object")
    nested_period = periods.get("gsc") if isinstance(periods, dict) else None
    if nested_period is not None and nested_period != {"start": start, "end": end}:
        raise ValueError("GSC snapshot period metadata is inconsistent")
    return start, end


def _metric(row, name, *, maximum=None):
    value = row.get(name)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError(f"Search Console page-query row has invalid {name}")
    if maximum is not None and value > maximum:
        raise ValueError(f"Search Console page-query row has invalid {name}")
    return value


def _validate_row(row):
    if not isinstance(row, dict):
        raise ValueError("Search Console page-query row must be an object")
    required = {"page", "query", "clicks", "impressions", "ctr", "position"}
    if set(row) != required:
        raise ValueError("Search Console page-query row has missing or unexpected fields")
    page, query = row.get("page"), row.get("query")
    if not isinstance(page, str) or not page.strip():
        raise ValueError("Search Console page-query row is missing page")
    if not isinstance(query, str) or not query.strip():
        raise ValueError("Search Console page-query row is missing query")
    _metric(row, "clicks")
    _metric(row, "impressions")
    _metric(row, "ctr", maximum=1)
    _metric(row, "position")
    return {
        "page": page,
        "query": query,
        "clicks": row["clicks"],
        "impressions": row["impressions"],
        "ctr": row["ctr"],
        "position": row["position"],
    }


def _row_from_api(row):
    if not isinstance(row, dict):
        raise ValueError("Search Console API row must be an object")
    keys = row.get("keys")
    if not isinstance(keys, list) or len(keys) != 2:
        raise ValueError("Search Console API row must include page and query keys")
    projected = {
        "page": keys[0],
        "query": keys[1],
        "clicks": row.get("clicks"),
        "impressions": row.get("impressions"),
        "ctr": row.get("ctr"),
        "position": row.get("position"),
    }
    return _validate_row(projected)


def _row_limit(value):
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= ROW_LIMIT:
        raise ValueError("rowLimit must be between 1 and 25000")


def _max_pages(value):
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError("max_pages must be a positive integer")


def collect_with_service(service, property_url, period_start, period_end, *, row_limit=ROW_LIMIT, max_pages=MAX_PAGES):
    if property_url != PROPERTY_URL:
        raise ValueError("refusing to query a non-canonical Search Console property")
    _valid_period(period_start, period_end)
    _row_limit(row_limit)
    _max_pages(max_pages)

    metadata = service.sites().get(siteUrl=property_url).execute()
    if not isinstance(metadata, dict) or metadata.get("siteUrl") != property_url:
        raise ValueError("Search Console API property mismatch")

    rows = []
    seen_page_signatures = set()
    seen_row_keys = set()
    start_row = 0
    final_start_row = 0
    pages_fetched = 0
    stopped_because = None

    while pages_fetched < max_pages:
        final_start_row = start_row
        response = service.searchanalytics().query(
            siteUrl=property_url,
            body={
                "startDate": period_start,
                "endDate": period_end,
                "dimensions": ["page", "query"],
                "type": SEARCH_TYPE,
                "dataState": "final",
                "aggregationType": "auto",
                "rowLimit": row_limit,
                "startRow": start_row,
            },
        ).execute()
        pages_fetched += 1
        if not isinstance(response, dict):
            raise ValueError("Search Console API response must be an object")
        api_rows = response.get("rows", [])
        if not isinstance(api_rows, list):
            raise ValueError("Search Console API rows must be a list")
        if len(api_rows) > row_limit:
            raise ValueError("Search Console API returned more rows than rowLimit")
        if not api_rows:
            stopped_because = "zero_rows"
            break

        page_rows = [_row_from_api(row) for row in api_rows]
        page_signature = tuple((row["page"], row["query"]) for row in page_rows)
        if len(set(page_signature)) != len(page_signature):
            raise ValueError("Search Console API returned duplicate page-query rows")
        if page_signature in seen_page_signatures:
            raise ValueError("Search Console API repeated a response page")
        if any(key in seen_row_keys for key in page_signature):
            raise ValueError("Search Console API repeated page-query rows across pages")
        seen_page_signatures.add(page_signature)
        seen_row_keys.update(page_signature)
        rows.extend(page_rows)

        if len(api_rows) < row_limit:
            stopped_because = "short_page"
            break
        start_row += row_limit
    else:
        stopped_because = "safety_ceiling"

    pagination = {
        "pagesFetched": pages_fetched,
        "finalStartRow": final_start_row,
        "stoppedBecause": stopped_because,
        "maxPages": max_pages,
    }
    return {"rows": rows, "pagination": pagination}


def _validate_pagination(pagination):
    if not isinstance(pagination, dict):
        raise ValueError("pagination metadata must be an object")
    pages_fetched = pagination.get("pagesFetched")
    final_start_row = pagination.get("finalStartRow")
    stopped_because = pagination.get("stoppedBecause")
    max_pages = pagination.get("maxPages")
    if isinstance(pages_fetched, bool) or not isinstance(pages_fetched, int) or pages_fetched < 1:
        raise ValueError("pagination pagesFetched is invalid")
    if isinstance(final_start_row, bool) or not isinstance(final_start_row, int) or final_start_row < 0:
        raise ValueError("pagination finalStartRow is invalid")
    if not isinstance(stopped_because, str) or stopped_because not in {"zero_rows", "short_page", "safety_ceiling"}:
        raise ValueError("pagination stoppedBecause is invalid")
    _max_pages(max_pages)
    if pages_fetched > max_pages:
        raise ValueError("pagination exceeded its safety ceiling")
    if stopped_because == "safety_ceiling" and pages_fetched != max_pages:
        raise ValueError("pagination safety ceiling metadata is inconsistent")
    return {
        "pagesFetched": pages_fetched,
        "finalStartRow": final_start_row,
        "stoppedBecause": stopped_because,
        "maxPages": max_pages,
    }


def build_snapshot(rows, *, property_url, period_start, period_end, generated_at, pagination, row_limit=ROW_LIMIT):
    if property_url != PROPERTY_URL:
        raise ValueError("refusing a non-canonical Search Console property")
    start, end = _valid_period(period_start, period_end)
    _row_limit(row_limit)
    try:
        generated = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError("generatedAt must be an ISO-8601 timestamp") from exc
    if generated.tzinfo is None:
        raise ValueError("generatedAt must include a timezone")
    pagination = _validate_pagination(pagination)
    if not isinstance(rows, list):
        raise ValueError("site-wide page-query rows must be a list")

    validated_rows = []
    seen = set()
    for row in rows:
        validated = _validate_row(row)
        key = (validated["page"], validated["query"])
        if key in seen:
            raise ValueError("site-wide artifact contains duplicate page-query rows")
        seen.add(key)
        validated_rows.append(validated)

    return {
        "schemaVersion": 1,
        "source": SOURCE,
        "generatedAt": generated_at,
        "property": property_url,
        "searchType": SEARCH_TYPE,
        "period": {"start": start, "end": end, "finalized": True},
        "dimensions": ["page", "query"],
        "coverageStatus": COVERAGE_STATUS,
        "completenessGuaranteed": False,
        "completenessNote": COMPLETENESS_NOTE,
        "rowLimit": row_limit,
        "pagination": pagination,
        "rowCount": len(validated_rows),
        "rows": validated_rows,
    }


def validate_snapshot(payload):
    schema_version = payload.get("schemaVersion") if isinstance(payload, dict) else None
    if isinstance(schema_version, bool) or not isinstance(schema_version, int) or schema_version != 1:
        raise ValueError("site-wide page-query artifact schema is invalid")
    if payload.get("source") != SOURCE or payload.get("property") != PROPERTY_URL:
        raise ValueError("site-wide page-query artifact source or property is invalid")
    if payload.get("searchType") != SEARCH_TYPE:
        raise ValueError("site-wide page-query artifact search type is invalid")
    period = payload.get("period")
    if not isinstance(period, dict) or period.get("finalized") is not True:
        raise ValueError("site-wide page-query artifact period is not finalized")
    start, end = _valid_period(period.get("start"), period.get("end"))
    if payload.get("dimensions") != ["page", "query"]:
        raise ValueError("site-wide page-query artifact dimensions are invalid")
    if payload.get("coverageStatus") != COVERAGE_STATUS or payload.get("completenessGuaranteed") is not False:
        raise ValueError("site-wide page-query artifact completeness semantics are invalid")
    note = payload.get("completenessNote")
    if not isinstance(note, str) or not note.strip():
        raise ValueError("site-wide page-query artifact completeness note is missing")
    row_limit = payload.get("rowLimit")
    _row_limit(row_limit)
    pagination = _validate_pagination(payload.get("pagination"))
    rows = payload.get("rows")
    row_count = payload.get("rowCount")
    if not isinstance(rows, list) or isinstance(row_count, bool) or not isinstance(row_count, int) or row_count != len(rows):
        raise ValueError("site-wide page-query artifact row count is inconsistent")
    seen = set()
    for row in rows:
        validated = _validate_row(row)
        key = (validated["page"], validated["query"])
        if key in seen:
            raise ValueError("site-wide page-query artifact contains duplicate rows")
        seen.add(key)
    try:
        generated = datetime.fromisoformat(payload.get("generatedAt", "").replace("Z", "+00:00"))
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError("generatedAt must be an ISO-8601 timestamp") from exc
    if generated.tzinfo is None:
        raise ValueError("generatedAt must include a timezone")
    return {
        "rowCount": len(rows),
        "period": {"start": start, "end": end},
        "pagesFetched": pagination["pagesFetched"],
        "stoppedBecause": pagination["stoppedBecause"],
    }


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


def run_collection(service, gsc_snapshot, output, *, generated_at, row_limit=ROW_LIMIT, max_pages=MAX_PAGES):
    period_start, period_end = get_snapshot_period(gsc_snapshot)
    property_url = gsc_snapshot["property"]
    result = collect_with_service(
        service, property_url, period_start, period_end,
        row_limit=row_limit, max_pages=max_pages,
    )
    payload = build_snapshot(
        result["rows"],
        property_url=property_url,
        period_start=period_start,
        period_end=period_end,
        generated_at=generated_at,
        pagination=result["pagination"],
        row_limit=row_limit,
    )
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
    temporary_root = Path(os.environ.get("RUNNER_TEMP", tempfile.gettempdir()))
    parser = argparse.ArgumentParser()
    parser.add_argument("--gsc-snapshot", type=Path, default=Path("data/performance/gsc-latest.json"))
    parser.add_argument("--output", type=Path, default=temporary_root / "gsc-sitewide-query.json")
    args = parser.parse_args()

    gsc_snapshot = _load_json(args.gsc_snapshot)
    period_start, period_end = get_snapshot_period(gsc_snapshot)
    encoded = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON_B64") or os.environ.get("GA4_SERVICE_ACCOUNT_JSON_B64")
    if not encoded:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON_B64 or GA4_SERVICE_ACCOUNT_JSON_B64 is required")
    service_account_info = decode_service_account(encoded)
    payload = run_collection(
        _create_service(service_account_info),
        gsc_snapshot,
        args.output,
        generated_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    )
    print(json.dumps({
        "output": str(args.output),
        "rowCount": payload["rowCount"],
        "period": {"start": period_start, "end": period_end},
        "coverageStatus": payload["coverageStatus"],
        "completenessGuaranteed": payload["completenessGuaranteed"],
        "pagination": payload["pagination"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
