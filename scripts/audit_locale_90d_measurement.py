#!/usr/bin/env python3
"""Artifact-only 90-day locale URL measurement and conservative canary audit."""

import argparse
import base64
import csv
import hashlib
import html.parser
import json
import os
import re
import subprocess
import tempfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from zoneinfo import ZoneInfo


LOCALES = ("cn", "de", "es", "fr", "id", "in", "jp", "pt", "ru", "vn")
LOCALE_LANGUAGES = {
    "cn": ("zh",), "de": ("de",), "es": ("es",), "fr": ("fr",),
    "id": ("id",), "in": ("hi",), "jp": ("ja",), "pt": ("pt",),
    "ru": ("ru",), "vn": ("vi",),
}
GA4_METRICS = (
    ("screenPageViews", "views"),
    ("totalUsers", "users"),
    ("userEngagementDuration", "engagementSeconds"),
    ("totalAdRevenue", "totalAdRevenue"),
)
GA4_REQUEST_LIMIT = 100_000
GSC_ROW_LIMIT = 25_000
PROPERTY_URL = "https://emfls.github.io/"
SITE_HOST = "emfls.github.io"
JP_REVIEW_ROUTES = {
    "/jp/report/travel/uk-miltonkeynes.html",
    "/jp/report/travel/bangladesh-joypurhat.html",
    "/jp/report/travel/khagrachari.html",
}


def _get(value, snake_name, camel_name=None, default=None):
    if isinstance(value, dict):
        if snake_name in value:
            return value[snake_name]
        if camel_name and camel_name in value:
            return value[camel_name]
        return default
    if hasattr(value, snake_name):
        # Proto3 optional fields otherwise look like false/empty defaults.
        for message in (value, getattr(value, "_pb", None)):
            has_field = getattr(message, "HasField", None) if message is not None else None
            if callable(has_field):
                try:
                    if not has_field(snake_name):
                        return default
                except (TypeError, ValueError):
                    # Repeated/non-presence fields do not support HasField.
                    pass
                break
        return getattr(value, snake_name)
    if camel_name and hasattr(value, camel_name):
        return getattr(value, camel_name)
    return default


def _has_field(value, snake_name, camel_name=None):
    if isinstance(value, dict):
        return snake_name in value or bool(camel_name and camel_name in value)
    for message in (value, getattr(value, "_pb", None)):
        has_field = getattr(message, "HasField", None) if message is not None else None
        if callable(has_field):
            try:
                return bool(has_field(snake_name))
            except (TypeError, ValueError):
                continue
    return bool(value is not None and (hasattr(value, snake_name) or (camel_name and hasattr(value, camel_name))))


def _plain_metadata_value(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _plain_metadata_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain_metadata_value(item) for item in value]
    proto_value = getattr(value, "_pb", value)
    try:
        from google.protobuf.json_format import MessageToDict
        from google.protobuf.message import Message
        if isinstance(proto_value, Message):
            return MessageToDict(proto_value, preserving_proto_field_name=False)
    except ImportError:
        pass
    to_dict = getattr(type(value), "to_dict", None)
    if callable(to_dict):
        try:
            return _plain_metadata_value(to_dict(value))
        except (TypeError, ValueError):
            pass
    fields = getattr(value, "__dict__", None)
    if isinstance(fields, dict):
        public = {key: item for key, item in fields.items() if not key.startswith("_")}
        if public:
            return _plain_metadata_value(public)
    return str(value)


