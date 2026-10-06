#!/usr/bin/env python3
"""Collect a normalized, source-labeled AdSense Management API v2 snapshot."""

import argparse
import json
import os
import re
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


API_BASE = "https://adsense.googleapis.com/v2"
OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
OAUTH_SCOPE = "https://www.googleapis.com/auth/adsense.readonly"
API_VERSION = "v2"
SITE_DOMAIN = "emfls.github.io"
SITE_DIMENSIONS = ("DATE", "OWNED_SITE_DOMAIN_NAME")
PAGE_URL_DIMENSIONS = ("PAGE_URL",)
METRICS = (
    "ESTIMATED_EARNINGS",
    "PAGE_VIEWS",
    "PAGE_VIEWS_RPM",
    "IMPRESSIONS",
    "CLICKS",
    "COST_PER_CLICK",
)
REPORT_LIMIT = 10000
METRIC_KEYS = {
    "ESTIMATED_EARNINGS": "estimatedEarnings",
    "PAGE_VIEWS": "pageViews",
    "PAGE_VIEWS_RPM": "pageViewsRPM",
    "IMPRESSIONS": "impressions",
    "CLICKS": "clicks",
    "COST_PER_CLICK": "costPerClick",
}
INTEGER_METRICS = {"PAGE_VIEWS", "IMPRESSIONS", "CLICKS", "AD_REQUESTS", "MATCHED_AD_REQUESTS"}
ADDITIVE_METRICS = {"ESTIMATED_EARNINGS", "PAGE_VIEWS", "IMPRESSIONS", "CLICKS"}
REQUIRED_SITE_METRICS = {"ESTIMATED_EARNINGS", "PAGE_VIEWS", "IMPRESSIONS", "CLICKS"}
BREAKDOWN_METRICS = (
    *METRICS,
    "AD_REQUESTS",
    "MATCHED_AD_REQUESTS",
    "AD_REQUESTS_COVERAGE",
    "ACTIVE_VIEW_VIEWABILITY",
)
BREAKDOWN_METRIC_KEYS = {
    **METRIC_KEYS,
    "AD_REQUESTS": "adRequests",
    "MATCHED_AD_REQUESTS": "matchedAdRequests",
    "AD_REQUESTS_COVERAGE": "adRequestsCoverage",
    "ACTIVE_VIEW_VIEWABILITY": "activeViewViewability",
}
BREAKDOWN_ADDITIVE_METRICS = {
    "ESTIMATED_EARNINGS", "PAGE_VIEWS", "IMPRESSIONS", "CLICKS",
    "AD_REQUESTS", "MATCHED_AD_REQUESTS",
}
BREAKDOWN_DIMENSIONS = {
    "country": ("DATE", "COUNTRY_NAME"),
    "platformType": ("DATE", "PLATFORM_TYPE_NAME"),
    "adFormat": ("DATE", "AD_FORMAT_NAME"),
}
BREAKDOWN_DIMENSION_KEYS = {
    "DATE": "date",
    "COUNTRY_NAME": "country",
    "PLATFORM_TYPE_NAME": "platformType",
    "AD_FORMAT_NAME": "adFormat",
}
BREAKDOWN_REPORT_STATUSES = {"COMPLETE", "PARTIAL", "NOT_AVAILABLE", "UNSUPPORTED_COMBINATION"}
BREAKDOWN_ROW_LIMIT = 4000
BREAKDOWN_MAX_PERIOD_DAYS = 7
PAGE_URL_UNAVAILABLE_MESSAGE = "The combination of requested dimensions is unavailable."
PAGE_URL_UNAVAILABLE_CLASSIFICATION = "PAGE_URL_DIMENSION_COMBINATION_UNAVAILABLE"


class CollectorError(Exception):
    """A safe-to-log collection or schema error."""


class GoogleAPIError(CollectorError):
    """Safe structured details for one failed Google API request."""

    def __init__(self, *, stage, http_status, google_status=None, safe_message=None, classification=None):
        self.stage = stage
        self.http_status = http_status
        self.google_status = google_status
        self.safe_message = safe_message
        self.classification = classification
        status = f"; {google_status}" if google_status else ""
        if safe_message:
            super().__init__(f"Google API request failed at {stage} (HTTP {http_status}{status}): {safe_message}")
        else:
            super().__init__(f"Google API request failed at {stage} (HTTP {http_status}{status}).")


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("data/performance/adsense-latest.json"))
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--validate-only", type=Path)
    parser.add_argument("--breakdown-output", type=Path)
    parser.add_argument("--validate-breakdown-only", type=Path)
    return parser


