#!/usr/bin/env python3
"""Score revenue opportunities without fabricating missing performance data."""

from datetime import date
from math import log1p


ALLOWED_STATUSES = {
    "VERIFIED",
    "ESTIMATED",
    "STALE_DATA",
    "NOT_CONNECTED",
    "INSUFFICIENT_DATA",
    "NOT_AVAILABLE",
    "ZERO_VERIFIED",
}


def freshness_status(channel, as_of, max_age_days=7):
    if not channel or channel.get("status") == "NOT_CONNECTED":
        return "NOT_CONNECTED"
    end = (channel.get("period") or {}).get("end")
    if not end:
        return "INSUFFICIENT_DATA"
    try:
        age = (date.fromisoformat(as_of) - date.fromisoformat(end)).days
    except (TypeError, ValueError):
        return "INSUFFICIENT_DATA"
    return "STALE_DATA" if age > max_age_days else channel.get("status", "INSUFFICIENT_DATA")


def empty_channel(fields, status="NOT_CONNECTED"):
    if status not in ALLOWED_STATUSES:
        raise ValueError(f"unsupported data status: {status}")
    return {
        **{field: None for field in fields},
        "status": status,
        "period": None,
        "source": None,
    }


def normalize_channel(channel, fields, as_of):
    if channel is None:
        return empty_channel(fields)
    result = {field: channel.get(field) for field in fields}
    result.update(
        {
            "status": freshness_status(channel, as_of),
            "period": channel.get("period"),
            "source": channel.get("source"),
        }
    )
    return result


def _verified(channel):
    return bool(channel and channel.get("status") == "VERIFIED")


def _component(name, score, maximum, status, reason, inputs):
    return {
        "name": name,
        "score": round(max(0.0, min(float(score), float(maximum))), 2),
        "max": maximum,
        "status": status,
        "reason": reason,
        "inputs": inputs,
    }


def _best_search_channel(record):
    channels = [
        ("naver", record.get("naver") or {}),
        ("google", record.get("google") or {}),
    ]
    verified = [(name, value) for name, value in channels if _verified(value)]
    if not verified:
        return None, {}
    return max(verified, key=lambda item: float(item[1].get("impressions") or 0))


def score_opportunity(record, cluster_medians):
    channel_name, search = _best_search_channel(record)
    search_status = "VERIFIED" if channel_name else "NOT_CONNECTED"
    impressions = search.get("impressions") if channel_name else None
    clicks = search.get("clicks") if channel_name else None
    ctr = search.get("ctr") if channel_name else None
    position = search.get("position") if channel_name else None
    max_impressions = cluster_medians.get(f"{channel_name}_max_impressions") or 100000
    max_clicks = cluster_medians.get(f"{channel_name}_max_clicks") or 10000
    impression_log = min(1.0, log1p(max(0, impressions or 0)) / log1p(max(1, max_impressions)))
    click_log = min(1.0, log1p(max(0, clicks or 0)) / log1p(max(1, max_clicks)))
    percentiles = (cluster_medians.get(f"{channel_name}_percentiles") or {}).get(record.get("url"), {})
    impression_percentile = percentiles.get("impressions", impression_log)
    click_percentile = percentiles.get("clicks", click_log)
    impression_score = 20 * (impression_log + impression_percentile) / 2
    click_score = 15 * (click_log + click_percentile) / 2
    if position is None:
        position_score = 0
    elif 10 <= position <= 30:
        position_score = 10
    elif position < 10:
        position_score = 6
    elif position <= 50:
        position_score = 5
    else:
        position_score = 1
    median_ctr = cluster_medians.get(f"{channel_name}_ctr") if channel_name else None
    median_impressions = cluster_medians.get(f"{channel_name}_impressions") if channel_name else None
    if ctr is None or median_ctr in (None, 0):
        ctr_score = 0
        ctr_status = "INSUFFICIENT_DATA" if channel_name else "NOT_CONNECTED"
    elif median_impressions is not None and (impressions or 0) < median_impressions:
        ctr_score = 0
        ctr_status = search_status
    else:
        ctr_score = 15 * max(0.0, min(1.0, (median_ctr - ctr) / median_ctr))
        ctr_status = search_status

    ga4 = record.get("ga4") or {}
    adsense = record.get("adsense") or {}
    ga4_revenue = ga4.get("revenue") if _verified(ga4) else None
    adsense_revenue = adsense.get("revenue") if _verified(adsense) else None
    revenue = adsense_revenue if adsense_revenue is not None else ga4_revenue
    revenue_status = "VERIFIED" if revenue is not None else "NOT_CONNECTED"
    revenue_score = 15 * log1p(max(0, revenue or 0)) / log1p(10)
    views = ga4.get("views") if _verified(ga4) else None
    efficiency = revenue * 1000 / views if revenue is not None and views else None
    efficiency_score = min(10, efficiency) if efficiency is not None else 0
    expansion_score = 10 if record.get("cluster") == "camping" and (impressions or 0) > 0 else 3
    ease_score = 5 if (impressions or 0) > 0 and ctr is not None else 2

    components = [
        _component("search_impressions", impression_score, 20, search_status, "Verified search demand volume using cluster percentile and log normalization." if channel_name else "No URL-level search data.", {"channel": channel_name, "impressions": impressions, "clusterPercentile": impression_percentile if channel_name else None, "logNormalized": impression_log if channel_name else None}),
        _component("search_clicks", click_score, 15, search_status, "Verified search clicks using cluster percentile and log normalization." if channel_name else "No URL-level search data.", {"channel": channel_name, "clicks": clicks, "clusterPercentile": click_percentile if channel_name else None, "logNormalized": click_log if channel_name else None}),
        _component("ranking_upside", position_score, 10, "NOT_AVAILABLE" if channel_name and position is None else search_status, "Average rank is unavailable; no ranking points are inferred." if channel_name and position is None else "Positions 10-30 receive the highest improvement weight.", {"channel": channel_name, "position": position}),
        _component("search_ctr_gap", ctr_score, 15, ctr_status, "CTR gap versus the same-channel cluster median.", {"channel": channel_name, "ctr": ctr, "clusterMedianCtr": median_ctr}),
        _component("actual_revenue", revenue_score, 15, revenue_status, "Verified URL revenue only.", {"revenue": revenue}),
        _component("page_efficiency", efficiency_score, 10, revenue_status if efficiency is not None else "INSUFFICIENT_DATA", "GA4 page revenue per 1,000 views; not AdSense RPM.", {"revenuePer1000Views": efficiency}),
        _component("intent_expandability", expansion_score, 10, "ESTIMATED", "Verified camping demand supports adjacent-intent analysis." if expansion_score == 10 else "No verified winner-cluster expansion signal.", {"cluster": record.get("cluster")}),
        _component("benefit_vs_cost", ease_score, 5, "ESTIMATED", "A focused search-snippet change is low cost." if ease_score == 5 else "Improvement scope needs manual review.", {"focusedChangePossible": ease_score == 5}),
    ]
    critical = [component["status"] for component in components[:6]]
    if "VERIFIED" not in critical:
        status = "INSUFFICIENT_DATA"
    elif "NOT_CONNECTED" in critical or "INSUFFICIENT_DATA" in critical:
        status = "ESTIMATED"
    else:
        status = "VERIFIED"
    return {
        "score": round(sum(component["score"] for component in components), 2),
        "status": status,
        "components": components,
    }


