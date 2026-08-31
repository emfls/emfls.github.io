#!/usr/bin/env python3
"""Join performance signals, rank improvements, and aggregate site quality."""

import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from statistics import mean, median
from urllib.parse import urlparse


def normalize_url(url):
    value = str(url or "").strip()
    if value.startswith(("http://", "https://")):
        value = urlparse(value).path or "/"
    if not value.startswith("/"):
        value = "/" + value
    return value.replace("/index.html", "/")


def latest_performance_file(directory):
    candidates = sorted(Path(directory).glob("*.json"))
    return candidates[-1] if candidates else None


def performance_by_url(data):
    normalized = {}
    for row in data.get("pages", []):
        if not row.get("url"):
            continue
        values = dict(row)
        ga4 = row.get("ga4") or {}
        google = row.get("google") or {}
        if ga4:
            values.setdefault("sessions", ga4.get("views"))
            values.setdefault("active_users", ga4.get("users"))
            values.setdefault("engagement_seconds", ga4.get("engagementSeconds"))
        if google:
            values.setdefault("organic_clicks", google.get("clicks"))
            values.setdefault("impressions", google.get("impressions"))
            values.setdefault("search_ctr", google.get("ctr"))
            values.setdefault("average_position", google.get("position"))
        normalized[normalize_url(row.get("url"))] = values
    return normalized


def _metric(value, status):
    return {"value": value, "status": status}


def rank_priority(page_result, metrics):
    measured = bool(metrics and any(metrics.get(key) is not None for key in (
        "impressions", "organic_clicks", "average_position", "sessions", "opportunity_score"
    )))
    values = metrics or {}
    quality_gap = max(0.0, min(100.0, 100.0 - float(page_result.get("score", 0))))
    search_opportunity = min(100.0, max(0.0, float(values.get("opportunity_score") or 0) / 5 * 100))
    impressions = max(0.0, float(values.get("impressions") or 0))
    sessions = max(0.0, float(values.get("sessions") or 0))
    traffic_signal = min(100.0, impressions / 200 + sessions / 20)
    type_value = {"MONEY": 100.0, "TOOL": 85.0, "TRAFFIC": 60.0, "HUB": 55.0, "TRUST": 30.0, "UTILITY": 25.0}.get(
        page_result.get("type"), 40.0
    )
    issue_count = len(page_result.get("issues") or [])
    ease_of_fix = max(20.0, 100.0 - issue_count * 12.5)
    priority = (
        quality_gap * 0.30
        + search_opportunity * 0.35
        + traffic_signal * 0.15
        + type_value * 0.10
        + ease_of_fix * 0.10
    )
    if not measured:
        priority *= 0.60
    metric_status = "VERIFIED" if measured else "NOT_CONNECTED"
    return {
        "score": round(priority, 2),
        "level": "HIGH" if priority >= 65 else "MEDIUM" if priority >= 40 else "LOW",
        "basis": "MEASURED" if measured else "ESTIMATED",
        "components": {
            "quality_gap": round(quality_gap, 2),
            "search_opportunity": round(search_opportunity, 2),
            "traffic_signal": round(traffic_signal, 2),
            "type_value": round(type_value, 2),
            "ease_of_fix": round(ease_of_fix, 2),
        },
        "metrics": {
            "impressions": _metric(values.get("impressions"), metric_status),
            "clicks": _metric(values.get("organic_clicks"), metric_status),
            "search_ctr": _metric(values.get("search_ctr"), metric_status),
            "average_position": _metric(values.get("average_position"), metric_status),
            "sessions": _metric(values.get("sessions"), metric_status),
            "revenue": _metric(None, "NOT_CONNECTED"),
            "rpm": _metric(None, "NOT_CONNECTED"),
        },
    }


