#!/usr/bin/env python3
"""Collect a GA4 Data API landing-page snapshot without fabricating data."""

import argparse
import base64
import json
import os
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit


METRICS = (
    "screenPageViews",
    "totalUsers",
    "userEngagementDuration",
    "totalRevenue",
)
SCHEMA_VERSION = 2


def _number(value):
    if value in (None, "", "-", "(not set)"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_path(value):
    raw = str(value or "/").strip()
    if raw.startswith("http://") or raw.startswith("https://"):
        raw = urlsplit(raw).path or "/"
    raw = raw.split("?", 1)[0].split("#", 1)[0] or "/"
    if not raw.startswith("/"):
        raw = "/" + raw
    if raw == "/" or raw.endswith("/") or Path(raw).suffix:
        return raw
    return raw.rstrip("/") + "/"


def _metric(row, index):
    values = getattr(row, "metric_values", None) or row.get("metricValues", [])
    item = values[index] if index < len(values) else None
    return getattr(item, "value", None) if item is not None else None


def _dimension(row):
    values = getattr(row, "dimension_values", None) or row.get("dimensionValues", [])
    item = values[0] if values else None
    return getattr(item, "value", None) if item is not None else None


def build_snapshot(rows, *, period_start, period_end, collected_at, property_id):
    pages = []
    total = {name: 0.0 for name in METRICS}
    for row in rows:
        url = normalize_path(_dimension(row))
        values = [_number(_metric(row, i)) for i in range(len(METRICS))]
        page = {
            "url": url,
            "ga4": {
                "views": int(values[0]) if values[0] is not None else None,
                "users": int(values[1]) if values[1] is not None else None,
                "engagementSeconds": values[2],
                "revenue": values[3],
                "period": {"start": period_start, "end": period_end},
                "source": "GOOGLE_ANALYTICS_DATA_API",
                "status": "VERIFIED",
            },
        }
        for name, value in zip(METRICS, values):
            if value is not None:
                total[name] += value
        pages.append(page)
    total_users = int(total["totalUsers"])
    total_views = int(total["screenPageViews"])
    site_ga4 = {
        "views": total_views,
        "users": total_users,
        "engagementSeconds": total["userEngagementDuration"],
        "revenue": total["totalRevenue"],
        "viewsPerUser": round(total_views / total_users, 2) if total_users else None,
        "period": {"start": period_start, "end": period_end},
        "source": "GOOGLE_ANALYTICS_DATA_API",
        "status": "VERIFIED",
    }
    return {
        "as_of": collected_at[:10],
        "pages": pages,
        "periods": {"ga4": {"start": period_start, "end": period_end}},
        "schema_version": SCHEMA_VERSION,
        "site": {"ga4": site_ga4},
        "collection": {
            "collectedAt": collected_at,
            "propertyId": str(property_id),
            "source": "GOOGLE_ANALYTICS_DATA_API",
        },
    }


def _credentials_from_env():
    encoded = os.environ.get("GA4_SERVICE_ACCOUNT_JSON_B64")
    property_id = os.environ.get("GA4_PROPERTY_ID")
    if not encoded or not property_id:
        raise RuntimeError("GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON_B64 are required")
    try:
        info = json.loads(base64.b64decode(encoded).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("GA4_SERVICE_ACCOUNT_JSON_B64 is not valid base64 JSON") from exc
    if not isinstance(info, dict) or info.get("type") != "service_account":
        raise RuntimeError("GA4 service account JSON is missing type=service_account")
    return property_id, info


def collect(property_id, service_account_info, period_start, period_end):
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.analytics.data_v1beta.types import DateRange, Dimension, Metric, RunReportRequest
    from google.oauth2 import service_account

    credentials = service_account.Credentials.from_service_account_info(
        service_account_info,
        scopes=["https://www.googleapis.com/auth/analytics.readonly"],
    )
    client = BetaAnalyticsDataClient(credentials=credentials)
    request = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name="pagePathPlusQueryString")],
        metrics=[Metric(name=name) for name in METRICS],
        date_ranges=[DateRange(start_date=period_start, end_date=period_end)],
        limit=100000,
    )
    return client.run_report(request)


def write_atomically(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("data/performance/ga4-latest.json"))
    parser.add_argument("--days", type=int, default=28)
    args = parser.parse_args()
    property_id, info = _credentials_from_env()
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=max(1, args.days) - 1)
    response = collect(property_id, info, start.isoformat(), end.isoformat())
    snapshot = build_snapshot(
        response.rows,
        period_start=start.isoformat(),
        period_end=end.isoformat(),
        collected_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        property_id=property_id,
    )
    if not snapshot["pages"]:
        raise RuntimeError("GA4 Data API returned no page rows; existing snapshot was preserved")
    write_atomically(args.output, snapshot)
    print(json.dumps({"output": str(args.output), "pages": len(snapshot["pages"]), "period": snapshot["periods"]["ga4"]}))


if __name__ == "__main__":
    main()
