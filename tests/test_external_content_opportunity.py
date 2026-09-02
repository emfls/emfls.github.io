from scripts.external_content_opportunity import (
    launch_readiness,
    normalize_external_candidate,
    score_external_opportunity,
    score_quality_feasibility,
)


def complete_candidate():
    return {
        "candidateId": "EXT-20260902-001",
        "idea": "전기요금 누진세 계산기",
        "discovery": {
            "origin": "EXTERNAL_WEB",
            "source": "GOOGLE",
            "method": "AUTOCOMPLETE",
            "observedTopic": "전기요금 누진세 계산",
            "demandStatus": "OBSERVED_SEARCH_SIGNAL",
            "evidenceRefs": ["https://www.google.com/search?q=전기요금+누진세+계산"],
        },
        "intent": {
            "primary": "전기 사용량으로 예상 요금 계산",
            "secondary": ["누진 구간 확인"],
        },
        "overlap": {"level": "NO_OVERLAP", "closestUrl": None},
        "contentGap": "설명만 제공하고 직접 계산 기능이 없다.",
        "additionalValue": ["CALCULATOR", "OFFICIAL_SOURCE_VERIFICATION"],
        "officialSources": [
            {"url": "https://example.go.kr/rates", "reviewedAt": "2026-09-02"}
        ],
        "supportingSources": [],
        "opportunityInputs": {
            "demandSignal": 0.8,
            "problemStrength": 0.9,
            "nonOverlap": 1,
            "differentiation": 0.9,
            "monetization": 0.7,
            "sourceReliability": 0.9,
            "evergreen": 1,
            "benefitVsCost": 0.7,
        },
        "qualityInputs": {
            "accuracy": 1,
            "sourceCoverage": 0.9,
            "officialSources": 1,
            "originalStructure": 0.9,
            "structuredValue": 1,
            "notThin": 0.9,
            "intentCompletion": 0.9,
            "maintainability": 0.8,
        },
        "brief": {
            "primaryIntent": "전기 사용량으로 예상 요금 계산",
            "secondaryIntents": ["누진 구간 확인"],
            "keyFacts": ["요금 구간"],
            "potentialTable": "사용량별 요금 구간",
            "potentialTool": "전기요금 계산기",
            "faqCandidates": ["누진 구간은 언제 바뀌나요?"],
            "closestExistingPage": None,
            "internalLinkPlan": [],
            "whySeparatePage": "기존 페이지에 계산 intent가 없다.",
        },
    }


def test_observed_signal_is_not_converted_to_verified_volume():
    row = normalize_external_candidate(complete_candidate(), "2026-09-02")
    assert row["discovery"]["demandStatus"] == "OBSERVED_SEARCH_SIGNAL"
    assert "monthlySearchVolume" not in row["discovery"]
    assert row["asOf"] == "2026-09-02"


def test_unknown_demand_status_fails_closed():
    row = complete_candidate()
    row["discovery"]["demandStatus"] = "HIGH_VOLUME"
    normalized = normalize_external_candidate(row, "2026-09-02")
    assert normalized["discovery"]["demandStatus"] == "INSUFFICIENT_DATA"


def test_scores_are_explainable_and_sum_to_100_maximum():
    opportunity = score_external_opportunity(complete_candidate())
    quality = score_quality_feasibility(complete_candidate())
    assert sum(component["max"] for component in opportunity["components"]) == 100
    assert sum(component["max"] for component in quality["components"]) == 100
    assert all(
        component["reason"]
        for component in opportunity["components"] + quality["components"]
    )
    assert opportunity["score"] >= 70
    assert quality["score"] >= 75


def test_ready_requires_both_scores_low_overlap_sources_and_brief():
    row = complete_candidate()
    assert launch_readiness(row)["status"] == "READY_TO_LAUNCH"

    row["overlap"]["level"] = "SAME_INTENT"
    result = launch_readiness(row)
    assert result["status"] == "SAME_INTENT"
    assert result["decision"] == "DO_NOT_CREATE"


def test_ready_fails_closed_without_external_evidence_or_content_gap():
    row = complete_candidate()
    row["discovery"]["origin"] = "EMFLS_INTERNAL"
    assert launch_readiness(row)["status"] == "RESEARCHING"

    row = complete_candidate()
    row["contentGap"] = ""
    assert launch_readiness(row)["status"] == "RESEARCHING"


def test_ymyl_requires_review_metadata_limitations_and_disclaimer():
    row = complete_candidate()
    row["ymyl"] = True
    assert launch_readiness(row)["status"] == "RESEARCHING"

    row["limitations"] = ["실제 청구액은 계약 조건에 따라 다를 수 있다."]
    row["disclaimer"] = "공식 고지서를 최종 확인하세요."
    assert launch_readiness(row)["status"] == "READY_TO_LAUNCH"
