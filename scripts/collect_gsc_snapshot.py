#!/usr/bin/env python3
"""Collect a Search Console page snapshot without fabricating missing data."""

import argparse
import base64
import json
import os
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit


PROPERTY_URL = "https://emfls.github.io/"
SOURCE = "GOOGLE_SEARCH_CONSOLE_API"
ROW_LIMIT = 25_000


def decode_service_account(encoded):
    try:
        info = json.loads(base64.b64decode(encoded).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("service account secret is not valid base64 JSON") from exc
    if not isinstance(info, dict) or info.get("type") != "service_account":
        raise RuntimeError("service account JSON is missing type=service_account")
    return info


def normalize_url(value):
    raw = str(value or "").strip()
    if raw.startswith(("http://", "https://")):
        raw = urlsplit(raw).path or "/"
    raw = raw.split("?", 1)[0].split("#", 1)[0] or "/"
    return raw if raw.startswith("/") else "/" + raw


def paginate_query(fetch, *, row_limit=ROW_LIMIT):
    rows, start_row = [], 0
    while True:
        page = fetch(start_row, row_limit)
        rows.extend(page)
        if len(page) < row_limit:
            return rows
        start_row += row_limit


def _page_from_row(row, property_url=PROPERTY_URL):
    keys = row.get("keys")
    if not isinstance(keys, list) or not keys or not keys[0]:
        return None
    raw = str(keys[0]).strip()
    expected = urlsplit(property_url)
    parsed = urlsplit(raw)
    if parsed.scheme not in {"http", "https"} or parsed.netloc.lower() != expected.netloc.lower():
        return None
    return raw


def _aggregate(rows, property_url=PROPERTY_URL):
    grouped = {}
    for row in rows:
        page = _page_from_row(row, property_url)
        if page is None:
            continue
        url = normalize_url(page)
        bucket = grouped.setdefault(url, {"clicks": 0, "impressions": 0, "positions": []})
        clicks = int(row.get("clicks") or 0)
        impressions = int(row.get("impressions") or 0)
        bucket["clicks"] += clicks
        bucket["impressions"] += impressions
        if row.get("position") is not None and impressions:
            bucket["positions"].append((float(row["position"]), impressions))
    return grouped


def build_snapshot(rows, *, period_start, period_end, generated_at, property_url=PROPERTY_URL):
    if not rows:
        raise ValueError("Search Console API returned no page rows; existing snapshot was preserved")
    pages = []
    grouped = _aggregate(rows, property_url)
    if not grouped:
        raise ValueError("Search Console API returned no valid page rows; existing snapshot was preserved")
    for url, values in sorted(grouped.items()):
        impressions = values["impressions"]
        clicks = values["clicks"]
        position = (
            round(sum(value * weight for value, weight in values["positions"]) / sum(weight for _, weight in values["positions"]), 2)
            if values["positions"] else None
        )
        pages.append({
            "url": url,
            "google": {
                "clicks": clicks,
                "impressions": impressions,
                "ctr": clicks / impressions if impressions else None,
                "position": position,
                "period": {"start": period_start, "end": period_end},
                "source": SOURCE,
                "property": property_url,
                "status": "VERIFIED",
            },
        })
    return {
        "status": "VERIFIED", "source": SOURCE, "property": property_url,
        "periodStart": period_start, "periodEnd": period_end,
        "generatedAt": generated_at,
        "periods": {"gsc": {"start": period_start, "end": period_end}},
        "pages": pages,
    }


def write_atomically(path, payload):
    if not payload.get("pages"):
        raise ValueError("refusing to write an empty Search Console snapshot")
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def collect(property_url, service_account_info, period_start, period_end):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    credentials = service_account.Credentials.from_service_account_info(
        service_account_info, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    service = build("searchconsole", "v1", credentials=credentials, cache_discovery=False)
    service.sites().get(siteUrl=property_url).execute()

    def fetch(start_row, row_limit):
        response = service.searchanalytics().query(
            siteUrl=property_url,
            body={"startDate": period_start, "endDate": period_end, "dimensions": ["page"], "rowLimit": row_limit, "startRow": start_row},
        ).execute()
        return response.get("rows") or []

    return paginate_query(fetch)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("data/performance/gsc-latest.json"))
    parser.add_argument("--days", type=int, default=28)
    args = parser.parse_args()
    encoded = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON_B64") or os.environ.get("GA4_SERVICE_ACCOUNT_JSON_B64")
    if not encoded:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON_B64 or GA4_SERVICE_ACCOUNT_JSON_B64 is required")
    info = decode_service_account(encoded)
    end = date.today() - timedelta(days=3)
    start = end - timedelta(days=max(1, args.days) - 1)
    rows = collect(PROPERTY_URL, info, start.isoformat(), end.isoformat())
    snapshot = build_snapshot(rows, period_start=start.isoformat(), period_end=end.isoformat(), generated_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat())
    write_atomically(args.output, snapshot)
    print(json.dumps({"output": str(args.output), "pages": len(snapshot["pages"]), "period": {"start": snapshot["periodStart"], "end": snapshot["periodEnd"]}}))


if __name__ == "__main__":
    main()
