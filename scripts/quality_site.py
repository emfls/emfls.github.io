#!/usr/bin/env python3
"""Join performance signals, rank improvements, and aggregate site quality."""

import json
from pathlib import Path
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
    return {normalize_url(row.get("url")): row for row in data.get("pages", []) if row.get("url")}


def _metric(value, status):
    return {"value": value, "status": status}


def rank_priority(page_result, metrics):
    measured = bool(metrics and any(metrics.get(key) is not None for key in (
        "impressions", "organic_clicks", "average_position", "sessions", "opportunity_score"
    )))
    values = metrics or {}
    quality_gap = max(0.0, min(100.0, 100.0 - float(page_result.get("score", 0))))
    search_opportunity = min(100.0, max(0.0, float(values.get("opportunity_score") or 0) / 5))
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
    raise NotImplementedError("implemented in Task 5")
