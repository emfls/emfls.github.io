#!/usr/bin/env python3
"""Pure validation and scoring rules for external-web content candidates."""

from copy import deepcopy


DEMAND_STATUSES = {
    "VERIFIED_SEARCH_DATA",
    "OBSERVED_SEARCH_SIGNAL",
    "ESTIMATED",
    "INSUFFICIENT_DATA",
}
OVERLAP_LEVELS = {
    "NO_OVERLAP",
    "LOW_OVERLAP",
    "MEDIUM_OVERLAP",
    "HIGH_OVERLAP",
    "SAME_INTENT",
}
OPPORTUNITY_WEIGHTS = {
    "demandSignal": 20,
    "problemStrength": 10,
    "nonOverlap": 20,
    "differentiation": 15,
    "monetization": 15,
    "sourceReliability": 10,
    "evergreen": 5,
    "benefitVsCost": 5,
}
QUALITY_WEIGHTS = {
    "accuracy": 15,
    "sourceCoverage": 15,
    "officialSources": 15,
    "originalStructure": 10,
    "structuredValue": 15,
    "notThin": 10,
    "intentCompletion": 15,
    "maintainability": 5,
}
REQUIRED_BRIEF_FIELDS = {
    "primaryIntent",
    "secondaryIntents",
    "keyFacts",
    "potentialTable",
    "potentialTool",
    "faqCandidates",
    "closestExistingPage",
    "internalLinkPlan",
    "whySeparatePage",
}


def _clamp(value):
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def _score(inputs, weights):
    components = []
    for name, maximum in weights.items():
        value = _clamp((inputs or {}).get(name))
        components.append(
            {
                "name": name,
                "input": value,
                "score": round(value * maximum, 2),
                "max": maximum,
                "reason": "Normalized explainable input for {}.".format(name),
            }
        )
    return {
        "score": round(sum(component["score"] for component in components), 2),
        "components": components,
    }


def normalize_external_candidate(candidate, as_of):
    row = deepcopy(candidate or {})
    discovery = dict(row.get("discovery") or {})
    if discovery.get("demandStatus") not in DEMAND_STATUSES:
        discovery["demandStatus"] = "INSUFFICIENT_DATA"
    if discovery.get("origin") != "EXTERNAL_WEB":
        discovery["demandStatus"] = "INSUFFICIENT_DATA"
    row["discovery"] = discovery
    row["asOf"] = str(as_of)[:10]
    overlap = dict(row.get("overlap") or {})
    if overlap.get("level") not in OVERLAP_LEVELS:
        overlap["level"] = "MEDIUM_OVERLAP"
    row["overlap"] = overlap
    return row


def score_external_opportunity(candidate):
    return _score((candidate or {}).get("opportunityInputs"), OPPORTUNITY_WEIGHTS)


def score_quality_feasibility(candidate):
    return _score((candidate or {}).get("qualityInputs"), QUALITY_WEIGHTS)


def _complete_brief(brief):
    if not isinstance(brief, dict) or not REQUIRED_BRIEF_FIELDS <= set(brief):
        return False
    for key in REQUIRED_BRIEF_FIELDS - {"closestExistingPage"}:
        if brief.get(key) in (None, "", []):
            if key == "internalLinkPlan" and brief.get(key) == []:
                continue
            return False
    return True


def _sources_ready(candidate):
    sources = candidate.get("officialSources") or []
    return bool(sources) and all(
        source.get("url") and source.get("reviewedAt") for source in sources
    )


def launch_readiness(candidate):
    row = normalize_external_candidate(candidate, (candidate or {}).get("asOf", ""))
    overlap = row["overlap"].get("level")
    if overlap == "SAME_INTENT":
        return {
            "status": "SAME_INTENT",
            "decision": "DO_NOT_CREATE",
            "reasons": ["Existing page satisfies the same user goal."],
        }

    opportunity = score_external_opportunity(row)
    quality = score_quality_feasibility(row)
    discovery = row.get("discovery") or {}
    reasons = []
    if discovery.get("origin") != "EXTERNAL_WEB":
        reasons.append("Discovery origin must be EXTERNAL_WEB.")
    if discovery.get("demandStatus") == "INSUFFICIENT_DATA":
        reasons.append("External demand evidence is insufficient.")
    if not discovery.get("evidenceRefs"):
        reasons.append("External evidence references are required.")
    if overlap not in {"NO_OVERLAP", "LOW_OVERLAP"}:
        reasons.append("Overlap must be NO_OVERLAP or LOW_OVERLAP.")
    if not row.get("contentGap"):
        reasons.append("A concrete content gap is required.")
    if not row.get("additionalValue"):
        reasons.append("Independent additional value is required.")
    if not _sources_ready(row):
        reasons.append("Reviewed official sources are required.")
    if not _complete_brief(row.get("brief")):
        reasons.append("A complete content brief is required.")
    if opportunity["score"] < 70:
        reasons.append("External opportunity score is below 70.")
    if quality["score"] < 75:
        reasons.append("Quality feasibility score is below 75.")
    if row.get("ymyl") and not (row.get("limitations") and row.get("disclaimer")):
        reasons.append("YMYL candidates require limitations and a disclaimer.")

    return {
        "status": "RESEARCHING" if reasons else "READY_TO_LAUNCH",
        "decision": "WAIT_FOR_EVIDENCE" if reasons else "LAUNCH_CANDIDATE",
        "opportunityScore": opportunity["score"],
        "qualityScore": quality["score"],
        "reasons": reasons,
    }
