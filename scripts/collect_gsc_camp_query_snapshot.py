#!/usr/bin/env python3
"""Collect separate Search Console query-by-page evidence for camping URLs."""

import argparse
import json
import math
import os
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

from scripts.collect_gsc_snapshot import PROPERTY_URL, ROW_LIMIT, SOURCE, normalize_url, paginate_query


CAMPING_PATH_PREFIX = "/kor/report/camp/"
WINDOW_DAYS = 28
FINALIZED_DATA_LAG_DAYS = 3
DIMENSIONS = ["page", "query"]


def get_collection_period(as_of=None):
    """Use the page collector's 28-day window and three-day finalized-data lag."""
    current = as_of or date.today()
    if not isinstance(current, date):
        raise TypeError("as_of must be a date")
    end = current - timedelta(days=FINALIZED_DATA_LAG_DAYS)
    start = end - timedelta(days=WINDOW_DAYS - 1)
    return start.isoformat(), end.isoformat()


def _page_query_from_row(row, property_url=PROPERTY_URL):
    keys = row.get("keys") if isinstance(row, dict) else None
    if not isinstance(keys, list) or len(keys) != len(DIMENSIONS):
        raise ValueError("Search Console query row must have exactly page and query keys")
    raw_page, query = keys
    if not isinstance(raw_page, str) or not raw_page.strip():
        raise ValueError("Search Console query row has an empty page key")
    if not isinstance(query, str) or not query.strip():
        raise ValueError("Search Console query row has an empty query key")

    expected = urlsplit(property_url)
    parsed = urlsplit(raw_page.strip())
    if parsed.scheme != "https" or parsed.netloc.lower() != expected.netloc.lower():
        raise ValueError("Search Console query row is outside the exact HTTPS property")
    page = normalize_url(raw_page)
    if not page.startswith(CAMPING_PATH_PREFIX):
        raise ValueError("Search Console query row is outside the camping path scope")
    return page, query


def _count_metric(row, name):
    value = row.get(name)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"Search Console query row has invalid {name}")
    if value < 0 or int(value) != value:
        raise ValueError(f"Search Console query row has invalid {name}")
    return int(value)


def _position_metric(row):
    value = row.get("position")
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError("Search Console query row has invalid position")
    return float(value)


def build_snapshot(rows, *, period_start, period_end, generated_at, property_url=PROPERTY_URL):
    if property_url != PROPERTY_URL:
        raise ValueError("refusing to collect a non-canonical Search Console property")
    if not rows:
        raise ValueError("Search Console API returned no camping query rows; existing artifact was preserved")

    grouped = {}
    for row in rows:
        page, query = _page_query_from_row(row, property_url)
        clicks = _count_metric(row, "clicks")
        impressions = _count_metric(row, "impressions")
        position = _position_metric(row)
        bucket = grouped.setdefault((page, query), {"clicks": 0, "impressions": 0, "positions": []})
        bucket["clicks"] += clicks
        bucket["impressions"] += impressions
        if position is not None and impressions:
            bucket["positions"].append((position, impressions))

    if not grouped:
        raise ValueError("Search Console API returned no valid camping query rows; existing artifact was preserved")

    output_rows = []
    for (page, query), values in sorted(grouped.items()):
        impressions = values["impressions"]
        clicks = values["clicks"]
        positions = values["positions"]
        position = (
            round(sum(value * weight for value, weight in positions) / sum(weight for _, weight in positions), 2)
            if positions else None
        )
        output_rows.append({
            "page": page,
            "query": query,
            "clicks": clicks,
            "impressions": impressions,
            "ctr": clicks / impressions if impressions else None,
            "position": position,
        })

    pages = {row["page"] for row in output_rows}
    return {
        "schemaVersion": 1,
        "status": "VERIFIED",
        "source": SOURCE,
        "property": property_url,
        "dimensions": DIMENSIONS,
        "pathPrefix": CAMPING_PATH_PREFIX,
        "periodStart": period_start,
        "periodEnd": period_end,
        "generatedAt": generated_at,
        "periods": {"gscCampQuery": {"start": period_start, "end": period_end}},
        "collectionPolicy": {
            "windowDays": WINDOW_DAYS,
            "finalizedDataLagDays": FINALIZED_DATA_LAG_DAYS,
        },
        "summary": {
            "apiRows": len(rows),
            "aggregatedRows": len(output_rows),
            "uniquePages": len(pages),
        },
        "limitations": {
            "anonymizedOrLowVolumeQueriesMayBeOmitted": True,
            "apiRowLimitPerRequest": ROW_LIMIT,
            "apiMaxRowsPerSearchTypePerDay": 50_000,
            "notForRevenueClassification": True,
            "use": "Separate query-intent evidence; never add these rows to page-only revenue inputs.",
        },
        "rows": output_rows,
    }