def _as_utc(now=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise CollectorError("Collection time must include a timezone.")
    return now.astimezone(timezone.utc)


def build_periods(now, reporting_time_zone, *, days=7):
    if not isinstance(days, int) or days < 1:
        raise CollectorError("The report period must include at least one day.")
    try:
        local_now = _as_utc(now).astimezone(ZoneInfo(reporting_time_zone))
    except (ZoneInfoNotFoundError, TypeError, ValueError):
        raise CollectorError("The AdSense account reporting timezone is unavailable.") from None
    current_end = local_now.date() - timedelta(days=1)
    current_start = current_end - timedelta(days=days - 1)
    prior_end = current_start - timedelta(days=1)
    prior_start = prior_end - timedelta(days=days - 1)
    return (
        {"start": current_start.isoformat(), "end": current_end.isoformat(), "days": days, "inclusive": True},
        {"start": prior_start.isoformat(), "end": prior_end.isoformat(), "days": days, "inclusive": True},
    )


def comparison_status(current, prior):
    """Return VERIFIED only when every comparison contract field agrees."""
    fields = ("site", "timeZone", "currency", "dimensions", "metrics", "days")
    if not current or not prior:
        return "NOT_AVAILABLE"
    if any(current.get(field) is None or current.get(field) != prior.get(field) for field in fields):
        return "NOT_AVAILABLE"
    if not current.get("currency"):
        return "NOT_AVAILABLE"
    return "VERIFIED"


def _date_from_api(value):
    if not isinstance(value, dict):
        raise CollectorError("AdSense returned an invalid report date.")
    try:
        return date(int(value["year"]), int(value["month"]), int(value["day"])).isoformat()
    except (KeyError, TypeError, ValueError):
        raise CollectorError("AdSense returned an invalid report date.") from None


def _number(value, metric):
    if value in (None, ""):
        return None
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise CollectorError("AdSense returned a non-numeric report value.") from None
    if not number.is_finite():
        raise CollectorError("AdSense returned a non-finite report value.")
    if metric in INTEGER_METRICS and number == number.to_integral_value():
        return int(number)
    return float(number)


def _parse_cells(row, headers, *, stage):
    cells = row.get("cells") if isinstance(row, dict) else None
    if not isinstance(cells, list) or len(cells) != len(headers):
        raise CollectorError(f"{stage}: AdSense returned a report row with an unexpected shape.")
    if any(cell is not None and not isinstance(cell, dict) for cell in cells):
        raise CollectorError(f"{stage}: AdSense returned a report row with an unexpected shape.")
    return {header["name"]: (cell or {}).get("value") for header, cell in zip(headers, cells)}


def _currency(headers):
    values = {
        header.get("currencyCode")
        for header in headers
        if header.get("type") == "METRIC_CURRENCY"
    }
    values.discard(None)
    values.discard("")
    return next(iter(values)) if len(values) == 1 else None


def _parse_report(report, dimensions, expected_period, *, stage, metrics=METRICS):
    if not isinstance(report, dict):
        raise CollectorError(f"{stage}: AdSense returned an invalid report response.")
    headers = report.get("headers")
    expected_headers = [*dimensions, *metrics]
    if (
        not isinstance(headers, list)
        or any(not isinstance(item, dict) for item in headers)
        or [item.get("name") for item in headers] != expected_headers
    ):
        raise CollectorError(f"{stage}: AdSense report headers do not match the requested dimensions and metrics.")
    try:
        start = _date_from_api(report.get("startDate"))
        end = _date_from_api(report.get("endDate"))
    except CollectorError as error:
        raise CollectorError(f"{stage}: {error}") from None
    if start != expected_period["start"] or end != expected_period["end"]:
        raise CollectorError(f"{stage}: AdSense report dates do not match the requested inclusive period.")
    rows = report["rows"] if "rows" in report else []
    if not isinstance(rows, list):
        raise CollectorError(f"{stage}: AdSense report rows must be a list when present.")
    total_raw = report.get("totalMatchedRows")
    try:
        if total_raw is not None and (isinstance(total_raw, bool) or not isinstance(total_raw, (int, str))):
            raise ValueError
        total_matched = int(total_raw) if total_raw is not None else None
    except (TypeError, ValueError):
        raise CollectorError(f"{stage}: AdSense report totalMatchedRows is invalid.") from None
    if total_matched is not None and total_matched < len(rows):
        raise CollectorError(f"{stage}: AdSense report row count is inconsistent.")
    parsed_rows = [_parse_cells(row, headers, stage=stage) for row in rows]
    totals_row = report.get("totals")
    totals = _parse_cells(totals_row, headers, stage=stage) if totals_row else {}
    warnings = report.get("warnings") or []
    if not isinstance(warnings, list):
        warnings = ["AdSense returned report warnings in an unknown format."]
    return {
        "dimensions": list(dimensions),
        "metrics": list(metrics),
        "period": {"start": start, "end": end},
        "currency": _currency(headers),
        "rows": parsed_rows,
        "rowCount": len(parsed_rows),
        "totalMatchedRows": total_matched,
        "truncationStatus": (
            "NOT_AVAILABLE" if total_matched is None
            else "TRUNCATED" if total_matched > len(parsed_rows)
            else "NOT_TRUNCATED"
        ),
        "totals": totals,
        "warnings": [str(item) for item in warnings],
    }


def _report_metrics(report):
    result = {}
    totals = report["totals"]
    for metric, key in METRIC_KEYS.items():
        value = _number(totals.get(metric), metric)
        if value is None and metric in ADDITIVE_METRICS and report["rows"]:
            row_values = [_number(row.get(metric), metric) for row in report["rows"]]
            if all(item is not None for item in row_values):
                value = sum(row_values)
        result[key] = value
    return result


def _page_url_rows(report):
    parsed_rows = []
    offsite_rows = 0
    for row in report["rows"]:
        url = str(row.get("PAGE_URL") or "").strip()
        if not url:
            continue
        try:
            hostname = urlsplit(url).hostname
        except ValueError:
            hostname = None
        if hostname != SITE_DOMAIN:
            offsite_rows += 1
            continue
        parsed = {
            "url": url,
            **{
                METRIC_KEYS[metric]: _number(row.get(metric), metric)
                for metric in METRICS
            },
            "revenueMetric": "ESTIMATED_EARNINGS",
            "source": "DIRECT_ADSENSE_PAGE_URL",
            "status": "VERIFIED",
            "coverageStatus": "PARTIAL",
        }
        parsed_rows.append(parsed)
    return parsed_rows, offsite_rows


def _delta(current, prior):
    absolute = {}
    relative = {}
    for key in METRIC_KEYS.values():
        left, right = current.get(key), prior.get(key)
        change = left - right if left is not None and right is not None else None
        absolute[key] = round(change, 8) if change is not None else None
        relative[key] = round(change / right, 8) if change is not None and right != 0 else None
    return absolute, relative


def _report_has_required_values(metrics):
    return all(metrics.get(METRIC_KEYS[name]) is not None for name in REQUIRED_SITE_METRICS)


def build_snapshot(
    *,
    account_name,
    account,
    current_report,
    prior_report,
    page_url_report,
    page_url_unavailable_reason=None,
    page_url_unavailable_warning=None,
    now=None,
    generated_at=None,
    days=7,
):
    if account_name != (account or {}).get("name"):
        raise CollectorError("The AdSense account response does not match ADSENSE_ACCOUNT_NAME.")
    time_zone = ((account or {}).get("timeZone") or {}).get("id")
    if not time_zone:
        raise CollectorError("The AdSense account timezone is unavailable.")
    current_period, prior_period = build_periods(now or datetime.now(timezone.utc), time_zone, days=days)
    current = _parse_report(
        current_report,
        SITE_DIMENSIONS,
        current_period,
        stage="SITE_CURRENT_REPORT_PARSE",
    )
    if not current["rows"]:
        raise CollectorError("SITE_CURRENT_REPORT_EMPTY: AdSense returned no site report rows; keeping the existing snapshot.")
    prior = _parse_report(
        prior_report,
        SITE_DIMENSIONS,
        prior_period,
        stage="SITE_PRIOR_REPORT_PARSE",
    )
    if not prior["rows"]:
        raise CollectorError("SITE_PRIOR_REPORT_EMPTY: AdSense returned no site report rows; keeping the existing snapshot.")
    if page_url_report is None:
        if page_url_unavailable_reason != PAGE_URL_UNAVAILABLE_CLASSIFICATION:
            raise CollectorError("Unavailable PAGE_URL evidence requires a recognized Google report classification.")
        page_urls_report = None
    else:
        if page_url_unavailable_reason is not None:
            raise CollectorError("A PAGE_URL report cannot be both available and unavailable.")
        page_urls_report = _parse_report(
            page_url_report,
            PAGE_URL_DIMENSIONS,
            current_period,
            stage="PAGE_URL_REPORT_PARSE",
        )

    current_sites = {row.get("OWNED_SITE_DOMAIN_NAME") for row in current["rows"]}
    prior_sites = {row.get("OWNED_SITE_DOMAIN_NAME") for row in prior["rows"]}
    site_matches = current_sites == {SITE_DOMAIN} and prior_sites == {SITE_DOMAIN}
    current_metrics = _report_metrics(current)
    prior_metrics = _report_metrics(prior)
    base_contract = {
        "site": SITE_DOMAIN,
        "timeZone": time_zone,
        "dimensions": list(SITE_DIMENSIONS),
        "metrics": list(METRICS),
        "days": days,
    }
    current_contract = {**base_contract, "currency": current["currency"] if site_matches else "SITE_MISMATCH"}
    prior_contract = {**base_contract, "currency": prior["currency"] if site_matches else "SITE_MISMATCH"}
    contract_status = comparison_status(current_contract, prior_contract) if site_matches else "NOT_AVAILABLE"

    warnings = [*current["warnings"], *prior["warnings"]]
    if page_urls_report is not None:
        warnings.extend(page_urls_report["warnings"])
    elif page_url_unavailable_warning:
        warnings.append(f"PAGE_URL report unavailable: {page_url_unavailable_warning}")
    if not site_matches:
        warnings.append("The returned site dimension did not match the requested site.")
    if not current["currency"] or not prior["currency"]:
        warnings.append("A report currency code was unavailable.")
    if current["truncationStatus"] == "TRUNCATED" or prior["truncationStatus"] == "TRUNCATED":
        warnings.append("A site-level report was truncated.")

    site_status = contract_status
    if site_status == "VERIFIED" and (
        current["truncationStatus"] != "NOT_TRUNCATED"
        or prior["truncationStatus"] != "NOT_TRUNCATED"
        or current["warnings"]
        or prior["warnings"]
        or not _report_has_required_values(current_metrics)
        or not _report_has_required_values(prior_metrics)
    ):
        site_status = "PARTIAL"

    current_metrics["currency"] = current["currency"]
    prior_metrics["currency"] = prior["currency"]
    if site_status == "VERIFIED":
        absolute_delta, relative_delta = _delta(current_metrics, prior_metrics)
    else:
        absolute_delta = {key: None for key in METRIC_KEYS.values()}
        relative_delta = {key: None for key in METRIC_KEYS.values()}
    matched_currency = current["currency"] if contract_status == "VERIFIED" else None

    page_rows, offsite_rows = _page_url_rows(page_urls_report) if page_urls_report is not None else ([], 0)
    if offsite_rows:
        warnings.append(f"Ignored {offsite_rows} PAGE_URL rows outside {SITE_DOMAIN}.")
    page_currency_matches = bool(
        page_urls_report is not None
        and matched_currency
        and page_urls_report["currency"] == matched_currency
    )
    if not page_currency_matches and page_rows:
        warnings.append("PAGE_URL report currency did not match the site-level report; URL rows were omitted.")
        page_rows = []
    total_matched_rows = page_urls_report["totalMatchedRows"] if page_urls_report is not None else None
    page_url_status = page_urls_report["truncationStatus"] if page_urls_report is not None else "NOT_AVAILABLE"
    snapshot_time = _as_utc(now or datetime.now(timezone.utc))
    generated_at = generated_at or snapshot_time.isoformat(timespec="seconds").replace("+00:00", "Z")

    snapshot = {
        "schemaVersion": 1,
        "source": "DIRECT_ADSENSE_MANAGEMENT_API_V2",
        "sourceStatus": site_status,
        "generatedAt": generated_at,
        "account": {"name": account_name},
        "site": {
            "domain": SITE_DOMAIN,
            "status": site_status,
            "comparisonStatus": contract_status if site_matches else "NOT_AVAILABLE",
            "dimensions": list(SITE_DIMENSIONS),
            "metrics": list(METRICS),
            "current": current_metrics,
            "prior": prior_metrics,
            "absoluteDelta": absolute_delta,
            "relativeDelta": relative_delta,
            "reportRowCounts": {
                "currentReturned": current["rowCount"],
                "currentMatched": current["totalMatchedRows"],
                "priorReturned": prior["rowCount"],
                "priorMatched": prior["totalMatchedRows"],
            },
        },
        "currency": matched_currency,
        "reportingTimeZone": {"mode": "ACCOUNT_TIME_ZONE", "id": time_zone},
        "currentPeriod": current_period,
        "priorPeriod": prior_period,
        "pageUrls": {
            "period": current_period,
            "source": "DIRECT_ADSENSE_PAGE_URL",
            "coverageStatus": "PARTIAL" if page_urls_report is not None else "NOT_AVAILABLE",
            "coverageCaveat": "PAGE_URL includes only eligible pages meeting AdSense impression thresholds; a missing URL is NOT_AVAILABLE, not zero.",
            "rows": page_rows,
            "returnedRowCount": page_urls_report["rowCount"] if page_urls_report is not None else 0,
            "totalMatchedRows": total_matched_rows,
            "truncationStatus": page_url_status,
            "warnings": (
                (page_urls_report["warnings"] if page_urls_report is not None else [page_url_unavailable_warning] if page_url_unavailable_warning else [])
                + (["Some returned PAGE_URL rows were outside the target site."] if offsite_rows else [])
            ),
            **({"unavailableReason": page_url_unavailable_reason} if page_urls_report is None else {}),
        },
        "collector": {
            "apiVersion": API_VERSION,
            "sourceStatus": site_status,
            "scheduleTimeZone": "UTC",
            "warnings": warnings,
            "pageUrlRowLimit": REPORT_LIMIT,
        },
    }
    return snapshot


def unavailable_breakdown_report(dimensions, status="NOT_AVAILABLE", reason="NOT_AVAILABLE", warnings=()):
    if status not in {"NOT_AVAILABLE", "UNSUPPORTED_COMBINATION"}:
        raise CollectorError("Unavailable breakdown status is invalid.")
    return {
        "dimensions": list(dimensions),
        "metrics": list(BREAKDOWN_METRICS),
        "status": status,
        "availabilityReason": reason,
        "currency": None,
        "rows": [],
        "rowCount": 0,
        "totalMatchedRows": None,
        "truncationStatus": "NOT_AVAILABLE",
        "totals": {},
        "warnings": [str(item) for item in warnings],
    }


def _breakdown_report(report, dimensions, expected_period, *, stage, daily=False, failure=None):
    if failure:
        result = unavailable_breakdown_report(
            dimensions,
            failure.get("status", "NOT_AVAILABLE"),
            failure.get("reason", "API_ERROR"),
            failure.get("warnings", ()),
        )
        if daily:
            lower, upper = date.fromisoformat(expected_period["start"]), date.fromisoformat(expected_period["end"])
            result["missingDates"] = [
                (lower + timedelta(days=offset)).isoformat()
                for offset in range((upper - lower).days + 1)
            ]
        return result
    if report is None:
        return _breakdown_report(
            None,
            dimensions,
            expected_period,
            stage=stage,
            daily=daily,
            failure={"reason": "NOT_AVAILABLE"},
        ) if daily else unavailable_breakdown_report(dimensions)
    parsed = _parse_report(
        report,
        dimensions,
        expected_period,
        stage=stage,
        metrics=BREAKDOWN_METRICS,
    )
    lower, upper = date.fromisoformat(expected_period["start"]), date.fromisoformat(expected_period["end"])
    rows = []
    keys = set()
    seen_dates = set()
    for source_row in parsed["rows"]:
        row = {}
        for dimension in dimensions:
            field = BREAKDOWN_DIMENSION_KEYS[dimension]
            value = source_row.get(dimension)
            if dimension == "DATE":
                try:
                    row_date = date.fromisoformat(value)
                except (TypeError, ValueError):
                    raise CollectorError(f"{stage}: AdSense returned an invalid DATE dimension.") from None
                if row_date < lower or row_date > upper:
                    raise CollectorError(f"{stage}: AdSense returned a DATE outside the requested period.")
                value = row_date.isoformat()
                if daily and value in seen_dates:
                    raise CollectorError(f"{stage}: AdSense returned duplicate daily dates.")
                if daily:
                    seen_dates.add(value)
            elif value == "":
                value = None
            row[field] = value
        for metric in BREAKDOWN_METRICS:
            row[BREAKDOWN_METRIC_KEYS[metric]] = _number(source_row.get(metric), metric)
        key = tuple(row.get(BREAKDOWN_DIMENSION_KEYS[item]) for item in dimensions)
        if key in keys:
            raise CollectorError(f"{stage}: AdSense returned duplicate breakdown rows.")
        keys.add(key)
        rows.append(row)

    totals = {
        BREAKDOWN_METRIC_KEYS[metric]: _number(parsed["totals"].get(metric), metric)
        for metric in BREAKDOWN_METRICS
    }
    missing_dates = []
    if daily:
        expected_dates = {
            (lower + timedelta(days=offset)).isoformat()
            for offset in range((upper - lower).days + 1)
        }
        missing_dates = sorted(expected_dates - seen_dates)
    warnings = list(parsed["warnings"])
    status = "COMPLETE"
    if (
        parsed["totalMatchedRows"] is None
        or parsed["totalMatchedRows"] != parsed["rowCount"]
        or parsed["currency"] is None
        or not rows
        or warnings
        or missing_dates
        or any(value is None for row in rows for value in (row.get(BREAKDOWN_METRIC_KEYS[metric]) for metric in BREAKDOWN_METRICS))
        or any(value is None for row in rows for value in (row.get(BREAKDOWN_DIMENSION_KEYS[item]) for item in dimensions if item != "DATE"))
    ):
        status = "PARTIAL"
    result = {
        "dimensions": list(dimensions),
        "metrics": list(BREAKDOWN_METRICS),
        "status": status,
        "currency": parsed["currency"],
        "rows": rows,
        "rowCount": parsed["rowCount"],
        "totalMatchedRows": parsed["totalMatchedRows"],
        "truncationStatus": parsed["truncationStatus"],
        "totals": totals,
        "warnings": warnings,
    }
    if daily:
        result["missingDates"] = missing_dates
    return result


def _metric_totals_match(actual, expected, metric):
    if actual is None or expected is None:
        return False
    tolerance = Decimal("0.01") if metric == "ESTIMATED_EARNINGS" else Decimal("0")
    return abs(Decimal(str(actual)) - Decimal(str(expected))) <= tolerance


def _daily_row_aggregate_check(daily):
    checks = {}
    rows_complete = (
        daily.get("totalMatchedRows") == daily.get("rowCount")
        and daily.get("truncationStatus") == "NOT_TRUNCATED"
        and not daily.get("missingDates")
        and not daily.get("warnings")
    )
    for metric in BREAKDOWN_METRICS:
        key = BREAKDOWN_METRIC_KEYS[metric]
        if metric not in BREAKDOWN_ADDITIVE_METRICS:
            checks[key] = {"status": "NON_ADDITIVE"}
            continue
        values = [row.get(key) for row in daily["rows"]]
        reported = daily["totals"].get(key)
        if not rows_complete or not values or any(value is None for value in values) or reported is None:
            checks[key] = {"status": "NOT_AVAILABLE"}
            continue
        total = sum(values)
        checks[key] = {
            "status": "MATCH" if _metric_totals_match(total, reported, metric) else "MISMATCH",
            "dailyTotal": total,
            "reportedTotal": reported,
        }
    return checks


def _aggregate_reconciliation(daily, snapshot, current_period, prior_period):
    result = {"status": "NOT_AVAILABLE", "current": {}, "prior": {}}
    eligible = not (
        daily.get("totalMatchedRows") != daily.get("rowCount")
        or daily.get("truncationStatus") != "NOT_TRUNCATED"
        or daily.get("warnings")
        or snapshot.get("site", {}).get("comparisonStatus") != "VERIFIED"
        or not snapshot.get("currency")
        or daily.get("currency") != snapshot.get("currency")
    )
    for label, period, snapshot_key in (
        ("prior", prior_period, "prior"),
        ("current", current_period, "current"),
    ):
        dates = {
            (date.fromisoformat(period["start"]) + timedelta(days=offset)).isoformat()
            for offset in range(period["days"])
        }
        rows = [row for row in daily["rows"] if row["date"] in dates]
        complete_dates = {row["date"] for row in rows} == dates and len(rows) == len(dates)
        for metric in sorted(BREAKDOWN_ADDITIVE_METRICS):
            key = BREAKDOWN_METRIC_KEYS[metric]
            daily_values = [row.get(key) for row in rows]
            source_value = (snapshot.get("site", {}).get(snapshot_key) or {}).get(key)
            if (
                not eligible
                or not complete_dates
                or any(value is None for value in daily_values)
                or source_value is None
            ):
                check = {"status": "NOT_AVAILABLE"}
            else:
                total = sum(daily_values)
                check = {
                    "status": "MATCH" if _metric_totals_match(total, source_value, metric) else "MISMATCH",
                    "dailyTotal": total,
                    "siteAggregate": source_value,
                }
            result[label][key] = check
    statuses = [
        check["status"]
        for period_name in ("current", "prior")
        for check in result[period_name].values()
    ]
    if any(status == "MISMATCH" for status in statuses):
        result["status"] = "PARTIAL"
    elif statuses and all(status == "MATCH" for status in statuses):
        result["status"] = "VERIFIED"
    return result


def build_breakdown_snapshot(
    *,
    account_name,
    account,
    snapshot,
    daily_report,
    breakdown_reports,
    generated_at=None,
    days=7,
    failures=None,
):
    if account_name != (account or {}).get("name") or account_name != (snapshot.get("account") or {}).get("name"):
        raise CollectorError("The AdSense account response does not match the breakdown snapshot account.")
    time_zone = ((account or {}).get("timeZone") or {}).get("id")
    if not time_zone or time_zone != (snapshot.get("reportingTimeZone") or {}).get("id"):
        raise CollectorError("The AdSense account timezone does not match the breakdown snapshot.")
    current_period = snapshot["currentPeriod"]
    prior_period = snapshot["priorPeriod"]
    if current_period.get("days") != days or prior_period.get("days") != days:
        raise CollectorError("Breakdown snapshot periods do not match the requested comparison window.")
    if days > BREAKDOWN_MAX_PERIOD_DAYS:
        raise CollectorError("Breakdown snapshot exceeds its bounded comparison window.")
    report_period = {
        "start": prior_period["start"],
        "end": current_period["end"],
        "days": prior_period["days"] + current_period["days"],
        "inclusive": True,
    }
    failures = failures or {}
    daily = _breakdown_report(
        daily_report,
        ("DATE",),
        report_period,
        stage="DAILY_REPORT_PARSE",
        daily=True,
        failure=failures.get("daily"),
    )
    breakdowns = {}
    for name, dimensions in BREAKDOWN_DIMENSIONS.items():
        breakdowns[name] = _breakdown_report(
            (breakdown_reports or {}).get(name),
            dimensions,
            report_period,
            stage=f"{name.upper()}_REPORT_PARSE",
            failure=failures.get(name),
        )
    breakdowns["platformTypeAdFormat"] = unavailable_breakdown_report(
        ("DATE", "PLATFORM_TYPE_NAME", "AD_FORMAT_NAME"),
        "NOT_AVAILABLE",
        "NOT_PROBED_ACTUAL_API_COMPATIBILITY",
    )

    currencies = {
        report["currency"]
        for report in (daily, *breakdowns.values())
        if report.get("currency")
    }
    warnings = []
    for report in (daily, *breakdowns.values()):
        for warning in report.get("warnings", []):
            if warning not in warnings:
                warnings.append(warning)
    if len(currencies) > 1:
        warnings.append("Breakdown reports returned different currencies; cross-report comparisons are unavailable.")
        for report in (daily, *breakdowns.values()):
            if report.get("currency") and report["currency"] != daily.get("currency") and report["status"] == "COMPLETE":
                report["status"] = "PARTIAL"
                report["warnings"].append("Report currency differs from the daily report currency.")

    daily["rowAggregateCheck"] = _daily_row_aggregate_check(daily)
    if any(check["status"] == "MISMATCH" for check in daily["rowAggregateCheck"].values()):
        daily["status"] = "PARTIAL"
        warning = "Daily additive row sums did not match the report totals."
        daily["warnings"].append(warning)
        warnings.append(warning)
    aggregate_reconciliation = _aggregate_reconciliation(daily, snapshot, current_period, prior_period)
    if aggregate_reconciliation["status"] == "PARTIAL":
        warnings.append("Daily rows did not reconcile to the existing site aggregate for every additive metric.")

    artifact = {
        "schemaVersion": 1,
        "source": "DIRECT_ADSENSE_MANAGEMENT_API_V2",
        "generatedAt": generated_at or snapshot["generatedAt"],
        "account": {"name": account_name},
        "site": SITE_DOMAIN,
        "currency": daily.get("currency"),
        "currencyStatus": "NOT_AVAILABLE" if not daily.get("currency") else "VERIFIED" if len(currencies) <= 1 else "PARTIAL",
        "reportingTimeZone": {"mode": "ACCOUNT_TIME_ZONE", "id": time_zone},
        "currentPeriod": current_period,
        "priorPeriod": prior_period,
        "range": {"start": prior_period["start"], "end": current_period["end"], "days": report_period["days"], "inclusive": True},
        "metrics": list(BREAKDOWN_METRICS),
        "coverageStatus": daily["status"],
        "daily": daily,
        "breakdowns": breakdowns,
        "aggregateReconciliation": aggregate_reconciliation,
        "rowCounts": {"daily": daily["rowCount"], **{name: row["rowCount"] for name, row in breakdowns.items()}},
        "warnings": warnings,
        "collector": {"apiVersion": API_VERSION, "reportRowLimit": BREAKDOWN_ROW_LIMIT},
    }
    validate_breakdown_snapshot(artifact)
    return artifact


def validate_breakdown_snapshot(snapshot):
    if not isinstance(snapshot, dict) or snapshot.get("schemaVersion") != 1:
        raise CollectorError("Breakdown snapshot schemaVersion must be 1.")
    if snapshot.get("source") != "DIRECT_ADSENSE_MANAGEMENT_API_V2":
        raise CollectorError("Breakdown snapshot source is invalid.")
    if not isinstance(snapshot.get("generatedAt"), str) or not snapshot["generatedAt"]:
        raise CollectorError("Breakdown snapshot generatedAt is required.")
    if not str((snapshot.get("account") or {}).get("name") or "").startswith("accounts/pub-"):
        raise CollectorError("Breakdown snapshot account resource name is invalid.")
    if snapshot.get("site") != SITE_DOMAIN or snapshot.get("metrics") != list(BREAKDOWN_METRICS):
        raise CollectorError("Breakdown snapshot site or metric metadata is invalid.")
    timezone_id = (snapshot.get("reportingTimeZone") or {}).get("id")
    if not timezone_id or (snapshot.get("reportingTimeZone") or {}).get("mode") != "ACCOUNT_TIME_ZONE":
        raise CollectorError("Breakdown snapshot reporting timezone is invalid.")
    try:
        ZoneInfo(timezone_id)
    except (ZoneInfoNotFoundError, TypeError, ValueError):
        raise CollectorError("Breakdown snapshot reporting timezone is invalid.") from None
    current_period, prior_period = snapshot.get("currentPeriod") or {}, snapshot.get("priorPeriod") or {}
    for period in (current_period, prior_period):
        try:
            start, end, day_count = date.fromisoformat(period["start"]), date.fromisoformat(period["end"]), int(period["days"])
        except (KeyError, TypeError, ValueError):
            raise CollectorError("Breakdown snapshot period metadata is invalid.") from None
        if period.get("inclusive") is not True or end < start or (end - start).days + 1 != day_count or day_count > BREAKDOWN_MAX_PERIOD_DAYS:
            raise CollectorError("Breakdown snapshot periods must be inclusive and match their day counts.")
    if date.fromisoformat(prior_period["end"]) + timedelta(days=1) != date.fromisoformat(current_period["start"]):
        raise CollectorError("Breakdown snapshot comparison periods must be adjacent.")
    expected_range = {
        "start": prior_period["start"], "end": current_period["end"],
        "days": prior_period["days"] + current_period["days"], "inclusive": True,
    }
    if snapshot.get("range") != expected_range:
        raise CollectorError("Breakdown snapshot range does not match its periods.")
    if snapshot.get("currency") is not None and not isinstance(snapshot["currency"], str):
        raise CollectorError("Breakdown snapshot currency must be a code or null.")
    if snapshot.get("currencyStatus") not in {"VERIFIED", "PARTIAL", "NOT_AVAILABLE"}:
        raise CollectorError("Breakdown snapshot currency status is invalid.")
    if not isinstance(snapshot.get("warnings"), list) or any(not isinstance(item, str) for item in snapshot["warnings"]):
        raise CollectorError("Breakdown snapshot warnings must be strings.")

    reports = {"daily": snapshot.get("daily")}
    reports.update(snapshot.get("breakdowns") or {})
    expected_dimensions = {
        "daily": ("DATE",),
        **BREAKDOWN_DIMENSIONS,
        "platformTypeAdFormat": ("DATE", "PLATFORM_TYPE_NAME", "AD_FORMAT_NAME"),
    }
    if set(reports) != set(expected_dimensions):
        raise CollectorError("Breakdown snapshot report set is invalid.")
    expected_dates = {
        (date.fromisoformat(expected_range["start"]) + timedelta(days=offset)).isoformat()
        for offset in range(expected_range["days"])
    }
    for name, expected_dims in expected_dimensions.items():
        report = reports[name]
        if not isinstance(report, dict) or report.get("dimensions") != list(expected_dims) or report.get("metrics") != list(BREAKDOWN_METRICS):
            raise CollectorError("Breakdown report dimensions or metrics are invalid.")
        if report.get("status") not in BREAKDOWN_REPORT_STATUSES:
            raise CollectorError("Breakdown report status is invalid.")
        if not isinstance(report.get("rows"), list) or type(report.get("rowCount")) is not int or report["rowCount"] != len(report["rows"]):
            raise CollectorError("Breakdown report row count is invalid.")
        if report["rowCount"] > BREAKDOWN_ROW_LIMIT:
            raise CollectorError("Breakdown report exceeds its bounded row limit.")
        if not isinstance(report.get("warnings"), list) or any(not isinstance(item, str) for item in report["warnings"]):
            raise CollectorError("Breakdown report warnings are invalid.")
        if name == "daily" and snapshot.get("coverageStatus") != report.get("status"):
            raise CollectorError("Breakdown snapshot coverage status does not match the daily report.")
        if report.get("status") in {"NOT_AVAILABLE", "UNSUPPORTED_COMBINATION"}:
            if report["rows"] or report.get("rowCount") != 0 or report.get("totalMatchedRows") is not None or report.get("truncationStatus") != "NOT_AVAILABLE":
                raise CollectorError("Unavailable breakdown reports cannot contain fabricated rows or counts.")
            continue
        total_matched = report.get("totalMatchedRows")
        if total_matched is not None and (type(total_matched) is not int or total_matched < report["rowCount"]):
            raise CollectorError("Breakdown report matched row count is invalid.")
        expected_truncation = "NOT_AVAILABLE" if total_matched is None else "TRUNCATED" if total_matched > report["rowCount"] else "NOT_TRUNCATED"
        if report.get("truncationStatus") != expected_truncation:
            raise CollectorError("Breakdown report truncation status is inconsistent.")
        if report.get("currency") is not None and not isinstance(report["currency"], str):
            raise CollectorError("Breakdown report currency must be a code or null.")
        if not isinstance(report.get("totals"), dict):
            raise CollectorError("Breakdown report totals must be an object.")
        for metric in BREAKDOWN_METRICS:
            field = BREAKDOWN_METRIC_KEYS[metric]
            if field not in report["totals"]:
                raise CollectorError("Breakdown report totals must preserve every metric field.")
            value = report["totals"][field]
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))):
                raise CollectorError("Breakdown report totals must be numeric or null.")
        seen = set()
        seen_dates = set()
        for row in report["rows"]:
            if not isinstance(row, dict):
                raise CollectorError("Breakdown report rows must be objects.")
            values = []
            for dimension in expected_dims:
                field = BREAKDOWN_DIMENSION_KEYS[dimension]
                value = row.get(field)
                if dimension == "DATE":
                    try:
                        parsed_date = date.fromisoformat(value)
                    except (TypeError, ValueError):
                        raise CollectorError("Breakdown report row date is invalid.") from None
                    if value not in expected_dates:
                        raise CollectorError("Breakdown report row date is outside its saved range.")
                    if name == "daily":
                        seen_dates.add(value)
                elif value is not None and not isinstance(value, str):
                    raise CollectorError("Breakdown report dimension values must be strings or null.")
                values.append(value)
            key = tuple(values)
            if key in seen:
                raise CollectorError("Breakdown report contains duplicate dimension rows.")
            seen.add(key)
            for metric in BREAKDOWN_METRICS:
                field = BREAKDOWN_METRIC_KEYS[metric]
                if field not in row:
                    raise CollectorError("Breakdown report rows must preserve every metric field.")
                value = row.get(field)
                if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))):
                    raise CollectorError("Breakdown report metrics must be numeric or null.")
            if report.get("status") == "COMPLETE":
                if any(row.get(BREAKDOWN_METRIC_KEYS[metric]) is None for metric in BREAKDOWN_METRICS):
                    raise CollectorError("A complete breakdown report cannot contain missing metrics.")
                if any(row.get(BREAKDOWN_DIMENSION_KEYS[item]) is None for item in expected_dims if item != "DATE"):
                    raise CollectorError("A complete breakdown report cannot contain missing dimension values.")
        if name == "daily":
            missing_dates = sorted(expected_dates - seen_dates)
            if report.get("missingDates") != missing_dates:
                raise CollectorError("Daily missing-date metadata does not match its rows.")
            if report.get("status") == "COMPLETE" and missing_dates:
                raise CollectorError("A daily report with missing dates cannot be complete.")
            if not isinstance(report.get("rowAggregateCheck"), dict):
                raise CollectorError("Daily aggregate checks are required.")
        if report.get("status") == "COMPLETE" and (
            not report["rows"]
            or report.get("currency") is None
            or report.get("totalMatchedRows") != report["rowCount"]
            or report.get("truncationStatus") != "NOT_TRUNCATED"
            or report.get("warnings")
        ):
            raise CollectorError("A complete breakdown report must have full rows, currency, and no warnings.")
    row_counts = snapshot.get("rowCounts")
    if not isinstance(row_counts, dict) or row_counts != {name: report["rowCount"] for name, report in reports.items()}:
        raise CollectorError("Breakdown snapshot row counts do not match report contents.")
    available_currencies = {report.get("currency") for report in reports.values() if report.get("currency")}
    if snapshot.get("currencyStatus") == "VERIFIED" and (
        snapshot.get("currency") is None
        or available_currencies != {snapshot.get("currency")}
    ):
        raise CollectorError("Verified breakdown currency must agree across all available reports.")
    if snapshot.get("currencyStatus") == "NOT_AVAILABLE" and snapshot.get("currency") is not None:
        raise CollectorError("Unavailable breakdown currency cannot contain a value.")
    if not isinstance(snapshot.get("aggregateReconciliation"), dict) or snapshot["aggregateReconciliation"].get("status") not in {"VERIFIED", "PARTIAL", "NOT_AVAILABLE"}:
        raise CollectorError("Breakdown aggregate reconciliation metadata is invalid.")
    if not isinstance(snapshot.get("collector"), dict) or snapshot["collector"].get("apiVersion") != API_VERSION:
        raise CollectorError("Breakdown collector metadata is invalid.")
    return True


