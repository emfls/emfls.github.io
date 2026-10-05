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
from urllib.parse import quote, urlencode
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
INTEGER_METRICS = {"PAGE_VIEWS", "IMPRESSIONS", "CLICKS"}
ADDITIVE_METRICS = {"ESTIMATED_EARNINGS", "PAGE_VIEWS", "IMPRESSIONS", "CLICKS"}
REQUIRED_SITE_METRICS = {"ESTIMATED_EARNINGS", "PAGE_VIEWS", "IMPRESSIONS", "CLICKS"}


class CollectorError(Exception):
    """A safe-to-log collection or schema error."""


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("data/performance/adsense-latest.json"))
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--validate-only", type=Path)
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


def _parse_cells(row, headers):
    cells = row.get("cells") if isinstance(row, dict) else None
    if not isinstance(cells, list) or len(cells) != len(headers):
        raise CollectorError("AdSense returned a report row with an unexpected shape.")
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


def _parse_report(report, dimensions, expected_period):
    if not isinstance(report, dict):
        raise CollectorError("AdSense returned an invalid report response.")
    headers = report.get("headers")
    expected_headers = [*dimensions, *METRICS]
    if not isinstance(headers, list) or [item.get("name") for item in headers] != expected_headers:
        raise CollectorError("AdSense report headers do not match the requested dimensions and metrics.")
    start = _date_from_api(report.get("startDate"))
    end = _date_from_api(report.get("endDate"))
    if start != expected_period["start"] or end != expected_period["end"]:
        raise CollectorError("AdSense report dates do not match the requested inclusive period.")
    rows = report.get("rows")
    if not isinstance(rows, list):
        raise CollectorError("AdSense report rows are unavailable.")
    total_raw = report.get("totalMatchedRows")
    try:
        total_matched = int(total_raw) if total_raw is not None else None
    except (TypeError, ValueError):
        total_matched = None
    if total_matched is not None and total_matched < len(rows):
        raise CollectorError("AdSense report row count is inconsistent.")
    parsed_rows = [_parse_cells(row, headers) for row in rows]
    totals_row = report.get("totals")
    totals = _parse_cells(totals_row, headers) if totals_row else {}
    warnings = report.get("warnings") or []
    if not isinstance(warnings, list):
        warnings = ["AdSense returned report warnings in an unknown format."]
    return {
        "dimensions": list(dimensions),
        "metrics": list(METRICS),
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
        from urllib.parse import urlsplit

        if urlsplit(url).hostname != SITE_DOMAIN:
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
    current = _parse_report(current_report, SITE_DIMENSIONS, current_period)
    prior = _parse_report(prior_report, SITE_DIMENSIONS, prior_period)
    page_urls_report = _parse_report(page_url_report, PAGE_URL_DIMENSIONS, current_period)
    if not current["rows"] or not prior["rows"]:
        raise CollectorError("AdSense site report returned no rows; keeping the existing snapshot.")

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

    warnings = [*current["warnings"], *prior["warnings"], *page_urls_report["warnings"]]
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

    page_rows, offsite_rows = _page_url_rows(page_urls_report)
    if offsite_rows:
        warnings.append(f"Ignored {offsite_rows} PAGE_URL rows outside {SITE_DOMAIN}.")
    page_currency_matches = bool(matched_currency and page_urls_report["currency"] == matched_currency)
    if not page_currency_matches and page_rows:
        warnings.append("PAGE_URL report currency did not match the site-level report; URL rows were omitted.")
        page_rows = []
    total_matched_rows = page_urls_report["totalMatchedRows"]
    page_url_status = page_urls_report["truncationStatus"]
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
            "coverageStatus": "PARTIAL",
            "coverageCaveat": "PAGE_URL includes only eligible pages meeting AdSense impression thresholds; a missing URL is NOT_AVAILABLE, not zero.",
            "rows": page_rows,
            "returnedRowCount": len(page_urls_report["rows"]),
            "totalMatchedRows": total_matched_rows,
            "truncationStatus": page_url_status,
            "warnings": page_urls_report["warnings"] + (["Some returned PAGE_URL rows were outside the target site."] if offsite_rows else []),
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
    if urls.get("source") != "DIRECT_ADSENSE_PAGE_URL" or urls.get("coverageStatus") != "PARTIAL":
        raise CollectorError("PAGE_URL evidence must retain its direct source and partial coverage status.")
    if not isinstance(urls.get("rows"), list):
        raise CollectorError("PAGE_URL rows must be a list.")
    for row in urls["rows"]:
        if row.get("source") != "DIRECT_ADSENSE_PAGE_URL" or row.get("revenueMetric") != "ESTIMATED_EARNINGS":
            raise CollectorError("PAGE_URL rows must retain their direct AdSense source and metric.")
        if row.get("estimatedEarnings") is not None and not isinstance(row.get("estimatedEarnings"), (int, float)):
            raise CollectorError("PAGE_URL estimated earnings must be numeric or null.")
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


def _http_error_message(error, stage, sensitive_values):
    prefix = f"Google API request failed at {stage} (HTTP {error.code})."
    try:
        raw = error.read()
        payload = json.loads(raw.decode("utf-8"))
    except (AttributeError, OSError, UnicodeDecodeError, json.JSONDecodeError):
        return prefix
    detail = payload.get("error") if isinstance(payload, dict) else None
    if not isinstance(detail, dict):
        return prefix
    code = detail.get("code")
    status = detail.get("status")
    message = detail.get("message")
    if type(code) is not int or code != error.code or not isinstance(status, str) or not isinstance(message, str):
        return prefix
    if not re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", status):
        return prefix
    safe_message = _sanitize_api_error_message(message, sensitive_values)
    if not safe_message:
        return prefix
    return f"Google API request failed at {stage} (HTTP {error.code}; {status}): {safe_message}"


def _json_request(request, open_url, *, stage, sensitive_values=()):
    try:
        with open_url(request, timeout=30) as response:
            raw = response.read()
    except HTTPError as error:
        raise CollectorError(_http_error_message(error, stage, sensitive_values)) from None
    except (URLError, TimeoutError, OSError):
        raise CollectorError(f"Google API network request failed at {stage}.") from None
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


def _generate_report(account_name, period, dimensions, access_token, open_url, *, stage, sensitive_values=()):
    params = [("dimensions", item) for item in dimensions]
    params.extend(("metrics", item) for item in METRICS)
    params.extend(_date_query_params("startDate", period["start"]))
    params.extend(_date_query_params("endDate", period["end"]))
    params.extend((
        ("dateRange", "CUSTOM"),
        ("reportingTimeZone", "ACCOUNT_TIME_ZONE"),
        ("languageCode", "en"),
        ("limit", str(REPORT_LIMIT)),
        ("filters", f"OWNED_SITE_DOMAIN_NAME=={SITE_DOMAIN}"),
    ))
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
):
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
        sensitive_values=sensitive_values,
    )
    prior_report = _generate_report(
        account_name,
        prior_period,
        SITE_DIMENSIONS,
        access_token,
        open_url,
        stage="SITE_PRIOR_REPORT",
        sensitive_values=sensitive_values,
    )
    page_url_report = _generate_report(
        account_name,
        current_period,
        PAGE_URL_DIMENSIONS,
        access_token,
        open_url,
        stage="PAGE_URL_REPORT",
        sensitive_values=sensitive_values,
    )
    snapshot = build_snapshot(
        account_name=account_name,
        account=account,
        current_report=current_report,
        prior_report=prior_report,
        page_url_report=page_url_report,
        now=now,
        days=days,
    )
    validate_snapshot(snapshot)
    _write_snapshot(output, snapshot)
    return snapshot


def _read_snapshot(path):
    try:
        with Path(path).open(encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        raise CollectorError("Could not read a valid AdSense snapshot for validation.") from None


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        if args.validate_only:
            validate_snapshot(_read_snapshot(args.validate_only))
            print("AdSense snapshot schema: PASS")
            return 0
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