def validate_snapshot(payload):
    if not isinstance(payload, dict):
        raise ValueError("camping query artifact must be a JSON object")
    if payload.get("schemaVersion") != 1 or payload.get("status") != "VERIFIED":
        raise ValueError("camping query artifact has an invalid schema or status")
    if payload.get("source") != SOURCE or payload.get("property") != PROPERTY_URL:
        raise ValueError("camping query artifact source/property mismatch")
    if payload.get("dimensions") != DIMENSIONS or payload.get("pathPrefix") != CAMPING_PATH_PREFIX:
        raise ValueError("camping query artifact dimension/path scope mismatch")
    try:
        start = date.fromisoformat(payload["periodStart"])
        end = date.fromisoformat(payload["periodEnd"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("camping query artifact has invalid period metadata") from exc
    if start > end:
        raise ValueError("camping query artifact period is reversed")
    if (end - start).days != WINDOW_DAYS - 1:
        raise ValueError("camping query artifact period is not the configured 28-day window")
    if payload.get("periods", {}).get("gscCampQuery") != {"start": start.isoformat(), "end": end.isoformat()}:
        raise ValueError("camping query artifact period metadata is inconsistent")
    if payload.get("collectionPolicy") != {"windowDays": WINDOW_DAYS, "finalizedDataLagDays": FINALIZED_DATA_LAG_DAYS}:
        raise ValueError("camping query artifact collection policy is inconsistent")
    try:
        generated = datetime.fromisoformat(payload["generatedAt"].replace("Z", "+00:00"))
    except (KeyError, AttributeError, TypeError, ValueError) as exc:
        raise ValueError("camping query artifact has invalid generatedAt") from exc
    if generated.tzinfo is None:
        raise ValueError("camping query artifact generatedAt must include a timezone")

    rows = payload.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError("refusing to write an empty camping query artifact")
    seen = set()
    for row in rows:
        page, query = _page_query_from_row({"keys": [row.get("page"), row.get("query")]})
        key = (page, query)
        if key in seen:
            raise ValueError("camping query artifact contains duplicate page/query rows")
        seen.add(key)
        for metric in ("clicks", "impressions"):
            value = row.get(metric)
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError(f"camping query artifact has invalid {metric}")
        expected_ctr = row["clicks"] / row["impressions"] if row["impressions"] else None
        if row.get("ctr") != expected_ctr:
            raise ValueError("camping query artifact CTR does not match clicks/impressions")
        position = row.get("position")
        if position is not None and (isinstance(position, bool) or not isinstance(position, (int, float)) or not math.isfinite(position) or position < 0):
            raise ValueError("camping query artifact has invalid position")

    limitations = payload.get("limitations")
    if not isinstance(limitations, dict) or limitations.get("notForRevenueClassification") is not True:
        raise ValueError("camping query artifact is missing its non-revenue limitation")
    summary = payload.get("summary")
    if not isinstance(summary, dict) or summary.get("aggregatedRows") != len(rows) or summary.get("uniquePages") != len({row["page"] for row in rows}):
        raise ValueError("camping query artifact summary does not match rows")
    return {"rows": len(rows), "uniquePages": len({row["page"] for row in rows}), "period": {"start": start.isoformat(), "end": end.isoformat()}}


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


def collect_with_service(service, property_url, period_start, period_end, *, row_limit=ROW_LIMIT):
    if property_url != PROPERTY_URL:
        raise ValueError("refusing to query a non-canonical Search Console property")
    metadata = service.sites().get(siteUrl=PROPERTY_URL).execute()
    if not isinstance(metadata, dict) or metadata.get("siteUrl") != PROPERTY_URL:
        raise ValueError("Search Console API property mismatch")

    def fetch(start_row, limit):
        response = service.searchanalytics().query(
            siteUrl=PROPERTY_URL,
            body={
                "startDate": period_start,
                "endDate": period_end,
                "dimensions": DIMENSIONS,
                "aggregationType": "byPage",
                "dimensionFilterGroups": [{
                    "groupType": "and",
                    "filters": [{"dimension": "page", "operator": "contains", "expression": CAMPING_PATH_PREFIX}],
                }],
                "rowLimit": limit,
                "startRow": start_row,
            },
        ).execute()
        return response.get("rows") or []

    rows = paginate_query(fetch, row_limit=row_limit)
    if not rows:
        raise ValueError("Search Console API returned no camping query rows; existing artifact was preserved")
    return rows


def collect(property_url, service_account_info, period_start, period_end):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    credentials = service_account.Credentials.from_service_account_info(
        service_account_info, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    service = build("searchconsole", "v1", credentials=credentials, cache_discovery=False)
    return collect_with_service(service, property_url, period_start, period_end)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("data/performance/gsc-camp-query-latest.json"))
    args = parser.parse_args()
    encoded = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON_B64") or os.environ.get("GA4_SERVICE_ACCOUNT_JSON_B64")
    if not encoded:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON_B64 or GA4_SERVICE_ACCOUNT_JSON_B64 is required")
    from scripts.collect_gsc_snapshot import decode_service_account

    start, end = get_collection_period()
    rows = collect(PROPERTY_URL, decode_service_account(encoded), start, end)
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    payload = build_snapshot(rows, period_start=start, period_end=end, generated_at=generated_at)
    write_atomically(args.output, payload)
    print(json.dumps({"output": str(args.output), "rows": len(payload["rows"]), "pages": payload["summary"]["uniquePages"], "period": {"start": start, "end": end}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