def cooldown_state(last_optimization_date, as_of, observe_until=None):
    until = date.fromisoformat(observe_until) if observe_until else None
    current = date.fromisoformat(as_of)
    if until and current <= until:
        return {"cooldown": True, "cooldownUntil": until.isoformat(), "cooldownReason": "ACTIVE_EXPERIMENT"}
    if not last_optimization_date:
        return {"cooldown": False, "cooldownUntil": None, "cooldownReason": None}
    optimized = date.fromisoformat(last_optimization_date)
    release = optimized.fromordinal(optimized.toordinal() + 14)
    return {
        "cooldown": current < release,
        "cooldownUntil": release.isoformat(),
        "cooldownReason": "RECENT_OPTIMIZATION" if current < release else None,
    }


def classify_record(record, score):
    ga4 = record.get("ga4") or {}
    search_name, search = _best_search_channel(record)
    has_verified_visits = _verified(ga4) and (ga4.get("views") or 0) > 0
    has_verified_search = bool(search_name and ((search.get("impressions") or 0) > 0 or (search.get("clicks") or 0) > 0))
    has_verified_revenue = _verified(ga4) and (ga4.get("revenue") or 0) > 0
    adsense = record.get("adsense") or {}
    has_verified_revenue = has_verified_revenue or (_verified(adsense) and (adsense.get("revenue") or 0) > 0)
    if has_verified_revenue and (has_verified_visits or has_verified_search):
        return "WINNER", "PROTECT", ["Verified URL revenue", "Verified traffic"]

    all_zero = (
        search_name
        and _verified(ga4)
        and (search.get("impressions") == 0)
        and (search.get("clicks") == 0)
        and (ga4.get("views") == 0)
        and (ga4.get("revenue") == 0)
    )
    if all_zero and record.get("duplicate") and record.get("inboundLinks") == 0:
        return "DEAD_CANDIDATE", "DEAD_CANDIDATE_REVIEW", ["Verified zero demand and revenue", "Duplicate with no inbound links"]

    ctr = search.get("ctr") if search_name else None
    if has_verified_search and ctr is not None and not record.get("cooldown"):
        return "OPPORTUNITY", "IMPROVE_SEARCH_CTR", ["Verified search demand", "Search CTR can be measured"]
    if has_verified_search:
        return "EXPERIMENT", "WAIT_FOR_DATA", ["Demand signal exists", "Monetization or cooldown blocks selection"]
    return None, "WAIT_FOR_DATA", ["Current URL-level evidence is insufficient"]


def select_improvements(records, limit=3):
    allowed_actions = {
        "IMPROVE_SEARCH_CTR",
        "IMPROVE_TOP_ANSWER",
        "ADD_INTERNAL_LINK",
        "UPDATE_STALE_INFO",
        "EXPAND_SEARCH_INTENT",
    }
    candidates = [
        record
        for record in records
        if record.get("classification") == "OPPORTUNITY"
        and record.get("dataStatus") == "VERIFIED"
        and not record.get("cooldown")
        and record.get("nextAction") in allowed_actions
    ]
    candidates.sort(key=lambda row: (-float(row.get("revenueOpportunityScore") or 0), row.get("url", "")))
    return candidates[: min(max(0, limit), 3)]
