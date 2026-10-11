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

C01_032_CONTROLLED_EXPERIMENT = {
    "candidateId": "C01-20261011-032-IPHONEDATE",
    "url": "/kor/report/window/iphone-photos-date-taken.html",
    "contentPath": "kor/report/window/iphone-photos-date-taken.html",
    "idea": "아이폰 사진의 촬영일과 Windows 파일 생성일을 구분한다.",
    "experiment": {
        "taskId": "C01-20261011-032",
        "approval": "USER_APPROVED",
        "scope": "ONE_PAGE",
    },
    "discovery": {
        "origin": "CONTROL_TOWER_APPROVED_EXPERIMENT",
        "source": "USER_APPROVAL",
        "method": "ONE_PAGE_CANARY",
        "demandStatus": "VOLUME_UNKNOWN",
        "evidenceRefs": [],
    },
    "overlap": {"level": "LOW_OVERLAP", "closestUrl": None},
    "contentGap": "촬영일(Date taken)과 파일 시스템의 생성일·수정일을 구분하는 진단 가이드가 부족하다.",
    "additionalValue": ["WINDOWS_DATE_FIELDS", "USB_AND_ICLOUD_BRANCHES", "SAFE_SAMPLE_CHECK"],
    "officialSources": [
        {"url": "https://support.apple.com/ko-kr/120267", "reviewedAt": "2026-10-11"},
        {"url": "https://support.apple.com/ko-kr/116944", "reviewedAt": "2026-10-11"},
        {"url": "https://support.microsoft.com/en-us/windows/apps/photos/import-photos-and-videos-from-phone-to-pc", "reviewedAt": "2026-10-11"},
        {"url": "https://learn.microsoft.com/en-us/windows/win32/properties/props-system-photo-datetaken", "reviewedAt": "2026-10-11"},
        {"url": "https://cipa.jp/std/documents/e/DC-X010-2017.pdf", "reviewedAt": "2026-10-11"},
    ],
    "qualityInputs": {
        "accuracy": 0.9,
        "sourceCoverage": 0.9,
        "officialSources": 1,
        "originalStructure": 0.8,
        "structuredValue": 0.8,
        "notThin": 0.9,
        "intentCompletion": 0.9,
        "maintainability": 0.9,
    },
    "brief": {
        "primaryIntent": "Windows에서 아이폰 사진의 촬영일을 확인하고 전송 문제를 진단한다.",
        "secondaryIntents": ["USB 가져오기", "iCloud 원본 다운로드", "HEIC 호환성"],
        "keyFacts": [
            "Date taken은 사진 메타데이터의 촬영 시각을 읽고 Date created/modified는 파일 시스템 시각이다.",
            "한 번에 대량 이동·수정하지 말고 원본을 보존한 작은 표본으로 먼저 확인한다.",
            "앱과 파일 형식에 따라 메타데이터 표시와 지원이 다를 수 있다.",
        ],
        "potentialTable": "Windows 속성의 Date taken, Date created, Date modified 비교표",
        "potentialTool": "없음",
        "faqCandidates": ["Date taken이 비어 있으면 어떻게 하나요?", "iCloud 사진은 어떻게 원본을 가져오나요?"],
        "closestExistingPage": "아이폰 HEIC 사진 Windows 가져오기 후보와 인접하지만, 촬영일과 파일 날짜 진단으로 범위를 제한한다.",
        "internalLinkPlan": ["/kor/report/window/index.html"],
        "whySeparatePage": "파일 형식 호환성 설명이 아니라 촬영일과 파일 날짜를 구분해 원본 삭제 전에 진단하는 독립 intent다.",
    },
}



def _is_c01_controlled_volume_unknown_candidate(candidate):
    if not isinstance(candidate, dict):
        return False
    expected = C01_032_CONTROLLED_EXPERIMENT
    discovery = candidate.get("discovery") or {}
    if not isinstance(discovery, dict):
        return False
    experiment = candidate.get("experiment")
    if experiment != expected["experiment"]:
        return False
    if any(
        candidate.get(field) != expected[field]
        for field in ("candidateId", "url", "contentPath")
    ):
        return False
    if any(
        discovery.get(field) != expected["discovery"].get(field)
        for field in ("origin", "source", "method", "demandStatus", "evidenceRefs")
    ):
        return False
    volume_fields = {
        "monthlysearchvolume", "searchvolume", "searchvolumemonthly",
        "monthlyvolume", "volume",
    }

    def contains_numeric_volume_field(value):
        if isinstance(value, dict):
            for key, nested in value.items():
                field = "".join(character for character in str(key).casefold() if character.isalnum())
                if field in volume_fields or contains_numeric_volume_field(nested):
                    return True
        elif isinstance(value, list):
            return any(contains_numeric_volume_field(nested) for nested in value)
        return False

    if contains_numeric_volume_field(candidate):
        return False
    return True


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
    controlled_unknown = _is_c01_controlled_volume_unknown_candidate(row)
    discovery = dict(row.get("discovery") or {})
    if discovery.get("demandStatus") == "VOLUME_UNKNOWN":
        if not controlled_unknown:
            discovery["demandStatus"] = "INSUFFICIENT_DATA"
    elif discovery.get("demandStatus") not in DEMAND_STATUSES:
        discovery["demandStatus"] = "INSUFFICIENT_DATA"
    if discovery.get("origin") != "EXTERNAL_WEB" and not controlled_unknown:
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
    candidate = candidate if isinstance(candidate, dict) else {}
    controlled_unknown = _is_c01_controlled_volume_unknown_candidate(candidate)
    row = normalize_external_candidate(candidate, candidate.get("asOf", ""))
    overlap = row["overlap"].get("level")
    if overlap == "SAME_INTENT":
        return {
            "status": "SAME_INTENT",
            "decision": "DO_NOT_CREATE",
            "reasons": ["Existing page satisfies the same user goal."],
        }

    if controlled_unknown:
        quality = score_quality_feasibility(row)
        reasons = []
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
        if quality["score"] < 75:
            reasons.append("Quality feasibility score is below 75.")
        if row.get("ymyl") and not (row.get("limitations") and row.get("disclaimer")):
            reasons.append("YMYL candidates require limitations and a disclaimer.")
        return {
            "status": "RESEARCHING" if reasons else "READY_TO_LAUNCH",
            "decision": "WAIT_FOR_EVIDENCE" if reasons else "CONTROLLED_EXPERIMENT",
            "demandStatus": "VOLUME_UNKNOWN",
            "opportunityScore": None,
            "qualityScore": quality["score"],
            "reasons": reasons,
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
