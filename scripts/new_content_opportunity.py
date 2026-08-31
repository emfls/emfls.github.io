#!/usr/bin/env python3
"""Pure decision rules for evidence-backed new content launches."""

from datetime import date, datetime, timedelta


DIRECT_QUERY_SOURCES = {"NAVER_QUERY_EXPORT", "GSC_QUERY_EXPORT", "SEARCH_SERVICE_QUERY_METRIC"}
OVERLAP_DECISIONS = {
    "NO_OVERLAP": "NEW_PAGE", "LOW_OVERLAP": "NEW_PAGE",
    "MEDIUM_OVERLAP": "WAIT_FOR_DATA", "HIGH_OVERLAP": "REJECT",
    "SAME_INTENT": "IMPROVE_EXISTING",
}
WEIGHTS = {
    "searchDemand": 25, "winnerRelevance": 15, "intentNonOverlap": 20,
    "monetizationPotential": 15, "clusterExpandability": 10,
    "differentiation": 10, "benefitVsCost": 5,
}


def _clamp(value):
    return max(0.0, min(1.0, float(value or 0)))


def validate_demand_evidence(evidence, as_of, max_age_days=7):
    row = dict(evidence or {})
    period = row.get("period") or {}
    required = row.get("query") and period.get("end") and row.get("metrics") and row.get("evidenceRef")
    if not required:
        return {**row, "status": "INSUFFICIENT_DATA", "reason": "Missing query, period, metrics, or evidence reference."}
    if row.get("source") not in DIRECT_QUERY_SOURCES:
        return {**row, "status": "ESTIMATED", "reason": "Source is not direct query demand."}
    try:
        age = (date.fromisoformat(as_of[:10]) - date.fromisoformat(period["end"])).days
    except (TypeError, ValueError):
        return {**row, "status": "INSUFFICIENT_DATA", "reason": "Invalid evidence period."}
    status = "STALE_DATA" if age > max_age_days else "VERIFIED"
    return {**row, "status": status, "reason": "Direct query evidence validated."}


def classify_overlap(candidate, closest=None):
    closest = closest or {}
    goal = " ".join(str(candidate.get("targetIntent") or "").lower().split())
    other = " ".join(str(closest.get("targetIntent") or "").lower().split())
    relation = candidate.get("goalRelation")
    similarity = _clamp(candidate.get("semanticSimilarity"))
    if (goal and goal == other) or relation == "SAME_GOAL":
        level = "SAME_INTENT"
    elif similarity >= .85:
        level = "HIGH_OVERLAP"
    elif similarity >= .65:
        level = "MEDIUM_OVERLAP"
    elif similarity >= .35:
        level = "LOW_OVERLAP"
    else:
        level = "NO_OVERLAP"
    return {
        "level": level, "decision": OVERLAP_DECISIONS[level],
        "closestUrl": closest.get("url"), "semanticSimilarity": similarity,
        "reason": "Same user goal." if level == "SAME_INTENT" else "Fixed semantic similarity threshold.",
    }


def score_new_content(candidate):
    overlap_factor = {"NO_OVERLAP": 1, "LOW_OVERLAP": .65, "MEDIUM_OVERLAP": .25, "HIGH_OVERLAP": 0, "SAME_INTENT": 0}
    inputs = {
        "searchDemand": (candidate.get("demand") or {}).get("strength") if (candidate.get("demand") or {}).get("status") == "VERIFIED" else 0,
        "winnerRelevance": candidate.get("winnerRelevance"),
        "intentNonOverlap": overlap_factor.get((candidate.get("overlap") or {}).get("level"), 0),
        "monetizationPotential": candidate.get("monetizationPotential"),
        "clusterExpandability": candidate.get("clusterExpandability"),
        "differentiation": candidate.get("differentiation"),
        "benefitVsCost": candidate.get("benefitVsCost"),
    }
    components = [{
        "name": name, "score": round(_clamp(inputs[name]) * maximum, 2), "max": maximum,
        "status": "VERIFIED" if name == "searchDemand" and (candidate.get("demand") or {}).get("status") == "VERIFIED" else "ESTIMATED",
        "reason": "Direct query demand." if name == "searchDemand" else "Normalized explainable input.",
        "input": inputs[name],
    } for name, maximum in WEIGHTS.items()]
    return {"score": round(sum(row["score"] for row in components), 2), "components": components}


def select_new_pages(candidates, active_launches, published_last_24h, default_limit=3, hard_limit=5):
    if active_launches >= 20:
        return []
    eligible = [row for row in candidates if row.get("decision") == "NEW_PAGE" and (row.get("demand") or {}).get("status") == "VERIFIED" and float(row.get("score") or 0) >= 70 and (row.get("overlap") or {}).get("level") in {"NO_OVERLAP", "LOW_OVERLAP"}]
    eligible.sort(key=lambda row: (-float(row.get("score") or 0), row.get("url", "")))
    selected = eligible[:max(0, default_limit)]
    for row in eligible[len(selected):]:
        if len(selected) >= hard_limit:
            break
        if float(row.get("score") or 0) >= 85 and row["overlap"]["level"] == "NO_OVERLAP":
            selected.append(row)
    capacity = min(20 - active_launches, hard_limit - len(published_last_24h))
    return selected[:max(0, capacity)]


def build_experiment(candidate, published_at, sequence):
    started = datetime.fromisoformat(published_at)
    until = (started.date() + timedelta(days=28)).isoformat()
    return {
        "experimentId": "EXP-CONTENT-{}-{:02d}".format(started.strftime("%Y%m%d"), sequence),
        "type": "CONTENT_LAUNCH_EXPERIMENT", "url": candidate["url"],
        "candidateId": candidate.get("candidateId"), "pattern": candidate.get("pattern"),
        "status": "OBSERVING", "publishedAt": published_at, "publishedOn": started.date().isoformat(),
        "cooldownUntil": until, "observeUntil": until,
        "before": {"naver": {"impressions": None, "clicks": None, "ctr": None, "status": "NOT_AVAILABLE"}, "ga4": {"views": None, "revenue": None, "status": "NOT_AVAILABLE"}},
        "result": None,
    }


def _mature(experiments, as_of):
    current = date.fromisoformat(as_of[:10])
    return [row for row in experiments if row.get("type") == "CONTENT_LAUNCH_EXPERIMENT" and row.get("publishedOn") and (current - date.fromisoformat(row["publishedOn"])).days >= 28]


def evaluate_launch_cohort(experiments, as_of):
    mature = _mature(experiments, as_of)
    winners = sum(row.get("result") == "WINNER" for row in mature)
    return {"mature": len(mature), "winners": winners, "winRate": round(winners / len(mature), 4) if mature else None}


def evaluate_pattern(experiments, pattern, as_of):
    rows = [row for row in _mature(experiments, as_of) if row.get("pattern") == pattern]
    if len(rows) < 10:
        return "OBSERVE_PATTERN"
    winners = sum(row.get("result") == "WINNER" for row in rows)
    promising = sum(row.get("result") == "PROMISING" for row in rows)
    failed = sum(row.get("result") == "FAILED" for row in rows)
    if winners >= 4 or winners + promising >= 7:
        return "SCALE_PATTERN"
    if failed >= 8 and winners == 0:
        return "PAUSE_PATTERN"
    return "OBSERVE_PATTERN"
