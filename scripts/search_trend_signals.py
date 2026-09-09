#!/usr/bin/env python3
"""Collect verified/observed trend signals without inventing search volume."""

import argparse
import json
import os
import sqlite3
import urllib.request
from datetime import date, timedelta
from pathlib import Path


NAVER_DATALAB_URL = "https://openapi.naver.com/v1/datalab/search"


def trend_window(run_at, window_days):
    end = date.fromisoformat(str(run_at)[:10])
    start = end - timedelta(days=max(int(window_days), 1) - 1)
    return start.isoformat(), end.isoformat()


def _read_json(path, default):
    path = Path(path)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _write_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def load_trendradar_sqlite(database, keywords=None, limit=100):
    """Read TrendRadar's public SQLite output through its stable news_items schema."""
    database = Path(database) if database else None
    if not database or not database.exists():
        return {
            "source": "TREND_RADAR",
            "status": "INSUFFICIENT_DATA",
            "signals": [],
            "warning": "TrendRadar database is missing.",
        }

    filters = [str(value).casefold() for value in (keywords or []) if str(value).strip()]
    try:
        with sqlite3.connect(str(database)) as connection:
            rows = connection.execute(
                """
                SELECT title, platform_id, rank, url, first_crawl_time,
                       last_crawl_time, crawl_count
                FROM news_items
                ORDER BY rank ASC, crawl_count DESC, title ASC
                LIMIT ?
                """,
                (max(int(limit), 1) * 10,),
            ).fetchall()
    except (sqlite3.DatabaseError, OSError) as error:
        return {
            "source": "TREND_RADAR",
            "status": "INSUFFICIENT_DATA",
            "signals": [],
            "warning": "TrendRadar database could not be read: {}".format(error),
        }

    signals = []
    for title, platform, rank, url, first_seen, last_seen, occurrences in rows:
        if filters and not any(keyword in str(title).casefold() for keyword in filters):
            continue
        signals.append(
            {
                "source": "TREND_RADAR",
                "dataStatus": "OBSERVED_SEARCH_SIGNAL",
                "title": title,
                "platform": platform,
                "rank": int(rank),
                "occurrences": int(occurrences),
                "firstSeen": first_seen,
                "lastSeen": last_seen,
                "evidenceUrl": url or None,
            }
        )
        if len(signals) >= max(int(limit), 1):
            break
    return {
        "source": "TREND_RADAR",
        "status": "OBSERVED_SEARCH_SIGNAL" if signals else "INSUFFICIENT_DATA",
        "signals": signals,
        "warning": None if signals else "No configured keyword matched TrendRadar data.",
    }


def _default_transport(request):
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def collect_naver_datalab(
    keyword_groups,
    start_date,
    end_date,
    *,
    client_id,
    client_secret,
    transport=None,
):
    """Collect relative Naver search interest; absolute volume is never inferred."""
    if not client_id or not client_secret:
        return {
            "source": "NAVER_DATALAB",
            "status": "NOT_CONNECTED",
            "signals": [],
            "warning": "NAVER_DATALAB_CLIENT_ID and NAVER_DATALAB_CLIENT_SECRET are required.",
        }
    if not keyword_groups:
        return {
            "source": "NAVER_DATALAB",
            "status": "INSUFFICIENT_DATA",
            "signals": [],
            "warning": "No Naver keyword groups are configured.",
        }

    body = json.dumps(
        {
            "startDate": start_date,
            "endDate": end_date,
            "timeUnit": "date",
            "keywordGroups": keyword_groups[:5],
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        NAVER_DATALAB_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Naver-Client-Id": client_id,
            "X-Naver-Client-Secret": client_secret,
        },
    )
    try:
        raw = (transport or _default_transport)(request)
        payload = json.loads(raw.decode("utf-8"))
    except Exception as error:  # network/API boundary; preserve status instead of fabricating data
        return {
            "source": "NAVER_DATALAB",
            "status": "STALE_DATA",
            "signals": [],
            "warning": "Naver DataLab request failed: {}".format(error),
        }

    signals = []
    for result in payload.get("results") or []:
        points = result.get("data") or []
        ratios = [float(point.get("ratio") or 0) for point in points]
        latest = ratios[-1] if ratios else None
        previous = ratios[-2] if len(ratios) >= 2 else None
        change = None
        if previous not in (None, 0) and latest is not None:
            change = round((latest - previous) / previous * 100, 2)
        signals.append(
            {
                "source": "NAVER_DATALAB",
                "dataStatus": "VERIFIED_SEARCH_DATA",
                "topic": result.get("title"),
                "keywords": list(result.get("keywords") or []),
                "startDate": payload.get("startDate", start_date),
                "endDate": payload.get("endDate", end_date),
                "latestRelativeInterest": latest,
                "peakRelativeInterest": max(ratios) if ratios else None,
                "trendChangePercent": change,
                "points": points,
            }
        )
    return {
        "source": "NAVER_DATALAB",
        "status": "VERIFIED_SEARCH_DATA" if signals else "INSUFFICIENT_DATA",
        "signals": signals,
        "warning": None if signals else "Naver DataLab returned no trend groups.",
    }