def validate_snapshot(snapshot):
    if not isinstance(snapshot, dict) or snapshot.get("schemaVersion") != 1:
        raise CollectorError("Snapshot schemaVersion must be 1.")
    if snapshot.get("source") != "DIRECT_ADSENSE_MANAGEMENT_API_V2":
        raise CollectorError("Snapshot source is not the direct AdSense Management API v2.")
    if not isinstance(snapshot.get("generatedAt"), str) or not snapshot["generatedAt"]:
        raise CollectorError("Snapshot generatedAt is required.")
    if not str((snapshot.get("account") or {}).get("name") or "").startswith("accounts/pub-"):
        raise CollectorError("Snapshot account resource name is invalid.")
    site = snapshot.get("site") or {}
    if site.get("domain") != SITE_DOMAIN or site.get("status") not in {"VERIFIED", "PARTIAL", "NOT_AVAILABLE", "ERROR", "STALE_DATA"}:
        raise CollectorError("Snapshot site metadata is invalid.")
    for period_name in ("currentPeriod", "priorPeriod"):
        period = snapshot.get(period_name) or {}
        try:
            start = date.fromisoformat(period["start"])
            end = date.fromisoformat(period["end"])
            days = int(period["days"])
        except (KeyError, TypeError, ValueError):
            raise CollectorError("Snapshot period metadata is invalid.") from None
        if end < start or (end - start).days + 1 != days or period.get("inclusive") is not True:
            raise CollectorError("Snapshot period must use an inclusive date range with matching day count.")
    if site.get("status") == "VERIFIED" and site.get("comparisonStatus") != "VERIFIED":
        raise CollectorError("A VERIFIED site comparison must pass its report contract.")
    urls = snapshot.get("pageUrls") or {}
    coverage_status = urls.get("coverageStatus")
    if urls.get("source") != "DIRECT_ADSENSE_PAGE_URL" or coverage_status not in {"PARTIAL", "NOT_AVAILABLE"}:
        raise CollectorError("PAGE_URL evidence must retain its direct source and a supported coverage status.")
    if not isinstance(urls.get("rows"), list):
        raise CollectorError("PAGE_URL rows must be a list.")
    if coverage_status == "NOT_AVAILABLE":
        if (
            urls.get("unavailableReason") != PAGE_URL_UNAVAILABLE_CLASSIFICATION
            or urls["rows"]
            or urls.get("returnedRowCount") != 0
            or urls.get("totalMatchedRows") is not None
            or urls.get("truncationStatus") != "NOT_AVAILABLE"
        ):
            raise CollectorError("Unavailable PAGE_URL evidence cannot contain rows or fabricated values.")
        return True
    if urls.get("unavailableReason") is not None:
        raise CollectorError("Available PAGE_URL evidence cannot carry an unavailable reason.")
    for row in urls["rows"]:
        try:
            hostname = urlsplit(row.get("url") or "").hostname
        except ValueError:
            hostname = None
        if (
            hostname != SITE_DOMAIN
            or row.get("source") != "DIRECT_ADSENSE_PAGE_URL"
            or row.get("revenueMetric") != "ESTIMATED_EARNINGS"
            or row.get("coverageStatus") != "PARTIAL"
        ):
            raise CollectorError("PAGE_URL rows must retain their direct AdSense source and metric.")
        if any(value is not None and not isinstance(value, (int, float)) for value in (row.get(key) for key in METRIC_KEYS.values())):
            raise CollectorError("PAGE_URL metrics must be numeric or null.")
    return True


