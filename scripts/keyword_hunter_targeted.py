"""Measure only explicit Keyword Hunter targets without changing discovery state."""
import argparse
import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from scripts.keyword_hunter_api import Client
    from scripts.keyword_hunter_core import DEFAULT_CONFIG, normalize
    from scripts.keyword_hunter_quota import DataLabUsage
    from scripts.keyword_hunter_state import atomic, json_text
except ModuleNotFoundError:
    from keyword_hunter_api import Client
    from keyword_hunter_core import DEFAULT_CONFIG, normalize
    from keyword_hunter_quota import DataLabUsage
    from keyword_hunter_state import atomic, json_text


KST = timezone(timedelta(hours=9))
FATAL_SOURCE_STATES = {"AUTH_ERROR", "RATE_LIMITED", "NETWORK_ERROR"}
SAFE_CODE = re.compile(r"[^A-Z0-9_.-]+")


def parse_targets(raw):
    """Accept a JSON string array or newline list of 1-5 explicit queries."""
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("Provide 1..5 explicit keywords")
    text = raw.strip()
    try:
        decoded = json.loads(text)
    except json.JSONDecodeError:
        decoded = [line.strip() for line in text.splitlines() if line.strip()]
    if not isinstance(decoded, list) or not 1 <= len(decoded) <= 5:
        raise ValueError("Provide 1..5 explicit keywords")

    targets = []
    keys = set()
    for target in decoded:
        if not isinstance(target, str):
            raise ValueError("Keywords must be strings")
        target = target.strip()
        if not target or len(target) > 100 or any(ord(char) < 32 or ord(char) == 127 for char in target):
            raise ValueError("Keywords must be non-empty, at most 100 characters, and contain no controls")
        key = normalize(target)
        if not key:
            raise ValueError("Keyword has no searchable characters")
        if key in keys:
            raise ValueError("duplicate normalized keyword")
        keys.add(key)
        targets.append(target)
    return targets


def _safe_errors(client):
    errors = []
    for error in client.errors:
        source = error.get("source")
        code = SAFE_CODE.sub("_", str(error.get("code", "UNKNOWN")))[:80]
        errors.append({"source": source, "code": code})
    return errors


def _related_row(row):
    return {
        "keyword": row["keyword"],
        "monthlyPc": row.get("monthly_pc"),
        "monthlyMobile": row.get("monthly_mobile"),
        "monthlyTotal": row.get("monthly_total"),
        "competition": row.get("competition"),
        "volumeNote": row.get("volume_note") or None,
    }


def _search_ads_record(target, rows, attempted, checked_at):
    target_key = normalize(target)
    exact = next((row for row in rows if normalize(row.get("keyword", "")) == target_key), None)
    related = [_related_row(row) for row in rows if row is not exact][:20]
    if not attempted:
        return {
            "status": "NOT_ATTEMPTED_AFTER_SOURCE_FAILURE",
            "source": "NAVER_SEARCH_ADS",
            "unit": "MONTHLY_SEARCHES",
            "checkedAt": checked_at,
            "exactTargetReturned": False,
            "monthlyPc": None,
            "monthlyMobile": None,
            "monthlyTotal": None,
            "competition": None,
            "volumeNote": None,
            "relatedRows": related,
        }
    if exact is None:
        return {
            "status": "TARGET_ROW_NOT_RETURNED",
            "source": "NAVER_SEARCH_ADS",
            "unit": "MONTHLY_SEARCHES",
            "checkedAt": checked_at,
            "exactTargetReturned": False,
            "monthlyPc": None,
            "monthlyMobile": None,
            "monthlyTotal": None,
            "competition": None,
            "volumeNote": None,
            "relatedRows": related,
        }

    note = exact.get("volume_note") or None
    pc = exact.get("monthly_pc")
    mobile = exact.get("monthly_mobile")
    # The existing collector can compute a lower-bound total when one side is
    # censored. Do not present that partial sum as an exact monthly total.
    total = exact.get("monthly_total") if note not in {"LOWER_BOUND_CENSORED", "MISSING"} else None
    if note == "LOWER_BOUND_CENSORED":
        status = "CENSORED"
    elif note == "MISSING" or pc is None or mobile is None or total is None:
        status = "METRIC_MISSING"
    else:
        status = "VERIFIED"
    return {
        "status": status,
        "source": "NAVER_SEARCH_ADS",
        "unit": "MONTHLY_SEARCHES",
        "checkedAt": checked_at,
        "exactTargetReturned": True,
        "monthlyPc": pc,
        "monthlyMobile": mobile,
        "monthlyTotal": total,
        "competition": exact.get("competition"),
        "volumeNote": note,
        "relatedRows": related,
    }