def _number(value):
    if value in (None, "", "-", "(not set)"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _dimension(row):
    values = _get(row, "dimension_values", "dimensionValues", []) or []
    if not values:
        return None
    return _get(values[0], "value", default=None)


def _metric_values(row):
    values = _get(row, "metric_values", "metricValues", []) or []
    return [_number(_get(item, "value", default=None)) for item in values]


def _serialize_ga4_row(row):
    dimensions = _get(row, "dimension_values", "dimensionValues", []) or []
    metrics = _get(row, "metric_values", "metricValues", []) or []
    return {
        "dimensionValues": [{"value": _get(item, "value", default=None)} for item in dimensions],
        "metricValues": [{"value": _get(item, "value", default=None)} for item in metrics],
    }


def _metadata_dict(metadata):
    if metadata is None:
        return {
            "currencyCode": None,
            "timeZone": None,
            "subjectToThresholding": None,
            "subjectToThresholdingValue": None,
            "subjectToThresholdingPresent": False,
            "dataLossFromOtherRow": None,
            "samplingMetadatas": None,
            "dataTruncationReasons": None,
            "schemaRestrictionResponse": None,
            "emptyReason": None,
        }
    samples = _get(metadata, "sampling_metadatas", "samplingMetadatas", None)
    if samples is not None:
        samples = [_plain_metadata_value(item) for item in samples]
    subject_value = _get(metadata, "subject_to_thresholding", "subjectToThresholding", None)
    truncation_reasons = _get(metadata, "data_truncation_reasons", "dataTruncationReasons", None)
    if truncation_reasons is not None:
        truncation_reasons = [_plain_metadata_value(item) for item in truncation_reasons]
    return {
        "currencyCode": _get(metadata, "currency_code", "currencyCode", None),
        "timeZone": _get(metadata, "time_zone", "timeZone", None),
        "subjectToThresholding": subject_value,
        "subjectToThresholdingValue": subject_value,
        "subjectToThresholdingPresent": _has_field(metadata, "subject_to_thresholding", "subjectToThresholding"),
        "dataLossFromOtherRow": _get(metadata, "data_loss_from_other_row", "dataLossFromOtherRow", None),
        "samplingMetadatas": samples,
        "dataTruncationReasons": truncation_reasons,
        "schemaRestrictionResponse": _plain_metadata_value(
            _get(metadata, "schema_restriction_response", "schemaRestrictionResponse", None)
        ),
        "emptyReason": _get(metadata, "empty_reason", "emptyReason", None),
    }


def collect_ga4_report(fetch_page, *, requested_rows=GA4_REQUEST_LIMIT, expected_timezone="Asia/Seoul", max_pages=10_000, keep_empty_rows=False):
    """Fetch all GA4 report rows using rowCount/offset and retain completeness evidence."""
    offset = 0
    rows = []
    row_count = None
    row_count_consistent = True
    page_metadata = []
    pages_fetched = 0
    stopped_because = "MAX_PAGE_GUARD"

    while pages_fetched < max_pages:
        response = fetch_page(offset, requested_rows)
        pages_fetched += 1
        current_count = _get(response, "row_count", "rowCount", None)
        try:
            current_count = int(current_count) if current_count is not None else None
        except (TypeError, ValueError):
            current_count = None
        if pages_fetched == 1:
            row_count = current_count
        elif current_count != row_count:
            row_count_consistent = False

        page_metadata.append(_metadata_dict(_get(response, "metadata", default=None)))
        page_rows = list(_get(response, "rows", default=[]) or [])
        rows.extend(_serialize_ga4_row(row) for row in page_rows)

        if not page_rows:
            if row_count is not None and len(rows) >= row_count:
                stopped_because = "ROW_COUNT_RETRIEVED"
            elif row_count is None:
                stopped_because = "EMPTY_PAGE_ROW_COUNT_UNAVAILABLE"
            else:
                stopped_because = "EMPTY_PAGE_BEFORE_ROW_COUNT"
            break
        if row_count is not None and len(rows) >= row_count:
            stopped_because = "ROW_COUNT_RETRIEVED" if len(rows) == row_count else "ROWS_EXCEED_ROW_COUNT"
            break
        if len(page_rows) < requested_rows:
            if row_count is not None and len(rows) < row_count:
                # rowCount is the completeness contract; continue even after a short page.
                offset += len(page_rows)
                continue
            stopped_because = "SHORT_PAGE_ROW_COUNT_UNAVAILABLE" if row_count is None else "SHORT_PAGE_BEFORE_ROW_COUNT"
            break
        offset += len(page_rows)
    else:
        stopped_because = "MAX_PAGE_GUARD"

    metadata_consistent = bool(page_metadata) and all(item == page_metadata[0] for item in page_metadata[1:])
    metadata = page_metadata[0] if page_metadata else _metadata_dict(None)
    complete = (
        row_count is not None
        and row_count >= 0
        and len(rows) == row_count
        and row_count_consistent
        and metadata_consistent
        and stopped_because == "ROW_COUNT_RETRIEVED"
    )
    sampling = metadata.get("samplingMetadatas")
    zero_eligible = bool(
        complete
        and keep_empty_rows is False
        and metadata.get("subjectToThresholdingValue") is not True
        and metadata.get("dataLossFromOtherRow") is False
        and metadata.get("timeZone") == expected_timezone
        and sampling == []
        and not metadata.get("dataTruncationReasons")
    )
    return {
        "keepEmptyRows": keep_empty_rows,
        "requestedRows": requested_rows,
        "requestedRowsTotal": pages_fetched * requested_rows,
        "rowCount": row_count,
        "retrievedRows": len(rows),
        "rowsRetrieved": len(rows),
        "pagesFetched": pages_fetched,
        "stoppedBecause": stopped_because,
        "rowCountConsistent": row_count_consistent,
        "metadataConsistent": metadata_consistent,
        "complete": complete,
        "zeroEligible": zero_eligible,
        "metadata": metadata,
        "currencyCode": metadata.get("currencyCode"),
        "timeZone": metadata.get("timeZone"),
        "subjectToThresholdingValue": metadata.get("subjectToThresholdingValue"),
        "subjectToThresholdingPresent": metadata.get("subjectToThresholdingPresent"),
        "dataLossFromOtherRow": metadata.get("dataLossFromOtherRow"),
        "samplingMetadatas": metadata.get("samplingMetadatas"),
        "dataTruncationReasons": metadata.get("dataTruncationReasons"),
        "schemaRestrictionResponse": metadata.get("schemaRestrictionResponse"),
        "emptyReason": metadata.get("emptyReason"),
        "pageMetadata": page_metadata,
        "rows": rows,
    }


def _date_window(end_date, days):
    start_date = end_date - timedelta(days=days - 1)
    return {"start": start_date.isoformat(), "end": end_date.isoformat(), "days": days}


def build_periods(now=None, *, ga4_timezone="Asia/Seoul", gsc_timezone="America/Los_Angeles"):
    if now is None:
        now = datetime.now(timezone.utc)
    elif isinstance(now, str):
        now = datetime.fromisoformat(now.replace("Z", "+00:00"))
    elif isinstance(now, date) and not isinstance(now, datetime):
        now = datetime.combine(now, datetime.min.time(), tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    ga4_today = now.astimezone(ZoneInfo(ga4_timezone)).date()
    ga4_end = ga4_today - timedelta(days=1)
    latest_28_start = ga4_end - timedelta(days=27)
    prior_28_end = latest_28_start - timedelta(days=1)
    prior_28_start = prior_28_end - timedelta(days=27)

    gsc_today = now.astimezone(ZoneInfo(gsc_timezone)).date()
    gsc_end = gsc_today - timedelta(days=3)
    return {
        "ga4": {
            "90d": _date_window(ga4_end, 90),
            "latest28d": _date_window(ga4_end, 28),
            "prior28d": {"start": prior_28_start.isoformat(), "end": prior_28_end.isoformat(), "days": 28},
            "reportingTimeZone": ga4_timezone,
        },
        "gsc": {
            "90d": _date_window(gsc_end, 90),
            "reportingTimeZone": gsc_timezone,
            "finalizedDataState": "final",
            "finalLagDays": 3,
        },
    }


def collect_gsc_locale(fetch_page, *, locale, start_date, end_date, row_limit=GSC_ROW_LIMIT, max_pages=10_000):
    """Page through one locale-filtered final GSC page query; absence is never zero proof."""
    if locale not in LOCALES:
        raise ValueError(f"unsupported locale: {locale}")
    expression = rf"^https://{re.escape(SITE_HOST)}/{re.escape(locale)}/"
    rows = []
    start_row = 0
    pages_fetched = 0
    offsets = []
    stopped_because = "MAX_PAGE_GUARD"
    while pages_fetched < max_pages:
        body = {
            "startDate": start_date,
            "endDate": end_date,
            "dimensions": ["page"],
            "type": "web",
            "dataState": "final",
            "aggregationType": "auto",
            "dimensionFilterGroups": [{
                "groupType": "and",
                "filters": [{"dimension": "page", "operator": "includingRegex", "expression": expression}],
            }],
            "rowLimit": row_limit,
            "startRow": start_row,
        }
        offsets.append(start_row)
        page = list(fetch_page(body) or [])
        pages_fetched += 1
        rows.extend(page)
        if len(page) < row_limit:
            stopped_because = "SHORT_PAGE"
            break
        start_row += row_limit
    return {
        "locale": locale,
        "period": {"start": start_date, "end": end_date},
        "rowLimit": row_limit,
        "startRows": offsets,
        "rowsRetrieved": len(rows),
        "pagesFetched": pages_fetched,
        "stoppedBecause": stopped_because,
        "paginationExhausted": stopped_because == "SHORT_PAGE",
        "coverageStatus": "TOP_ROWS_NOT_GUARANTEED",
        "requestStatus": "SUCCESS" if stopped_because == "SHORT_PAGE" else "INCOMPLETE",
        "rows": rows,
    }


def normalize_page_path(value):
    raw = str(value or "").strip()
    if raw.startswith(("http://", "https://")):
        raw = urlsplit(raw).path or "/"
    raw = unquote(raw.split("?", 1)[0].split("#", 1)[0] or "/")
    raw = re.sub(r"/{2,}", "/", raw)
    if not raw.startswith("/"):
        raw = "/" + raw
    if raw.endswith("/index.html"):
        return raw[:-10]
    return raw


def _raw_page_path(value):
    """Normalize host/query syntax while preserving path aliases for collision review."""
    raw = str(value or "").strip()
    if raw.startswith(("http://", "https://")):
        raw = urlsplit(raw).path or "/"
    raw = unquote(raw.split("?", 1)[0].split("#", 1)[0] or "/")
    raw = re.sub(r"/{2,}", "/", raw)
    return raw if raw.startswith("/") else "/" + raw


def _repo_path_route(repo_path):
    if repo_path.endswith("/index.html"):
        return "/" + repo_path[:-10]
    return "/" + repo_path


def build_manifest_index(paths):
    """Build a manifest that keeps every file, canonical route, and alias visible."""
    items = []
    by_route = defaultdict(list)
    aliases = defaultdict(set)
    for entry in paths:
        if isinstance(entry, str):
            repo_path, size = entry, None
        elif isinstance(entry, dict):
            repo_path = entry.get("repoPath") or entry.get("path") or ""
            size = entry.get("bytes")
        else:
            repo_path, size = entry[0], entry[1]
        repo_path = str(repo_path).lstrip("/")
        parts = repo_path.split("/")
        if len(parts) < 2 or parts[0] not in LOCALES or not repo_path.endswith(".html"):
            continue
        route = _repo_path_route(repo_path)
        item = {"locale": parts[0], "repoPath": repo_path, "route": route, "bytes": size}
        items.append(item)
        by_route[route].append(item)
        aliases[route].add(route)
        aliases["/" + repo_path].add(route)
        if route.endswith("/"):
            aliases[route.rstrip("/")].add(route)
    for route in aliases:
        if len(aliases[route]) > 1:
            # Keep ambiguous aliases unresolved instead of choosing a route silently.
            aliases[route] = set()
    return {
        "items": sorted(items, key=lambda item: item["repoPath"]),
        "by_route": dict(by_route),
        "aliases": {key: next(iter(value)) for key, value in aliases.items() if len(value) == 1},
        "manifestCollisions": {route for route, pages in by_route.items() if len(pages) > 1},
    }


def resolve_manifest_route(value, manifest_index):
    normalized = normalize_page_path(value)
    direct = manifest_index["aliases"].get(normalized)
    if direct:
        return direct
    if normalized.endswith("/"):
        return manifest_index["aliases"].get(normalized.rstrip("/"))
    return manifest_index["aliases"].get(normalized + "/")


def _ga4_row_metrics(row):
    values = _metric_values(row)
    result = {}
    unknown = []
    for index, (_, key) in enumerate(GA4_METRICS):
        value = values[index] if index < len(values) else None
        if value is None:
            unknown.append(key)
            result[key] = None
        else:
            result[key] = value
    return result, unknown


def aggregate_ga4_rows(rows, manifest_index):
    grouped = {}
    unmatched = []
    for row in rows:
        raw = _dimension(row)
        if raw is None:
            unmatched.append(None)
            continue
        raw_path = _raw_page_path(raw)
        route = resolve_manifest_route(raw, manifest_index)
        if route is None:
            unmatched.append(raw_path)
            continue
        metrics, unknown = _ga4_row_metrics(row)
        bucket = grouped.setdefault(route, {
            "metrics": {key: 0.0 for _, key in GA4_METRICS},
            "unknownMetrics": set(),
            "rawPaths": set(),
            "apiRows": 0,
        })
        bucket["rawPaths"].add(raw_path)
        bucket["apiRows"] += 1
        for key, value in metrics.items():
            if value is None:
                bucket["unknownMetrics"].add(key)
            else:
                bucket["metrics"][key] += value
        bucket["unknownMetrics"].update(unknown)
    result = {}
    for route, bucket in grouped.items():
        raw_paths = sorted(bucket["rawPaths"])
        result[route] = {
            "metrics": bucket["metrics"],
            "unknownMetrics": sorted(bucket["unknownMetrics"]),
            "rawPaths": raw_paths,
            "apiRows": bucket["apiRows"],
            "normalizationCollision": len(raw_paths) > 1 or route in manifest_index["manifestCollisions"],
        }
    return {"routes": result, "unmatchedRows": unmatched}


def _gsc_keys(row):
    if isinstance(row, dict):
        return row.get("keys") or []
    return _get(row, "keys", default=[]) or []


def aggregate_gsc_rows(rows, manifest_index):
    grouped = {}
    unmatched = []
    for row in rows:
        keys = _gsc_keys(row)
        raw_url = str(keys[0]).strip() if keys and keys[0] else None
        route = resolve_manifest_route(raw_url, manifest_index) if raw_url else None
        if route is None:
            unmatched.append(raw_url)
            continue
        values = {
            "clicks": _number(_get(row, "clicks", default=None)),
            "impressions": _number(_get(row, "impressions", default=None)),
            "position": _number(_get(row, "position", default=None)),
        }
        bucket = grouped.setdefault(route, {"rawUrls": set(), "clicks": 0.0, "impressions": 0.0, "positionWeighted": 0.0, "unknownMetrics": set(), "rows": 0})
        bucket["rawUrls"].add(raw_url)
        bucket["rows"] += 1
        for key in ("clicks", "impressions"):
            if values[key] is None:
                bucket["unknownMetrics"].add(key)
            else:
                bucket[key] += values[key]
        if values["position"] is None or not values["impressions"]:
            if values["position"] is None and values["impressions"]:
                bucket["unknownMetrics"].add("position")
        else:
            bucket["positionWeighted"] += values["position"] * values["impressions"]
    result = {}
    for route, bucket in grouped.items():
        impressions = bucket["impressions"]
        result[route] = {
            "rawUrls": sorted(bucket["rawUrls"]),
            "clicks": bucket["clicks"] if "clicks" not in bucket["unknownMetrics"] else None,
            "impressions": impressions if "impressions" not in bucket["unknownMetrics"] else None,
            "ctr": bucket["clicks"] / impressions if impressions else None,
            "position": round(bucket["positionWeighted"] / impressions, 2) if impressions else None,
            "unknownMetrics": sorted(bucket["unknownMetrics"]),
            "rows": bucket["rows"],
            "normalizationCollision": len(bucket["rawUrls"]) > 1,
        }
    return {"routes": result, "unmatchedRows": unmatched}


def _is_activity(metrics):
    if not metrics or any(metrics.get(key) is None for key in ("views", "users", "engagementSeconds", "totalAdRevenue")):
        return None
    return any(value != 0 for value in metrics.values())


def _locale_from_route(route):
    parts = route.lstrip("/").split("/", 1)
    return parts[0] if parts and parts[0] in LOCALES else None


def classify_manifest_routes(
    manifest_routes,
    ga4_report,
    gsc_rows,
    *,
    protected_routes,
    opportunity_routes,
    experiment_routes,
    dependencies,
    gsc_success_locales=None,
):
    """Assign one measured state to every manifest item without equating no-row to revenue zero."""
    index = build_manifest_index(manifest_routes)
    raw_ga4 = ga4_report.get("rows", [])
    ga4_groups = aggregate_ga4_rows(raw_ga4, index)["routes"]
    gsc_groups = aggregate_gsc_rows(gsc_rows, index)["routes"]
    if gsc_success_locales is None:
        gsc_success_locales = set(LOCALES)

    output = []
    for manifest_item in index["items"]:
        route = manifest_item["route"]
        locale = manifest_item["locale"]
        ga4 = ga4_groups.get(route)
        gsc = gsc_groups.get(route)
        dep = dependencies.get(route, {})
        ga4_activity = _is_activity(ga4["metrics"]) if ga4 else None
        ga4_no_activity_row_eligible = bool(ga4_report.get("zeroEligible")) and ga4 is None
        gsc_available = locale in gsc_success_locales
        gsc_status = "GSC_QUERY_UNAVAILABLE" if not gsc_available else "NO_GSC_ROW"
        gsc_signal = None
        if gsc is not None:
            if gsc["unknownMetrics"]:
                gsc_status = "GSC_ROW_METRICS_UNKNOWN"
            elif (gsc["clicks"] or 0) > 0 or (gsc["impressions"] or 0) > 0:
                gsc_status = "GSC_SIGNAL"
                gsc_signal = True
            else:
                gsc_status = "GSC_ROW_NO_SIGNAL"
                gsc_signal = False
        elif gsc_available:
            gsc_signal = False

        normalization_collision = bool(
            route in index["manifestCollisions"]
            or (ga4 and ga4["normalizationCollision"])
            or (gsc and gsc["normalizationCollision"])
        )
        protected = route in protected_routes
        opportunity = route in opportunity_routes
        experiment = route in experiment_routes
        status = "OTHER_UNKNOWN"
        hold_reason = None
        if protected:
            status = "PROTECTED"
        elif opportunity or experiment:
            status = "HOLD_DEPENDENCY"
            hold_reason = "CURRENT_OPPORTUNITY_OR_RECENT_EXPERIMENT"
        elif normalization_collision:
            status = "NORMALIZATION_COLLISION"
            hold_reason = "MULTIPLE_SOURCE_OR_MANIFEST_PATHS_MAP_TO_ROUTE"
        elif ga4_activity is True or gsc_signal is True:
            status = "MEASURED_POSITIVE"
        elif ga4_no_activity_row_eligible:
            status = "GA4_90D_NO_ACTIVITY_ROW"
        elif ga4_activity is False:
            status = "OTHER_UNKNOWN"
            hold_reason = "GA4_ROW_PRESENT_WITH_ZERO_METRICS_UNEXPECTED_WHEN_KEEP_EMPTY_ROWS_FALSE"
        elif not ga4_report.get("zeroEligible") and ga4 is None:
            status = "OTHER_UNKNOWN"
            hold_reason = "GA4_ZERO_GATE_NOT_VERIFIED"

        if status == "GA4_90D_NO_ACTIVITY_ROW" and dep:
            if dep.get("unique_value_hold"):
                status = "HOLD_DEPENDENCY"
                hold_reason = "STRONG_UNIQUE_VALUE_REQUIRES_HOLD"
            elif int(dep.get("cross_locale_inbound_html", 0)) > 0:
                status = "HOLD_DEPENDENCY"
                hold_reason = "CROSS_LOCALE_INBOUND_HTML"
            elif dep.get("code_references"):
                status = "HOLD_DEPENDENCY"
                hold_reason = "HARDCODED_RUNTIME_ROUTE_REFERENCE"
            elif dep.get("test_references"):
                status = "HOLD_DEPENDENCY"
                hold_reason = "TEST_ROUTE_REFERENCE"
            elif not dep.get("cleanup_straightforward", False):
                status = "HOLD_DEPENDENCY"
                hold_reason = "SITEMAP_OR_FEED_CLEANUP_NOT_STRAIGHTFORWARD"

        pre_age_candidate_gate_passed = bool(
            status == "GA4_90D_NO_ACTIVITY_ROW"
            and ga4_no_activity_row_eligible
            and gsc_available
            and gsc_signal is not True
            and gsc_status != "GSC_ROW_METRICS_UNKNOWN"
            and not protected
            and not opportunity
            and not experiment
            and not normalization_collision
            and not dep.get("unique_value_hold")
            and int(dep.get("cross_locale_inbound_html", 0)) == 0
            and not dep.get("code_references")
            and not dep.get("test_references")
            and dep.get("cleanup_straightforward", False)
        )
        content_signals = dep.get("content_signals", {})
        review = _content_review(
            content_signals,
            int(dep.get("same_locale_inbound_html", 0)),
            int(dep.get("cross_locale_inbound_html", 0)),
        )
        output.append({
            "locale": locale,
            "repoPath": manifest_item["repoPath"],
            "route": route,
            "bytes": manifest_item.get("bytes"),
            "status": status,
            "holdReason": hold_reason,
            "ga4NoActivityRowEligible": ga4_no_activity_row_eligible,
            "ga4Status": "NO_ACTIVITY_ROW_ELIGIBLE" if ga4_no_activity_row_eligible else ("MEASURED" if ga4_activity is True else "GA4_ROW_ZERO_METRICS" if ga4_activity is False else "UNKNOWN"),
            "ga4Metrics": ga4["metrics"] if ga4 else None,
            "ga4RawPaths": ga4["rawPaths"] if ga4 else [],
            "ga4UnknownMetrics": ga4["unknownMetrics"] if ga4 else [],
            "gscStatus": gsc_status,
            "gscMetrics": ({key: gsc.get(key) for key in ("clicks", "impressions", "ctr", "position")} if gsc else None),
            "gscRawUrls": gsc["rawUrls"] if gsc else [],
            "normalizationCollision": normalization_collision,
            "crossLocaleInboundHtml": int(dep.get("cross_locale_inbound_html", 0)),
            "sameLocaleInboundHtml": int(dep.get("same_locale_inbound_html", 0)),
            "codeReferences": dep.get("code_references", []),
            "testReferences": dep.get("test_references", []),
            "sitemapFiles": dep.get("sitemap_files", []),
            "feedFiles": dep.get("feed_files", []),
            "indexFiles": dep.get("index_files", []),
            "cleanupStraightforward": bool(dep.get("cleanup_straightforward", False)),
            "contentSignals": content_signals,
            "preAgeCandidateGatePassed": pre_age_candidate_gate_passed,
            "candidateGatePassed": False,
            "firstSeenCommit": None,
            "firstSeenDate": None,
            "candidateAgeHoldReason": None,
            "contentReviewPassed": review["passed"],
            "contentReviewReasons": review["reasons"],
        })
    if len(output) != len(index["items"]):
        raise RuntimeError("manifest conservation failed: some HTML paths were not classified")
    return output


def select_batch_a(classifications, limit=50, *, period_start="2026-07-09", first_seen_lookup=None):
    eligible = [
        item for item in classifications
        if item.get("preAgeCandidateGatePassed") and item.get("contentReviewPassed")
    ]
    def priority(item):
        signals = item.get("contentSignals", {})
        locale_rank = {"id": 0, "in": 1, "jp": 2}.get(item.get("locale"), 3)
        route = item.get("route", "")
        return (
            locale_rank,
            0 if item.get("locale") == "jp" and route in JP_REVIEW_ROUTES else 1,
            0 if signals.get("exactDuplicateOf") else 1,
            0 if signals.get("wrongLanguage") else 1,
            0 if signals.get("templateHeavy") else 1,
            0 if not item.get("feedFiles") else 1,
            0 if item.get("crossLocaleInboundHtml", 0) + item.get("sameLocaleInboundHtml", 0) == 0 else 1,
            item.get("firstSeenDate") or "9999-99-99",
            item.get("route", ""),
        )
    for item in eligible:
        first_seen = None
        if first_seen_lookup:
            first_seen = first_seen_lookup(item.get("repoPath") or item.get("route"))
        elif item.get("firstSeenCommit") and item.get("firstSeenDate"):
            first_seen = {"firstSeenCommit": item["firstSeenCommit"], "firstSeenDate": item["firstSeenDate"]}
        if first_seen:
            item["firstSeenCommit"] = first_seen["firstSeenCommit"]
            item["firstSeenDate"] = first_seen["firstSeenDate"]
        else:
            item["firstSeenCommit"] = None
            item["firstSeenDate"] = None
            item["candidateAgeHoldReason"] = "FIRST_SEEN_GIT_HISTORY_UNAVAILABLE"
    for item in eligible:
        if not item.get("firstSeenCommit") or not item.get("firstSeenDate"):
            item["candidateAgeHoldReason"] = "FIRST_SEEN_GIT_HISTORY_UNAVAILABLE"
            item["candidateGatePassed"] = False
            continue
        if str(item["firstSeenDate"]) >= period_start:
            item["candidateAgeHoldReason"] = "PAGE_FIRST_SEEN_ON_OR_AFTER_GA4_PERIOD_START"
            item["candidateGatePassed"] = False
            continue
        item["candidateAgeHoldReason"] = None
        item["candidateGatePassed"] = True
    age_eligible = [item for item in eligible if item.get("candidateGatePassed")]
    return sorted(age_eligible, key=priority)[:max(0, min(int(limit), 50))]


def _content_review(signals, same_locale_inbound, cross_locale_inbound):
    """Only promote clear low-value cases; orphan status alone is not enough."""
    reasons = []
    if signals.get("exactDuplicateOf"):
        reasons.append("EXACT_TEXT_DUPLICATE")
    if signals.get("wrongLanguage"):
        reasons.append("EXPLICIT_LANGUAGE_MISMATCH")
    token_count = int(signals.get("textTokenCount") or 0)
    if token_count < 80:
        reasons.append("VERY_THIN_VISIBLE_CONTENT")
    elif token_count < 180 and signals.get("templateHeavy"):
        reasons.append("THIN_TEMPLATE_HEAVY_CONTENT")
    if (same_locale_inbound + cross_locale_inbound) == 0 and token_count < 250 and signals.get("templateHeavy"):
        reasons.append("ORPHANED_THIN_TEMPLATE")
    return {
        "passed": bool(reasons) and not signals.get("strongUniqueValueHold"),
        "reasons": sorted(set(reasons)),
    }


class _PageParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.lang = None
        self.title_parts = []
        self.description = None
        self.headings = []
        self.text_parts = []
        self.tables = 0
        self.images = 0
        self._active = None
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.lang = attrs.get("lang")
        if tag == "meta" and attrs.get("name", "").lower() == "description":
            self.description = attrs.get("content")
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "table":
            self.tables += 1
        if tag == "img":
            self.images += 1
        if tag in {"script", "style", "noscript"}:
            self._skip_depth += 1
        if tag == "title":
            self._active = "title"
        elif tag in {"h1", "h2", "h3"}:
            self._active = tag
            if tag in {"h1", "h2"}:
                self.headings.append({"tag": tag, "text": ""})

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"} and self._skip_depth:
            self._skip_depth -= 1
        if tag == self._active:
            self._active = None

    def handle_data(self, data):
        if self._skip_depth:
            return
        text = data.strip()
        if not text:
            return
        self.text_parts.append(text)
        if self._active == "title":
            self.title_parts.append(text)
        elif self._active in {"h1", "h2", "h3"} and self.headings:
            if self._active in {"h1", "h2"} and self.headings[-1]["tag"] == self._active:
                self.headings[-1]["text"] += (" " if self.headings[-1]["text"] else "") + text


def _content_language_matches(locale, lang):
    if not lang:
        return False
    primary = lang.strip().lower().replace("_", "-").split("-", 1)[0]
    return primary in LOCALE_LANGUAGES.get(locale, ())


def _page_content_signals(repo_path, locale, parser, duplicate_of=None, inbound_count=0):
    visible_text = " ".join(parser.text_parts)
    normalized_text = re.sub(r"\s+", " ", visible_text).strip().lower()
    tokens = re.findall(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]|[A-Za-z0-9]+", visible_text)
    text_count = len(tokens)
    h1 = [item["text"].strip() for item in parser.headings if item["tag"] == "h1" and item["text"].strip()]
    h2 = [item["text"].strip() for item in parser.headings if item["tag"] == "h2" and item["text"].strip()]
    lang_match = _content_language_matches(locale, parser.lang)
    template_heavy = text_count < 180 or not h1 or not h2
    wrong_language = bool(parser.lang and not lang_match)
    strong_unique_value = bool(not duplicate_of and text_count >= 500 and len(h2) >= 3 and not wrong_language)
    if parser.tables and text_count >= 160 and not duplicate_of and not wrong_language:
        strong_unique_value = True
    return {
        "lang": parser.lang,
        "title": " ".join(parser.title_parts)[:240],
        "description": (parser.description or "")[:300],
        "h1": h1[:5],
        "h2": h2[:12],
        "headingCount": len(parser.headings),
        "textTokenCount": text_count,
        "textSha256": hashlib.sha256(normalized_text.encode("utf-8")).hexdigest() if normalized_text else None,
        "exactDuplicateOf": duplicate_of,
        "wrongLanguage": wrong_language,
        "languageAttributeMissing": not bool(parser.lang),
        "templateHeavy": template_heavy,
        "tableCount": parser.tables,
        "imageCount": parser.images,
        "inboundHtmlCount": inbound_count,
        "strongUniqueValueHold": strong_unique_value,
        "reviewHints": [tag for condition, tag in (
            (duplicate_of is not None, "EXACT_TEXT_DUPLICATE"),
            (wrong_language, "WRONG_LANGUAGE"),
            (not bool(parser.lang), "LANG_ATTRIBUTE_MISSING"),
            (inbound_count == 0, "ORPHANED"),
            (template_heavy, "TEMPLATE_HEAVY_OR_THIN"),
        ) if condition],
        "repoPath": repo_path,
    }


def _path_route(repo_path):
    return _repo_path_route(repo_path)


def _resolve_href(source_repo_path, href, manifest_index):
    base_url = urljoin(PROPERTY_URL, source_repo_path)
    absolute = urljoin(base_url, href)
    parsed = urlsplit(absolute)
    if parsed.netloc.lower() != SITE_HOST or parsed.scheme not in {"http", "https"}:
        return None
    return resolve_manifest_route(parsed.path, manifest_index)


def scan_html_dependencies(repo_root, manifest_index, candidate_routes):
    """Read tracked HTML once, retaining inbound links and lightweight content evidence."""
    candidates = set(candidate_routes)
    inbound = {route: [] for route in candidates}
    target_paths = {item["repoPath"]: item for item in manifest_index["items"]}
    target_text_groups = defaultdict(list)
    content = {}
    for path in Path(repo_root).rglob("*.html"):
        if any(part.startswith(".") or part in {"node_modules", "dist"} for part in path.relative_to(repo_root).parts):
            continue
        repo_path = path.relative_to(repo_root).as_posix()
        try:
            source = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        parser = _PageParser()
        try:
            parser.feed(source)
            parser.close()
        except Exception:
            pass
        source_route = _path_route(repo_path)
        source_parts = repo_path.split("/")
        source_locale = source_parts[0] if source_parts else "root"
        for href in parser.links:
            target_route = _resolve_href(repo_path, href, manifest_index)
            if target_route not in candidates or target_route == source_route:
                continue
            target_locale = _locale_from_route(target_route) or "unknown"
            link = {"sourcePath": repo_path, "sourceLocale": source_locale, "targetLocale": target_locale, "href": href}
            inbound[target_route].append(link)
        if repo_path in target_paths:
            item = target_paths[repo_path]
            visible_text = " ".join(parser.text_parts)
            normalized_text = re.sub(r"\s+", " ", visible_text).strip().lower()
            digest = hashlib.sha256(normalized_text.encode("utf-8")).hexdigest() if normalized_text else None
            if digest:
                target_text_groups[digest].append(repo_path)
            if item["route"] in candidates:
                content[repo_path] = _page_content_signals(
                    repo_path, item["locale"], parser, duplicate_of=None,
                    inbound_count=len(inbound.get(item["route"], [])),
                )

    duplicates = {}
    for paths in target_text_groups.values():
        if len(paths) > 1:
            ordered = sorted(paths)
            for repo_path in ordered:
                duplicates[repo_path] = next((candidate for candidate in ordered if candidate != repo_path), None)
    for repo_path, duplicate_of in duplicates.items():
        if repo_path in content:
            content[repo_path]["exactDuplicateOf"] = duplicate_of
            content[repo_path]["strongUniqueValueHold"] = False
            if "EXACT_TEXT_DUPLICATE" not in content[repo_path]["reviewHints"]:
                content[repo_path]["reviewHints"].append("EXACT_TEXT_DUPLICATE")
    return {"inbound": inbound, "content": content}


def scan_sitemap_feed_references(repo_root, manifest_index, candidate_routes, *, base_sha):
    references = {
        route: {"sitemap_files": [], "feed_files": [], "index_files": []}
        for route in candidate_routes
    }
    tracked = git_list_paths(repo_root, base_sha)
    special_json = {"data/home-feed-ko.json", "data/content-index-ko.json", "data/content-launch-manifest.json"}
    for repo_path in tracked:
        lower = repo_path.lower()
        is_sitemap = "sitemap" in lower and lower.endswith(".xml")
        is_feed = Path(lower).name in {"feed.xml", "rss.xml", "atom.xml", "feed.json", "rss.json", "atom.json"}
        is_index = repo_path in special_json
        if not (is_sitemap or is_feed or is_index):
            continue
        try:
            content = git_show_text(repo_root, base_sha, repo_path)
        except subprocess.CalledProcessError:
            continue
        candidates_found = set()
        if lower.endswith(".xml"):
            try:
                import xml.etree.ElementTree as ET
                root = ET.fromstring(content)
                values = [node.text for node in root.iter() if node.text]
            except Exception:
                values = [content]
        else:
            try:
                values = _strings_from_json(json.loads(content))
            except Exception:
                values = [content]
        for value in values:
            route = resolve_manifest_route(value, manifest_index)
            if route in references:
                candidates_found.add(route)
        for route in candidates_found:
            if is_sitemap:
                references[route]["sitemap_files"].append(repo_path)
            elif is_feed:
                references[route]["feed_files"].append(repo_path)
            elif is_index:
                references[route]["index_files"].append(repo_path)
    return references


def _strings_from_json(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [item for child in value.values() for item in _strings_from_json(child)]
    if isinstance(value, list):
        return [item for child in value for item in _strings_from_json(child)]
    return []


def git_list_paths(repo_root, ref):
    output = subprocess.check_output(["git", "-C", str(repo_root), "ls-tree", "-r", "--name-only", ref], text=True)
    return [line for line in output.splitlines() if line]


def git_blob_size(repo_root, ref, repo_path):
    output = subprocess.check_output(
        ["git", "-C", str(repo_root), "ls-tree", "-r", "-l", ref, "--", repo_path], text=True
    )
    for line in output.splitlines():
        meta, path = line.split("\t", 1)
        if path == repo_path:
            return int(meta.split()[3])
    return None


def summarize_candidate_references(repo_root, base_sha, candidates):
    groups = {"sitemap": defaultdict(set), "feed": defaultdict(set)}
    for item in candidates:
        for kind, field in (("sitemap", "sitemapFiles"), ("feed", "feedFiles")):
            for path in item.get(field, []):
                groups[kind][path].add(item["route"])
    summaries = {}
    for kind, files in groups.items():
        summaries[kind] = [{
            "path": path,
            "trackedBytes": git_blob_size(repo_root, base_sha, path),
            "candidateRoutes": sorted(routes),
            "candidateEntryReferences": len(routes),
        } for path, routes in sorted(files.items())]
    unique_files = {item["path"]: item["trackedBytes"] for items in summaries.values() for item in items}
    summaries["associatedTrackedBytesAffected"] = sum(size or 0 for size in unique_files.values())
    return summaries


def git_show_text(repo_root, ref, path):
    return subprocess.check_output(["git", "-C", str(repo_root), "show", f"{ref}:{path}"], text=True, encoding="utf-8", errors="replace")


def git_first_seen_many(repo_root, ref, repo_paths):
    """Find each route path's first Git add in one history walk.

    Rename detection is disabled deliberately: a renamed source path represents a
    new static route path, and treating it as a new add is the conservative age
    boundary for a deletion canary.
    """
    requested = sorted(set(str(path) for path in repo_paths if path))
    if not requested:
        return {}
    requested_set = set(requested)
    output = subprocess.check_output([
        "git", "-C", str(repo_root), "log", "--reverse", "--diff-filter=A", "--no-renames",
        "--format=COMMIT:%H%x09%cI", "--name-only", ref, "--", *requested,
    ], text=True, errors="replace")
    result = {}
    current_commit = None
    current_date = None
    for line in output.splitlines():
        if line.startswith("COMMIT:"):
            fields = line.removeprefix("COMMIT:").split("\t", 1)
            current_commit = fields[0] if len(fields) == 2 else None
            current_date = None
            if len(fields) == 2:
                try:
                    current_date = datetime.fromisoformat(fields[1].replace("Z", "+00:00")).astimezone(
                        ZoneInfo("Asia/Seoul")
                    ).date().isoformat()
                except ValueError:
                    current_commit = None
        elif line in requested_set and line not in result and current_commit and current_date:
            result[line] = {"firstSeenCommit": current_commit, "firstSeenDate": current_date}
    return result


def git_first_seen(repo_root, ref, repo_path):
    """Return one route path's first Git add, using the batched implementation."""
    return git_first_seen_many(repo_root, ref, [repo_path]).get(repo_path)


def git_manifest(repo_root, base_sha):
    output = subprocess.check_output(["git", "-C", str(repo_root), "ls-tree", "-r", "-l", base_sha], text=True)
    entries = []
    for line in output.splitlines():
        meta, path = line.split("\t", 1)
        fields = meta.split()
        if path.endswith(".html") and path.split("/", 1)[0] in LOCALES:
            entries.append((path, int(fields[3])))
    return build_manifest_index(entries)


def _route_from_any(value, manifest_index):
    return resolve_manifest_route(value, manifest_index)


def route_sets_from_main(repo_root, base_sha, manifest_index, today):
    revenue = json.loads(git_show_text(repo_root, base_sha, "data/revenue-opportunities.json"))
    page_performance = json.loads(git_show_text(repo_root, base_sha, "data/page-performance.json"))
    protected = set()
    opportunities = set()
    experiments = set()
    for item in revenue.get("protectedWinners", []):
        route = _route_from_any(item.get("url"), manifest_index)
        if route:
            protected.add(route)
    collections = [
        revenue.get("eligibleCandidates", []),
        revenue.get("selectedImprovements", []),
        revenue.get("topOpportunities", []),
        page_performance.get("pages", []),
    ]
    for collection in collections:
        for item in collection:
            if str(item.get("classification", "")).upper() in {"OPPORTUNITY", "EXPERIMENT"}:
                route = _route_from_any(item.get("url"), manifest_index)
                if route:
                    opportunities.add(route)
                    if str(item.get("classification", "")).upper() == "EXPERIMENT":
                        experiments.add(route)
    for path in ("data/content-launch-experiments.json",):
        try:
            data = json.loads(git_show_text(repo_root, base_sha, path))
        except (subprocess.CalledProcessError, json.JSONDecodeError):
            continue
        for item in data.get("experiments", []):
            status = str(item.get("status", "")).upper()
            end_dates = [item.get("observe_until"), item.get("cooldownUntil"), item.get("cooldown_until")]
            recent = status in {"ACTIVE", "RUNNING", "OBSERVING", "IN_PROGRESS"} or any(
                isinstance(value, str) and value[:10] >= today.isoformat() for value in end_dates if value
            )
            route = _route_from_any(item.get("url"), manifest_index)
            if route and recent:
                experiments.add(route)
    for item in revenue.get("activeExperiments", []):
        status = str(item.get("status", "")).upper()
        end_dates = [item.get("observe_until"), item.get("cooldownUntil"), item.get("cooldown_until")]
        recent = status in {"ACTIVE", "RUNNING", "OBSERVING", "IN_PROGRESS"} or any(
            isinstance(value, str) and value[:10] >= today.isoformat() for value in end_dates if value
        )
        route = _route_from_any(item.get("url"), manifest_index)
        if route and recent:
            experiments.add(route)
    opportunities -= protected
    return protected, opportunities, experiments


def scan_runtime_references(repo_root, base_sha, candidate_routes, output_dir):
    """Find literal references in runtime source; keep test fixture hits separate."""
    routes = sorted(set(candidate_routes))
    if not routes:
        return {}
    patterns = {}
    for route in routes:
        patterns[route] = route
        patterns[route.lstrip("/")] = route
    pattern_path = Path(output_dir) / "candidate-route-patterns.txt"
    pattern_path.write_text("\n".join(patterns) + "\n", encoding="utf-8")
    pathspecs = ["scripts", ".github", "tests", "util", "game", "kor/stockwiki/src"]
    command = ["git", "-C", str(repo_root), "grep", "-I", "-n", "-o", "-F", "-f", str(pattern_path), base_sha, "--", *pathspecs]
    proc = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    pattern_path.unlink(missing_ok=True)
    if proc.returncode not in (0, 1):
        raise RuntimeError("runtime dependency scan failed: " + proc.stderr[:300])
    result = {route: {"runtime": [], "tests": []} for route in routes}
    for line in proc.stdout.splitlines():
        parts = line.split(":", 2)
        if len(parts) < 3:
            continue
        source_path, line_number, matched = parts
        route = patterns.get(matched)
        if not route:
            continue
        record = {"path": source_path, "line": int(line_number)}
        key = "tests" if source_path.startswith("tests/") else "runtime"
        if record not in result[route][key] and len(result[route][key]) < 20:
            result[route][key].append(record)
    return result


def build_dependency_map(repo_root, base_sha, manifest_index, candidate_routes, output_dir):
    candidate_routes = sorted(set(candidate_routes))
    if not candidate_routes:
        return {}
    html = scan_html_dependencies(repo_root, manifest_index, candidate_routes)
    xml_refs = scan_sitemap_feed_references(repo_root, manifest_index, candidate_routes, base_sha=base_sha)
    code_refs = scan_runtime_references(repo_root, base_sha, candidate_routes, output_dir)
    target_locale = {route: _locale_from_route(route) for route in candidate_routes}
    dependency_map = {}
    for route in candidate_routes:
        links = html["inbound"].get(route, [])
        cross = [link for link in links if link["sourceLocale"] != target_locale[route]]
        same = [link for link in links if link["sourceLocale"] == target_locale[route]]
        route_items = manifest_index["by_route"].get(route, [])
        signals = [html["content"].get(item["repoPath"], {}) for item in route_items]
        content = signals[0] if signals else {}
        refs = code_refs.get(route, {"runtime": [], "tests": []})
        sitemap_files = sorted(xml_refs[route]["sitemap_files"])
        feed_files = sorted(xml_refs[route]["feed_files"])
        index_files = sorted(xml_refs[route]["index_files"])
        # A route may appear at most once in its locale sitemap and once in an optional feed/index.
        cleanup_straightforward = len(sitemap_files) <= 1 and len(feed_files) <= 1 and len(index_files) <= 3
        dependency_map[route] = {
            "cross_locale_inbound_html": len(cross),
            "same_locale_inbound_html": len(same),
            "inbound_samples": (cross + same)[:12],
            "code_references": refs["runtime"],
            "test_references": refs["tests"],
            "sitemap_files": sitemap_files,
            "feed_files": feed_files,
            "index_files": index_files,
            "cleanup_straightforward": cleanup_straightforward,
            "unique_value_hold": bool(content.get("strongUniqueValueHold")),
            "content_signals": content,
        }
    return dependency_map


def _manifest_stats(manifest_index):
    locale_counts = Counter(item["locale"] for item in manifest_index["items"])
    return {
        "count": len(manifest_index["items"]),
        "uniqueRoutes": len(manifest_index["by_route"]),
        "bytes": sum(item["bytes"] or 0 for item in manifest_index["items"]),
        "byLocale": {locale: locale_counts.get(locale, 0) for locale in LOCALES},
        "routeCollisionCount": len(manifest_index["manifestCollisions"]),
    }


def _counts(classifications):
    return dict(sorted(Counter(item["status"] for item in classifications).items()))


def _locale_counts(classifications):
    result = {}
    for locale in LOCALES:
        rows = [item for item in classifications if item["locale"] == locale]
        result[locale] = {
            "manifestPages": len(rows),
            "statuses": _counts(rows),
            "deleteCanaryGatePassed": sum(bool(item.get("candidateGatePassed") and item.get("contentReviewPassed")) for item in rows),
        }
    return result


def _build_ga4_client(property_id, service_account_info):
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.oauth2 import service_account
    credentials = service_account.Credentials.from_service_account_info(
        service_account_info, scopes=["https://www.googleapis.com/auth/analytics.readonly"]
    )
    return BetaAnalyticsDataClient(credentials=credentials)


def _ga4_service_account_from_env():
    encoded = os.environ.get("GA4_SERVICE_ACCOUNT_JSON_B64")
    property_id = os.environ.get("GA4_PROPERTY_ID")
    if not encoded or not property_id:
        raise RuntimeError("GA4_PROPERTY_ID or GA4_SERVICE_ACCOUNT_JSON_B64 is unavailable")
    try:
        info = json.loads(base64.b64decode(encoded).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("GA4 service-account configuration is invalid") from exc
    if not isinstance(info, dict) or info.get("type") != "service_account":
        raise RuntimeError("GA4 service-account configuration is invalid")
    return property_id, info


def _collect_ga4_period(client, property_id, period, *, expected_timezone):
    from google.analytics.data_v1beta.types import DateRange, Dimension, Metric, RunReportRequest
    def fetch(offset, limit):
        request = RunReportRequest(
            property=f"properties/{property_id}",
            dimensions=[Dimension(name="pagePathPlusQueryString")],
            metrics=[Metric(name=name) for name, _ in GA4_METRICS],
            date_ranges=[DateRange(start_date=period["start"], end_date=period["end"])],
            limit=limit,
            offset=str(offset),
            keep_empty_rows=False,
        )
        return client.run_report(request)
    return collect_ga4_report(
        fetch,
        requested_rows=GA4_REQUEST_LIMIT,
        expected_timezone=expected_timezone,
        keep_empty_rows=False,
    )


def _gsc_service_from_env(encoded):
    from googleapiclient.discovery import build
    from google.oauth2 import service_account
    try:
        info = json.loads(base64.b64decode(encoded).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Search Console service-account configuration is invalid") from exc
    if not isinstance(info, dict) or info.get("type") != "service_account":
        raise RuntimeError("Search Console service-account configuration is invalid")
    credentials = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    service = build("searchconsole", "v1", credentials=credentials, cache_discovery=False)
    service.sites().get(siteUrl=PROPERTY_URL).execute()
    return service


def _collect_gsc_period(service, locale, period):
    def fetch(body):
        response = service.searchanalytics().query(siteUrl=PROPERTY_URL, body=body).execute()
        return response.get("rows") or []
    return collect_gsc_locale(fetch, locale=locale, start_date=period["start"], end_date=period["end"])


def _atomic_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        tmp = Path(handle.name)
    tmp.replace(path)


def write_artifacts(output_dir, summary, page_rows, ga4_raw, gsc_raw):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    if os.environ.get("GITHUB_ACTIONS") == "true":
        runner_temp = Path(os.environ["RUNNER_TEMP"]).resolve()
        if not output_dir.resolve().is_relative_to(runner_temp):
            raise RuntimeError("Actions audit artifacts must remain under RUNNER_TEMP")
    _atomic_json(output_dir / "locale-90d-summary.json", summary)
    _atomic_json(output_dir / "locale-90d-ga4-raw.json", ga4_raw)
    _atomic_json(output_dir / "locale-90d-gsc-raw.json", gsc_raw)
    fields = [
        "repoPath", "locale", "route", "bytes", "status", "holdReason", "ga4NoActivityRowEligible", "ga4Status",
        "ga4Metrics", "ga4RawPaths", "gscStatus", "gscMetrics", "gscRawUrls", "normalizationCollision",
        "crossLocaleInboundHtml", "sameLocaleInboundHtml", "codeReferences", "testReferences", "sitemapFiles",
        "feedFiles", "indexFiles", "cleanupStraightforward", "contentSignals", "preAgeCandidateGatePassed",
        "candidateGatePassed", "firstSeenCommit", "firstSeenDate", "candidateAgeHoldReason",
        "contentReviewPassed", "contentReviewReasons",
    ]
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", dir=output_dir, delete=False) as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in page_rows:
            encoded = {key: json.dumps(row.get(key), ensure_ascii=False) if isinstance(row.get(key), (dict, list)) else row.get(key) for key in fields}
            writer.writerow(encoded)
        tmp = Path(handle.name)
    tmp.replace(output_dir / "locale-90d-pages.csv")
    return [
        output_dir / "locale-90d-summary.json",
        output_dir / "locale-90d-pages.csv",
        output_dir / "locale-90d-ga4-raw.json",
        output_dir / "locale-90d-gsc-raw.json",
    ]


def run_audit(repo_root, base_sha, output_dir, *, now=None):
    repo_root = Path(repo_root)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    repo_top = Path(subprocess.check_output(
        ["git", "-C", str(repo_root), "rev-parse", "--show-toplevel"], text=True
    ).strip()).resolve()
    output_resolved = output_dir.resolve()
    if output_resolved.is_relative_to(repo_top):
        raise RuntimeError("raw audit artifacts must be written outside the Git worktree")
    periods = build_periods(now)
    manifest_index = git_manifest(repo_root, base_sha)
    manifest_stats = _manifest_stats(manifest_index)
    if not manifest_index["items"]:
        raise RuntimeError("latest-main locale HTML manifest is empty")

    now_dt = datetime.now(timezone.utc) if now is None else (datetime.fromisoformat(now.replace("Z", "+00:00")) if isinstance(now, str) else now)
    today = now_dt.astimezone(ZoneInfo("Asia/Seoul")).date()
    protected, opportunities, experiments = route_sets_from_main(repo_root, base_sha, manifest_index, today)
    property_id, ga4_info = _ga4_service_account_from_env()
    ga4_client = _build_ga4_client(property_id, ga4_info)
    ga4_raw = {"baseMainSha": base_sha, "periods": periods["ga4"], "reports": {}}
    for key in ("90d", "latest28d", "prior28d"):
        try:
            ga4_raw["reports"][key] = _collect_ga4_period(
                ga4_client, property_id, periods["ga4"][key], expected_timezone=periods["ga4"]["reportingTimeZone"]
            )
        except Exception as exc:
            if key == "90d":
                raise RuntimeError("required GA4 90-day collection failed: " + type(exc).__name__) from exc
            ga4_raw["reports"][key] = {"requestStatus": "UNAVAILABLE", "errorType": type(exc).__name__}

    encoded = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON_B64") or os.environ.get("GA4_SERVICE_ACCOUNT_JSON_B64")
    if not encoded:
        raise RuntimeError("Search Console service-account configuration is unavailable")
    gsc_service = _gsc_service_from_env(encoded)
    gsc_raw = {"baseMainSha": base_sha, "period": periods["gsc"]["90d"], "locales": {}}
    for locale in LOCALES:
        try:
            gsc_raw["locales"][locale] = _collect_gsc_period(gsc_service, locale, periods["gsc"]["90d"])
        except Exception as exc:
            gsc_raw["locales"][locale] = {
                "locale": locale,
                "period": periods["gsc"]["90d"],
                "rowsRetrieved": 0,
                "pagesFetched": 0,
                "stoppedBecause": "API_ERROR",
                "paginationExhausted": False,
                "coverageStatus": "UNAVAILABLE",
                "requestStatus": "FAILED",
                "errorType": type(exc).__name__,
                "rows": [],
            }

    ga4_90 = ga4_raw["reports"]["90d"]
    ga4_join = aggregate_ga4_rows(ga4_90.get("rows", []), manifest_index)
    gsc_join = aggregate_gsc_rows(
        [row for locale in LOCALES for row in gsc_raw["locales"][locale].get("rows", [])], manifest_index
    )
    gsc_success_locales = {
        locale for locale in LOCALES if gsc_raw["locales"][locale].get("requestStatus") == "SUCCESS"
    }
    initial = classify_manifest_routes(
        manifest_index["items"], ga4_90,
        [row for locale in LOCALES for row in gsc_raw["locales"][locale].get("rows", [])],
        protected_routes=protected,
        opportunity_routes=opportunities,
        experiment_routes=experiments,
        dependencies={},
        gsc_success_locales=gsc_success_locales,
    )
    dependency_routes = {
        item["route"] for item in initial
        if item["status"] == "GA4_90D_NO_ACTIVITY_ROW"
        and item["ga4NoActivityRowEligible"]
        and item["route"] not in protected
        and item["route"] not in opportunities
        and item["route"] not in experiments
    }
    dependency_routes.update(route for route in JP_REVIEW_ROUTES if route in manifest_index["by_route"])
    dependency_map = build_dependency_map(repo_root, base_sha, manifest_index, dependency_routes, output_dir)
    page_rows = classify_manifest_routes(
        manifest_index["items"], ga4_90,
        [row for locale in LOCALES for row in gsc_raw["locales"][locale].get("rows", [])],
        protected_routes=protected,
        opportunity_routes=opportunities,
        experiment_routes=experiments,
        dependencies=dependency_map,
        gsc_success_locales=gsc_success_locales,
    )
    counts = _counts(page_rows)
    if sum(counts.values()) != manifest_stats["count"]:
        raise RuntimeError("status counts do not conserve latest-main manifest total")
    no_activity_row_count = sum(bool(item["ga4NoActivityRowEligible"]) for item in page_rows)
    period_start = periods["ga4"]["90d"]["start"]
    candidate_age_paths = [
        item.get("repoPath") or item.get("route") for item in page_rows
        if item.get("preAgeCandidateGatePassed") and item.get("contentReviewPassed")
    ]
    first_seen_by_path = git_first_seen_many(repo_root, base_sha, candidate_age_paths)
    candidate_pool = select_batch_a(
        page_rows,
        limit=50,
        period_start=period_start,
        first_seen_lookup=first_seen_by_path.get,
    )
    candidate_references = summarize_candidate_references(repo_root, base_sha, candidate_pool)
    gsc_locale_summary = {
        locale: {key: value for key, value in gsc_raw["locales"][locale].items() if key != "rows"}
        for locale in LOCALES
    }
    summary = {
        "result": "LOCALE_CANARY_READY" if candidate_pool else "NO_SAFE_CANARY",
        "baseMainSha": base_sha,
        "auditHeadSha": subprocess.check_output(["git", "-C", str(repo_root), "rev-parse", "HEAD"], text=True).strip(),
        "periods": periods,
        "manifest": manifest_stats,
        "protectedRoutes": len(protected & set(manifest_index["by_route"])),
        "opportunityRoutes": len(opportunities & set(manifest_index["by_route"])),
        "recentExperimentRoutes": len(experiments & set(manifest_index["by_route"])),
        "ga4": {
            "dimension": "pagePathPlusQueryString",
            "metrics": [name for name, _ in GA4_METRICS],
            "limit": GA4_REQUEST_LIMIT,
            "keepEmptyRows": False,
            "reports": {
                key: {field: report.get(field) for field in (
                    "requestedRows", "requestedRowsTotal", "rowCount", "retrievedRows", "pagesFetched",
                    "stoppedBecause", "rowCountConsistent", "metadataConsistent", "complete", "zeroEligible",
                    "keepEmptyRows", "currencyCode", "timeZone", "subjectToThresholdingValue",
                    "subjectToThresholdingPresent", "dataLossFromOtherRow", "samplingMetadatas",
                    "dataTruncationReasons", "schemaRestrictionResponse", "emptyReason", "metadata",
                )} for key, report in ga4_raw["reports"].items()
            },
            "unmatchedTargetRows": len(ga4_join["unmatchedRows"]),
            "latest90dActivityRowsMatched": len(ga4_join["routes"]),
        },
        "gsc": {
            "dimension": "page",
            "type": "web",
            "dataState": "final",
            "rowLimit": GSC_ROW_LIMIT,
            "perLocale": gsc_locale_summary,
            "coverageLimitation": "Search Analytics API does not guarantee all rows; NO_GSC_ROW is not verified zero.",
            "unmatchedTargetRows": len(gsc_join["unmatchedRows"]),
        },
        "classificationCounts": counts,
        "localeClassifications": _locale_counts(page_rows),
        "ga4NoActivityRowEligiblePages": no_activity_row_count,
        "jpReviewRoutes": [{
            "route": item["route"],
            "status": item["status"],
            "ga4Status": item["ga4Status"],
            "ga4Metrics": item["ga4Metrics"],
            "gscStatus": item["gscStatus"],
            "gscMetrics": item["gscMetrics"],
            "crossLocaleInboundHtml": item["crossLocaleInboundHtml"],
            "sameLocaleInboundHtml": item["sameLocaleInboundHtml"],
            "sitemapFiles": item["sitemapFiles"],
            "feedFiles": item["feedFiles"],
            "codeReferences": item["codeReferences"],
            "testReferences": item["testReferences"],
            "contentSignals": item["contentSignals"],
        } for item in page_rows if item["route"] in JP_REVIEW_ROUTES],
        "batchAReviewPool": [{
            "locale": item["locale"],
            "repoPath": item["repoPath"],
            "route": item["route"],
            "bytes": item["bytes"],
            "firstSeenCommit": item["firstSeenCommit"],
            "firstSeenDate": item["firstSeenDate"],
            "gscStatus": item["gscStatus"],
            "ga4Metrics": item["ga4Metrics"],
            "crossLocaleInboundHtml": item["crossLocaleInboundHtml"],
            "sitemapFiles": item["sitemapFiles"],
            "feedFiles": item["feedFiles"],
            "indexFiles": item["indexFiles"],
            "codeReferences": item["codeReferences"],
            "sameLocaleInboundHtml": item["sameLocaleInboundHtml"],
            "contentSignals": item["contentSignals"],
            "reasonCodes": item["contentReviewReasons"],
            "status": "TECHNICAL_GATE_PASSED",
        } for item in candidate_pool],
        "batchACandidates": [{
            "locale": item["locale"],
            "repoPath": item["repoPath"],
            "route": item["route"],
            "bytes": item["bytes"],
            "firstSeenCommit": item["firstSeenCommit"],
            "firstSeenDate": item["firstSeenDate"],
            "ga4Metrics": item["ga4Metrics"],
            "gscStatus": item["gscStatus"],
            "gscMetrics": item["gscMetrics"],
            "crossLocaleInboundHtml": item["crossLocaleInboundHtml"],
            "sameLocaleInboundHtml": item["sameLocaleInboundHtml"],
            "sitemapFiles": item["sitemapFiles"],
            "feedFiles": item["feedFiles"],
            "indexFiles": item["indexFiles"],
            "codeReferences": item["codeReferences"],
            "reasonCodes": item["contentReviewReasons"],
            "contentSignals": item["contentSignals"],
        } for item in candidate_pool],
        "batchACandidatesStatus": "CANDIDATES_READY_FOR_CONTROL_TOWER_REVIEW" if candidate_pool else "NO_HIGH_CONFIDENCE_CANDIDATES",
        "batchAFileCount": len(candidate_pool),
        "currentTreeSavingsBytes": sum(item["bytes"] or 0 for item in candidate_pool),
        "currentTreeSavingsEstimate": {
            "htmlBytes": sum(item["bytes"] or 0 for item in candidate_pool),
            "associatedSitemapFeedTrackedBytesAffected": candidate_references["associatedTrackedBytesAffected"],
            "associatedSitemapFiles": candidate_references["sitemap"],
            "associatedFeedFiles": candidate_references["feed"],
            "note": "HTML removal bytes are exact; sitemap/feed trackedBytesAffected identifies files requiring deterministic entry cleanup and is not added as full-file savings.",
        },
        "sitemapChangesRequired": candidate_references["sitemap"],
        "feedChangesRequired": candidate_references["feed"],
        "batchACandidatePages": len(candidate_pool),
        "rawGitTracked": 0,
    }
    write_artifacts(output_dir, summary, page_rows, ga4_raw, gsc_raw)
    return summary


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-sha", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    args = parser.parse_args(argv)
    try:
        summary = run_audit(args.repo_root, args.base_sha, args.output_dir)
    except Exception as exc:
        raise SystemExit(f"locale audit failed safely: {type(exc).__name__}: {str(exc)[:300]}") from exc
    print(json.dumps({
        "result": summary["result"],
        "baseMainSha": summary["baseMainSha"],
        "manifestCount": summary["manifest"]["count"],
        "ga4ZeroEligible": summary["ga4"]["reports"].get("90d", {}).get("zeroEligible"),
        "ga4RowCount": summary["ga4"]["reports"].get("90d", {}).get("rowCount"),
        "batchACandidateCount": len(summary["batchACandidates"]),
        "batchAReviewPoolCount": len(summary["batchAReviewPool"]),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