def _sanitize_api_error_message(message, sensitive_values):
    value = message
    value = re.sub(r"(?i)https?://[^\s<>()\"']+", "[URL REDACTED]", value)
    value = re.sub(r"\?[^\s<>()\"']+", "[QUERY REDACTED]", value)
    value = re.sub(
        r"(?i)\b(access_token|refresh_token|client_secret|client_id)\b\s*[:=]\s*[^\s,;&]+",
        lambda match: f"{match.group(1)}=[REDACTED]",
        value,
    )
    value = re.sub(r"(?i)\bAuthorization\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+", "Authorization: [REDACTED]", value)
    value = re.sub(r"(?i)\bBearer\s+[A-Za-z0-9._~+/-]+=*", "Bearer [REDACTED]", value)
    value = re.sub(r"\baccounts/pub-\d+\b", "accounts/pub-[REDACTED]", value)
    for secret in sorted({str(item) for item in sensitive_values if item}, key=len, reverse=True):
        value = value.replace(secret, "[REDACTED]")
    value = re.sub(r"(?<![A-Za-z0-9])[A-Za-z0-9][A-Za-z0-9._~+/-]{31,}={0,}(?![A-Za-z0-9])", "[REDACTED]", value)
    value = re.sub(r"[\x00-\x1f\x7f]+", " ", value)
    return " ".join(value.split())[:240]