def _report(payload):
    trendradar = payload["sources"]["trendRadar"]
    naver = payload["sources"]["naver"]
    lines = [
        "# SEARCH TREND SIGNALS",
        "",
        "- Run: {}".format(payload["runAt"]),
        "- TrendRadar: {}".format(trendradar["status"]),
        "- TrendRadar signals: {}".format(len(trendradar["signals"])),
        "- Naver DataLab: {}".format(naver["status"]),
        "- Naver trend groups: {}".format(len(naver["signals"])),
        "- Google Trends: {}".format(payload["sources"]["google"]["status"]),
        "",
        "## TrendRadar observations",
        "",
    ]
    for row in trendradar["signals"][:20]:
        lines.append(
            "- #{rank} [{platform}] {title} (observed {occurrences} times)".format(**row)
        )
    lines.extend(["", "## Naver relative interest", ""])
    for row in naver["signals"]:
        lines.append(
            "- {topic}: latest {latestRelativeInterest}, peak {peakRelativeInterest}, change {trendChangePercent}%".format(
                **row
            )
        )
    lines.extend(
        [
            "",
            "> Relative interest and observed rankings are demand signals, not absolute search volume.",
        ]
    )
    return "\n".join(lines).rstrip() + "\n"


def run_search_trend_pipeline(
    root,
    *,
    run_at,
    config_path,
    trendradar_db=None,
    client_id=None,
    client_secret=None,
):
    root = Path(root)
    config = _read_json(config_path, {})
    trendradar = load_trendradar_sqlite(
        trendradar_db,
        keywords=config.get("trendRadarKeywords") or [],
        limit=config.get("trendRadarLimit") or 100,
    )
    start_date, end_date = trend_window(run_at, config.get("windowDays") or 30)
    naver = collect_naver_datalab(
        config.get("naverKeywordGroups") or [],
        start_date,
        end_date,
        client_id=client_id or "",
        client_secret=client_secret or "",
    )
    payload = {
        "schemaVersion": 1,
        "runAt": run_at,
        "summary": {
            "trendRadarSignals": len(trendradar["signals"]),
            "naverTrendGroups": len(naver["signals"]),
            "googleTrendsStatus": "NOT_CONNECTED",
        },
        "sources": {
            "trendRadar": trendradar,
            "naver": naver,
            "google": {
                "status": "NOT_CONNECTED",
                "signals": [],
                "warning": "Official Google Trends API access is not configured.",
            },
        },
    }
    _write_json(root / "data/search-trend-signals.json", payload)
    report_path = root / "reports/search-trend-signals.md"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(_report(payload), encoding="utf-8")
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--run-at", required=True)
    parser.add_argument("--config", type=Path, default=Path("data/search-trend-keywords.json"))
    parser.add_argument("--trendradar-db", type=Path)
    args = parser.parse_args()
    result = run_search_trend_pipeline(
        args.root,
        run_at=args.run_at,
        config_path=args.config,
        trendradar_db=args.trendradar_db,
        client_id=os.environ.get("NAVER_DATALAB_CLIENT_ID"),
        client_secret=os.environ.get("NAVER_DATALAB_CLIENT_SECRET"),
    )
    print(json.dumps(result["summary"], ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