def _data_lab_record(target, trends, checked_at):
    value = trends.get(target)
    if value is None:
        return {
            "status": "NO_VALIDATED_TREND",
            "source": "NAVER_DATALAB",
            "checkedAt": checked_at,
            "metricType": "RELATIVE_INTEREST_CHANGE_PERCENT",
            "trend1m": None,
            "trend3m": None,
            "trendMomentum": None,
            "seasonality": None,
        }
    trend1m = value.get("trend_1m")
    trend3m = value.get("trend_3m")
    return {
        "status": "VERIFIED" if trend1m is not None or trend3m is not None else "NO_VALIDATED_TREND",
        "source": "NAVER_DATALAB",
        "checkedAt": checked_at,
        "metricType": "RELATIVE_INTEREST_CHANGE_PERCENT",
        "trend1m": trend1m,
        "trend3m": trend3m,
        "trendMomentum": value.get("trend_momentum"),
        "seasonality": value.get("seasonality"),
    }


def run_targeted(root, raw_targets, *, client, run_at=None, run_id="local"):
    """Collect targeted signals and preserve last-good output on any API error."""
    root = Path(root)
    targets = parse_targets(raw_targets)
    run_at = run_at or datetime.now(KST)
    if run_at.tzinfo is None:
        run_at = run_at.replace(tzinfo=KST)
    checked_at = run_at.astimezone(KST).isoformat(timespec="seconds")

    search_rows = {}
    search_attempted = {}
    for target in targets:
        if client.statuses["NAVER_SEARCH_ADS"] in FATAL_SOURCE_STATES:
            search_rows[target] = []
            search_attempted[target] = False
            continue
        before = len(client.errors)
        search_rows[target] = client.related(target)
        search_attempted[target] = not any(
            error.get("source") == "NAVER_SEARCHAD" for error in client.errors[before:]
        )

    trends = client.trends(targets, run_at.date())

    web_results = {}
    for target in targets:
        if client.statuses["NAVER_WEB_SEARCH"] in FATAL_SOURCE_STATES:
            web_results[target] = None
            continue
        web_results[target] = client.web_result_count(target)

    targets_data = []
    for target in targets:
        result_count = web_results[target]
        targets_data.append({
            "keyword": target,
            "searchAds": _search_ads_record(target, search_rows[target], search_attempted[target], checked_at),
            "dataLab": _data_lab_record(target, trends, checked_at),
            "webSearch": {
                "status": "VERIFIED" if result_count is not None else "UNVERIFIED",
                "source": "NAVER_WEB_SEARCH",
                "checkedAt": checked_at,
                "metricType": "WEB_RESULT_COUNT_NOT_DEMAND",
                "resultCount": result_count,
            },
        })

    service_statuses = {
        "NAVER_SEARCH_ADS": client.statuses["NAVER_SEARCH_ADS"],
        "NAVER_DATALAB": client.statuses["NAVER_DATALAB"],
        "NAVER_WEB_SEARCH": client.statuses["NAVER_WEB_SEARCH"],
    }
    complete = all(value == "OK" for value in service_statuses.values())
    result = {
        "schemaVersion": 1,
        "mode": "targeted_measurement",
        "status": "VERIFIED" if complete else "PARTIAL",
        "checkedAt": checked_at,
        "targetCount": len(targets),
        "sourceStatuses": service_statuses,
        "apiCalls": {
            "total": client.calls,
            "dataLab": client.datalab_calls,
            "webSearch": client.web_result_calls,
        },
        "targets": targets_data,
        "errors": _safe_errors(client),
        "limitations": [
            "DataLab values are relative interest changes, not monthly search volume.",
            "Web Search result count is not demand or search volume.",
            "Related Search Ads rows are not substituted for a missing exact target row.",
            "No missing metric is converted to zero.",
        ],
    }

    run_key = re.sub(r"[^A-Za-z0-9-]+", "-", str(run_id)).strip("-") or "local"
    report_path = root / "reports" / "keyword-targeted-validation" / f"{run_key}.json"
    atomic(report_path, json_text(result))

    latest_path = root / "data" / "keyword-targeted-validation" / "latest.json"
    if complete:
        atomic(latest_path, json_text(result))
        result["latestWritten"] = True
    else:
        result["latestWritten"] = False
    result["reportPath"] = str(report_path.relative_to(root))
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".")
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    raw_targets = os.environ.get("KEYWORD_HUNTER_TARGETS_JSON", "")
    config = dict(DEFAULT_CONFIG)
    usage = DataLabUsage(root)
    client = Client(config, usage_tracker=usage)
    result = run_targeted(
        root,
        raw_targets,
        client=client,
        run_id=os.environ.get("KEYWORD_HUNTER_RUN_ID", "local"),
    )
    print(json.dumps({
        "status": result["status"],
        "latestWritten": result["latestWritten"],
        "reportPath": result["reportPath"],
        "targetCount": result["targetCount"],
        "sourceStatuses": result["sourceStatuses"],
    }, ensure_ascii=False, sort_keys=True))
    return 0 if result["status"] == "VERIFIED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