def _structured_http_error(error, stage, sensitive_values):
    google_status = None
    safe_message = None
    classification = None
    try:
        raw = error.read()
        payload = json.loads(raw.decode("utf-8"))
    except (AttributeError, OSError, UnicodeDecodeError, json.JSONDecodeError):
        pass
    else:
        detail = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(detail, dict):
            code = detail.get("code")
            status = detail.get("status")
            message = detail.get("message")
            if (
                type(code) is int
                and code == error.code
                and isinstance(status, str)
                and re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", status)
                and isinstance(message, str)
            ):
                safe = _sanitize_api_error_message(message, sensitive_values)
                if safe:
                    google_status = status
                    safe_message = safe
                    if (
                        stage == "PAGE_URL_REPORT"
                        and error.code == 400
                        and status == "INVALID_ARGUMENT"
                        and message.strip() == PAGE_URL_UNAVAILABLE_MESSAGE
                    ):
                        classification = PAGE_URL_UNAVAILABLE_CLASSIFICATION
    return GoogleAPIError(
        stage=stage,
        http_status=error.code,
        google_status=google_status,
        safe_message=safe_message,
        classification=classification,
    )


def _json_request(request, open_url, *, stage, sensitive_values=()):
    api_error = None
    try:
        with open_url(request, timeout=30) as response:
            raw = response.read()
    except HTTPError as error:
        api_error = _structured_http_error(error, stage, sensitive_values)
    except (URLError, TimeoutError, OSError):
        raise CollectorError(f"Google API network request failed at {stage}.") from None
    if api_error is not None:
        raise api_error
    try:
        value = json.loads(raw.decode("utf-8"))
    except (AttributeError, UnicodeDecodeError, json.JSONDecodeError):
        raise CollectorError(f"Google API returned invalid JSON at {stage}.") from None
    if not isinstance(value, dict):
        raise CollectorError(f"Google API returned an invalid response at {stage}.")
    return value


