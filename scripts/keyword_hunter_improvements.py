"""Select measured existing-page opportunities without modifying pages."""

from datetime import date

from scripts.keyword_hunter_core import number


DEFAULT_THRESHOLDS = {
    "min_search_impressions": 100,
    "max_low_ctr": 0.05,
    "google_position_min": 5,
    "google_position_max": 30,
    "min_ga4_views": 50,
    "max_page_score": 75,
}


def _verified(channel):
    return isinstance(channel, dict) and channel.get("status") == "VERIFIED"


def _period(channel):
    value = channel.get("period")
    if not isinstance(value, dict):
        return None, "UNKNOWN"
    start, end = value.get("start"), value.get("end")
    if not isinstance(start, str) or not isinstance(end, str):
        return None, "UNKNOWN"
    try:
        start_date, end_date = date.fromisoformat(start), date.fromisoformat(end)
    except ValueError:
        return None, "UNKNOWN"
    if start_date.isoformat() != start or end_date.isoformat() != end or start_date > end_date:
        return None, "UNKNOWN"
    return {"start": start, "end": end}, "AVAILABLE"


def _channel_metrics(channel, metric_names):
    metrics = {
        key: channel.get(key)
        for key in metric_names
        if number(channel.get(key)) is not None
    }
    if not metrics:
        return None
    period, period_status = _period(channel)
    metrics.update({
        "source": channel.get("source") if isinstance(channel.get("source"), str) and channel.get("source").strip() else "NOT_AVAILABLE",
        "status": channel.get("status") if isinstance(channel.get("status"), str) else "NOT_AVAILABLE",
        "period": period,
        "periodStatus": period_status,
    })
    if "revenue" in metrics:
        metric = channel.get("revenueMetric")
        metrics["revenueMetric"] = metric if isinstance(metric, str) and metric.strip() else "NOT_AVAILABLE"
    return metrics


def _metrics(page):
    observed = {}
    for name in ("google", "naver"):
        channel = page.get(name) or {}
        if _verified(channel):
            metrics = _channel_metrics(channel, ("impressions", "clicks", "ctr", "position"))
            if metrics:
                observed[name] = metrics
    ga4 = page.get("ga4") or {}
    if _verified(ga4):
        metrics = _channel_metrics(ga4, ("views", "users", "revenue"))
        if metrics:
            observed["ga4"] = metrics
    return observed


def _period_alignment(observed):
    if not observed or any(channel.get("periodStatus") != "AVAILABLE" for channel in observed.values()):
        return "UNKNOWN"
    periods = {
        (channel["period"]["start"], channel["period"]["end"])
        for channel in observed.values()
    }
    if len(periods) == 1:
        return "SINGLE_SOURCE" if len(observed) == 1 else "MATCH"
    return "MISMATCH"


def select_improvement_candidates(payload, thresholds=None):
    limits = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    pages = payload.get("pages") or []
    winner_clusters = {row.get("cluster") for row in pages if row.get("classification") == "WINNER" and row.get("cluster")}
    candidates = []
    for page in pages:
        if page.get("classification") == "WINNER" or page.get("cooldown"):
            continue
        observed = _metrics(page)
        if not observed:
            continue
        reasons = []
        google = page.get("google") or {}
        naver = page.get("naver") or {}
        ga4 = page.get("ga4") or {}
        for name, channel in (("google", google), ("naver", naver)):
            impressions, ctr = number(channel.get("impressions")), number(channel.get("ctr"))
            if _verified(channel) and impressions is not None and impressions >= limits["min_search_impressions"] and ctr is not None and ctr < limits["max_low_ctr"]:
                reasons.append(name.upper() + "_HIGH_IMPRESSIONS_LOW_CTR")
        position = number(google.get("position"))
        if _verified(google) and position is not None and limits["google_position_min"] <= position <= limits["google_position_max"]:
            reasons.append("GOOGLE_POSITION_5_TO_30")
        measured_activity = any(number(values.get(key)) not in (None, 0) for values in observed.values() for key in ("impressions", "views", "revenue"))
        if page.get("cluster") in winner_clusters and measured_activity:
            reasons.append("WINNER_CLUSTER_PEER")
        views, page_score = number(ga4.get("views")), number(page.get("pageScore"))
        if _verified(ga4) and views is not None and views >= limits["min_ga4_views"] and page_score is not None and page_score < limits["max_page_score"]:
            reasons.append("TRAFFIC_WITH_STRUCTURE_GAP")
        if reasons:
            candidates.append({
                "url": page.get("url"),
                "cluster": page.get("cluster"),
                "reasons": sorted(set(reasons)),
                "observedMetrics": observed,
                "pageScore": page_score,
                "evidenceStatus": "HEURISTIC_REVIEW_ONLY",
                "requiresReproducibleIssue": True,
                "periodAlignment": _period_alignment(observed),
            })
    candidates.sort(key=lambda row: (-len(row["reasons"]), row["url"] or ""))
    return {"schemaVersion": 1, "asOf": payload.get("asOf"), "candidateCount": len(candidates), "candidates": candidates}