def load_performance(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def calculate_revenue_goal(adsense):
    if not adsense:
        return {"status": "DATA NOT AVAILABLE", "reason": "AdSense export is not connected."}
    earnings = float(adsense.get("estimated_earnings_usd") or 0)
    page_views = float(adsense.get("page_views") or 0)
    rpm = float(adsense.get("page_rpm") or 0)
    if min(earnings, page_views, rpm) < 0:
        raise ValueError("AdSense earnings, page views, and RPM must be non-negative")
    period = adsense.get("period") or {}
    try:
        start = datetime.strptime(period["start"], "%Y-%m-%d").date()
        end = datetime.strptime(period["end"], "%Y-%m-%d").date()
    except (KeyError, TypeError, ValueError):
        return {"status": "DATA NOT AVAILABLE", "reason": "AdSense period is missing or invalid."}
    days = (end - start).days + 1
    if days <= 0 or rpm <= 0:
        return {"status": "DATA NOT AVAILABLE", "reason": "AdSense period or RPM cannot support the goal calculation."}
    daily = earnings / days
    warnings = []
    calculated_rpm = earnings * 1000 / page_views if page_views else 0
    if page_views and calculated_rpm and abs(rpm - calculated_rpm) / calculated_rpm > 0.1:
        warnings.append("source_rpm_differs_from_earnings_divided_by_page_views")
    return {
        "status": "VERIFIED",
        "label": "historical_period_daily_average" if days > 90 else "period_daily_average",
        "period": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "daily_revenue_usd": round(daily, 2),
        "target_daily_revenue_usd": 100.0,
        "achievement_rate": round(daily / 100, 4),
        "required_growth": round(100 / daily, 2) if daily else None,
        "page_views": int(page_views),
        "page_rpm": round(rpm, 2),
        "required_page_views": round(100 / rpm * 1000),
        "warnings": warnings,
    }


def _site_grade(score):
    if score >= 95:
        return "S"
    if score >= 90:
        return "A+"
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    if score >= 60:
        return "C"
    return "F"


def _section(score, maximum, status, reasons):
    return {"score": min(maximum, max(0, int(round(score)))), "max": maximum, "status": status, "reasons": list(reasons)}


def calculate_site_score(page_results, system_context):
    pages = list(page_results)
    total = len(pages)
    page_scores = [int(page.get("score") or 0) for page in pages]
    grades = Counter(page.get("grade") for page in pages)
    grade_counts = {grade: grades.get(grade, 0) for grade in ("S", "A", "B", "C", "D", "F")}
    ratio_80 = sum(score >= 80 for score in page_scores) / total if total else 0
    ratio_fail = sum(score < 60 for score in page_scores) / total if total else 0
    tool_count = sum(page.get("type") == "TOOL" for page in pages)

    portfolio = (
        5 * bool(total)
        + 5 * bool(system_context.get("category_structure_ok", True))
        + 5 * ratio_80
        + 5 * max(0, 1 - ratio_fail)
        + 5 * bool(tool_count)
    )
    search_connected = system_context.get("gsc_state") == "CSV_CONNECTED"
    ga_connected = system_context.get("ga4_state") == "CSV_CONNECTED"
    search = (
        3 * search_connected
        + 3 * bool(system_context.get("sitemap_ok"))
        + 3 * bool(system_context.get("index_tracking", search_connected))
        + 3 * search_connected
        + 3 * search_connected
        + 2 * bool(system_context.get("decline_detection", False))
        + 3 * bool(search_connected or ga_connected)
    )
    breadcrumb_ratio = float(system_context.get("breadcrumb_ratio") or 0)
    orphan_ratio = float(system_context.get("orphan_ratio") or 0)
    structure = (
        3 * bool(system_context.get("three_click_access", False))
        + 3 * bool(system_context.get("category_structure_ok", True))
        + 2 * breadcrumb_ratio
        + 3 * bool(system_context.get("internal_link_system", total > 0))
        + 2 * max(0, 1 - orphan_ratio)
        + 2 * bool(system_context.get("url_consistency", True))
    )
    canonical_ratio = float(system_context.get("canonical_ratio") or 0)
    schema_ratio = float(system_context.get("structured_data_ratio") or 0)
    technical = (
        2 * bool(system_context.get("https_ok"))
        + 1
        + 2 * bool(system_context.get("sitemap_ok"))
        + 1 * bool(system_context.get("robots_ok"))
        + 2 * canonical_ratio
        + 2 * bool(system_context.get("mobile_baseline", True))
        + 2 * bool(system_context.get("performance_connected", False))
        + 1 * bool(system_context.get("custom_404", True))
        + 1 * schema_ratio
        + 1 * bool(system_context.get("mixed_content_safe", True))
    )
    trust_pages = set(system_context.get("trust_pages") or set())
    trust = (
        2 * ("about" in trust_pages)
        + 2 * ("contact" in trust_pages)
        + 2 * ("privacy" in trust_pages)
        + 1 * ("terms" in trust_pages)
        + 1 * ("disclaimer" in trust_pages)
        + 2 * ("methodology" in trust_pages)
    )
    monetization = (
        3 * bool(system_context.get("adsense_policy_safe"))
        + 2 * bool(system_context.get("ad_placement_reviewed", False))
        + 2 * bool(system_context.get("viewability_connected", False))
        + 2 * bool(system_context.get("url_revenue_connected", False))
        + 2 * bool(system_context.get("ad_ux_safe", True))
        + 2 * bool(any(page.get("type") in {"MONEY", "TOOL"} for page in pages))
        + 2 * bool(total)
    )
    scores = {
        "contentPortfolio": _section(portfolio, 25, "ESTIMATED", ["page_grade_distribution", "tool_inventory"]),
        "searchAcquisition": _section(search, 20, "VERIFIED" if search_connected else "NOT_CONNECTED", [system_context.get("gsc_state", "NOT_CONNECTED")]),
        "siteStructure": _section(structure, 15, "ESTIMATED", ["breadcrumb_and_orphan_coverage"]),
        "technicalHealth": _section(technical, 15, "ESTIMATED", ["static_audit_coverage"]),
        "trust": _section(trust, 10, "VERIFIED", sorted(trust_pages)),
        "monetization": _section(monetization, 15, "ESTIMATED", ["no_ad_click_tracking", "url_revenue_not_assumed"]),
    }
    score = sum(section["score"] for section in scores.values())
    return {
        "score": score,
        "grade": _site_grade(score),
        "scores": scores,
        "kpis": {
            "total_pages": total,
            "grades": grade_counts,
            "average_page_score": round(mean(page_scores), 2) if page_scores else 0,
            "median_page_score": round(median(page_scores), 2) if page_scores else 0,
            "pages_80_plus_ratio": round(ratio_80, 4),
            "pages_under_60_ratio": round(ratio_fail, 4),
            "targets": {"site_score": 90, "pages_80_plus_ratio": 0.8, "pages_under_60_ratio": 0.03},
        },
        "connections": {
            "gsc": system_context.get("gsc_state", "NOT_CONNECTED"),
            "ga4": system_context.get("ga4_state", "NOT_CONNECTED"),
            "url_adsense": "NOT_CONNECTED",
        },
    }