def _refresh_access_token(client_id, client_secret, refresh_token, open_url):
    body = urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode("utf-8")
    request = Request(
        OAUTH_TOKEN_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        method="POST",
    )
    token_response = _json_request(
        request,
        open_url,
        stage="OAUTH_REFRESH",
        sensitive_values=(client_id, client_secret, refresh_token),
    )
    access_token = token_response.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise CollectorError("OAuth token response did not include an access token.")
    return access_token


def _api_get(url, access_token, open_url, *, stage, sensitive_values=()):
    request = Request(
        url,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    return _json_request(
        request,
        open_url,
        stage=stage,
        sensitive_values=(*sensitive_values, access_token),
    )


def _date_query_params(prefix, value):
    report_date = date.fromisoformat(value)
    return [
        (f"{prefix}.year", str(report_date.year)),
        (f"{prefix}.month", str(report_date.month)),
        (f"{prefix}.day", str(report_date.day)),
    ]


def _generate_report(account_name, period, dimensions, access_token, open_url, *, stage, filters=(), sensitive_values=(), metrics=METRICS, limit=REPORT_LIMIT):
    params = [("dimensions", item) for item in dimensions]
    params.extend(("metrics", item) for item in metrics)
    params.extend(_date_query_params("startDate", period["start"]))
    params.extend(_date_query_params("endDate", period["end"]))
    params.extend((
        ("dateRange", "CUSTOM"),
        ("reportingTimeZone", "ACCOUNT_TIME_ZONE"),
        ("languageCode", "en"),
        ("limit", str(limit)),
    ))
    params.extend(("filters", item) for item in filters)
    account_path = quote(account_name, safe="/")
    url = f"{API_BASE}/{account_path}/reports:generate?{urlencode(params)}"
    return _api_get(url, access_token, open_url, stage=stage, sensitive_values=sensitive_values)


def _write_snapshot(output, snapshot):
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=output.parent, prefix=f".{output.name}.", suffix=".tmp", delete=False) as handle:
            temp_path = Path(handle.name)
            json.dump(snapshot, handle, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, output)
    except OSError:
        if temp_path:
            temp_path.unlink(missing_ok=True)
        raise CollectorError("Could not safely write the AdSense snapshot.") from None


def collect_snapshot(
    output,
    *,
    account_name,
    client_id,
    client_secret,
    refresh_token,
    now=None,
    days=7,
    open_url=None,
    breakdown_output=None,
):
    if breakdown_output is not None and Path(output).resolve() == Path(breakdown_output).resolve():
        raise CollectorError("The AdSense snapshot and breakdown outputs must be different files.")
    if breakdown_output is not None and days > BREAKDOWN_MAX_PERIOD_DAYS:
        raise CollectorError("Daily breakdown output is bounded to two seven-day periods.")
    if not all((account_name, client_id, client_secret, refresh_token)):
        raise CollectorError("ADSENSE_ACCOUNT_NAME and all three AdSense OAuth credentials are required.")
    if not str(account_name).startswith("accounts/pub-"):
        raise CollectorError("ADSENSE_ACCOUNT_NAME must use the accounts/pub-... resource format.")
    open_url = open_url or urlopen
    access_token = _refresh_access_token(client_id, client_secret, refresh_token, open_url)
    sensitive_values = (account_name, client_id, client_secret, refresh_token, access_token)
    account_path = quote(account_name, safe="/")
    account = _api_get(
        f"{API_BASE}/{account_path}",
        access_token,
        open_url,
        stage="ACCOUNT_GET",
        sensitive_values=sensitive_values,
    )
    time_zone = ((account.get("timeZone") or {}).get("id"))
    if not time_zone:
        raise CollectorError("The AdSense account timezone is unavailable.")
    current_period, prior_period = build_periods(now or datetime.now(timezone.utc), time_zone, days=days)
    current_report = _generate_report(
        account_name,
        current_period,
        SITE_DIMENSIONS,
        access_token,
        open_url,
        stage="SITE_CURRENT_REPORT",
        filters=(f"OWNED_SITE_DOMAIN_NAME=={SITE_DOMAIN}",),
        sensitive_values=sensitive_values,
    )
    prior_report = _generate_report(
        account_name,
        prior_period,
        SITE_DIMENSIONS,
        access_token,
        open_url,
        stage="SITE_PRIOR_REPORT",
        filters=(f"OWNED_SITE_DOMAIN_NAME=={SITE_DOMAIN}",),
        sensitive_values=sensitive_values,
    )
    page_url_unavailable_reason = None
    page_url_unavailable_warning = None
    try:
        page_url_report = _generate_report(
            account_name,
            current_period,
            PAGE_URL_DIMENSIONS,
            access_token,
            open_url,
            stage="PAGE_URL_REPORT",
            sensitive_values=sensitive_values,
        )
    except GoogleAPIError as error:
        if error.stage != "PAGE_URL_REPORT" or error.classification != PAGE_URL_UNAVAILABLE_CLASSIFICATION:
            raise
        page_url_report = None
        page_url_unavailable_reason = error.classification
        page_url_unavailable_warning = error.safe_message
    snapshot = build_snapshot(
        account_name=account_name,
        account=account,
        current_report=current_report,
        prior_report=prior_report,
        page_url_report=page_url_report,
        page_url_unavailable_reason=page_url_unavailable_reason,
        page_url_unavailable_warning=page_url_unavailable_warning,
        now=now,
        days=days,
    )
    validate_snapshot(snapshot)
    _write_snapshot(output, snapshot)
    if breakdown_output is not None:
        _collect_breakdown_snapshot(
            breakdown_output,
            account_name=account_name,
            account=account,
            access_token=access_token,
            sensitive_values=sensitive_values,
            snapshot=snapshot,
            now=now,
            days=days,
            open_url=open_url,
        )
    return snapshot


def _collect_breakdown_snapshot(
    output,
    *,
    account_name,
    account,
    access_token,
    sensitive_values,
    snapshot,
    now,
    days,
    open_url,
):
    current_period, prior_period = build_periods(now or datetime.now(timezone.utc), snapshot["reportingTimeZone"]["id"], days=days)
    report_period = {
        "start": prior_period["start"],
        "end": current_period["end"],
        "days": prior_period["days"] + current_period["days"],
        "inclusive": True,
    }
    reports_by_name = {}
    failures = {}
    specs = {"daily": ("DATE",), **BREAKDOWN_DIMENSIONS}
    for name, dimensions in specs.items():
        stage = f"{name.upper()}_BREAKDOWN_REPORT"
        try:
            report = _generate_report(
                account_name,
                report_period,
                dimensions,
                access_token,
                open_url,
                stage=stage,
                filters=(f"OWNED_SITE_DOMAIN_NAME=={SITE_DOMAIN}",),
                sensitive_values=sensitive_values,
                metrics=BREAKDOWN_METRICS,
                limit=BREAKDOWN_ROW_LIMIT,
            )
            _breakdown_report(
                report,
                dimensions,
                report_period,
                stage=f"{name.upper()}_BREAKDOWN_REPORT_PARSE",
                daily=name == "daily",
            )
            reports_by_name[name] = report
        except GoogleAPIError as error:
            message = error.safe_message or str(error)
            unsupported = (
                error.http_status == 400
                and error.google_status == "INVALID_ARGUMENT"
                and "combination" in message.lower()
            )
            failures[name] = {
                "status": "UNSUPPORTED_COMBINATION" if unsupported else "NOT_AVAILABLE",
                "reason": "UNSUPPORTED_COMBINATION" if unsupported else "API_ERROR",
                "warnings": [message],
            }
        except CollectorError as error:
            failures[name] = {"status": "NOT_AVAILABLE", "reason": "REPORT_PARSE_ERROR", "warnings": [str(error)]}
    artifact = build_breakdown_snapshot(
        account_name=account_name,
        account=account,
        snapshot=snapshot,
        daily_report=reports_by_name.get("daily"),
        breakdown_reports={name: reports_by_name.get(name) for name in BREAKDOWN_DIMENSIONS},
        generated_at=snapshot["generatedAt"],
        days=days,
        failures=failures,
    )
    _write_snapshot(output, artifact)
    return artifact


def _read_snapshot(path):
    try:
        with Path(path).open(encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        raise CollectorError("Could not read a valid AdSense snapshot for validation.") from None


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        if args.validate_only and args.validate_breakdown_only:
            raise CollectorError("Choose only one AdSense artifact validation mode.")
        if args.validate_only:
            validate_snapshot(_read_snapshot(args.validate_only))
            print("AdSense snapshot schema: PASS")
            return 0
        if args.validate_breakdown_only:
            validate_breakdown_snapshot(_read_snapshot(args.validate_breakdown_only))
            print("AdSense breakdown schema: PASS")
            return 0
        if args.breakdown_output and args.breakdown_output.resolve() == args.output.resolve():
            raise CollectorError("The AdSense snapshot and breakdown outputs must be different files.")
        missing = [
            name for name in (
                "ADSENSE_ACCOUNT_NAME",
                "ADSENSE_OAUTH_CLIENT_ID",
                "ADSENSE_OAUTH_CLIENT_SECRET",
                "ADSENSE_OAUTH_REFRESH_TOKEN",
            ) if not os.environ.get(name)
        ]
        if missing:
            raise CollectorError("Missing required environment variables: " + ", ".join(missing))
        snapshot = collect_snapshot(
            args.output,
            account_name=os.environ["ADSENSE_ACCOUNT_NAME"],
            client_id=os.environ["ADSENSE_OAUTH_CLIENT_ID"],
            client_secret=os.environ["ADSENSE_OAUTH_CLIENT_SECRET"],
            refresh_token=os.environ["ADSENSE_OAUTH_REFRESH_TOKEN"],
            days=args.days,
            breakdown_output=args.breakdown_output,
        )
        print(
            f"AdSense snapshot written: site={snapshot['site']['status']}; "
            f"PAGE_URL rows={snapshot['pageUrls']['returnedRowCount']}"
        )
        return 0
    except CollectorError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    except Exception:
        print("ERROR: AdSense collection failed; the existing snapshot was not changed.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
