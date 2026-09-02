import json

from scripts.external_discovery_pipeline import run_external_pipeline


def candidate(
    candidate_id,
    *,
    status="DISCOVERED",
    refs=None,
    opportunity=82,
    quality=86,
    source="GOOGLE",
    primary=None,
):
    primary = primary or f"독립 검색 의도 {candidate_id}"
    return {
        "candidateId": candidate_id,
        "idea": f"외부 아이디어 {candidate_id}",
        "locale": "ko-KR",
        "status": status,
        "discovery": {
            "origin": "EXTERNAL_WEB",
            "source": source,
            "method": "RELATED_SEARCH",
            "observedTopic": primary,
            "demandStatus": "OBSERVED_SEARCH_SIGNAL",
            "evidenceRefs": refs or [f"https://example.com/{candidate_id}"],
        },
        "intent": {"primary": primary, "secondary": [f"{primary} 방법"]},
        "overlap": {"level": "NO_OVERLAP", "closestUrl": None},
        "contentGap": "기존 결과에는 단계별 확인표가 없다.",
        "additionalValue": ["CHECKLIST"],
        "officialSources": [
            {"url": f"https://official.example/{candidate_id}", "reviewedAt": "2026-09-02"}
        ],
        "supportingSources": [],
        "opportunityInputs": {
            "demandSignal": opportunity / 100,
            "problemStrength": opportunity / 100,
            "nonOverlap": 1,
            "differentiation": opportunity / 100,
            "monetization": opportunity / 100,
            "sourceReliability": opportunity / 100,
            "evergreen": opportunity / 100,
            "benefitVsCost": opportunity / 100,
        },
        "qualityInputs": {
            "accuracy": quality / 100,
            "sourceCoverage": quality / 100,
            "officialSources": 1,
            "originalStructure": quality / 100,
            "structuredValue": quality / 100,
            "notThin": quality / 100,
            "intentCompletion": quality / 100,
            "maintainability": quality / 100,
        },
        "brief": {
            "primaryIntent": primary,
            "secondaryIntents": [f"{primary} 방법"],
            "keyFacts": ["공식 확인 절차"],
            "potentialTable": "조건별 확인표",
            "potentialTool": "체크 도구",
            "faqCandidates": [f"{primary} 가능한가요?"],
            "closestExistingPage": None,
            "internalLinkPlan": ["/kor/"],
            "whySeparatePage": "기존 사이트에 이 독립 intent가 없다.",
        },
    }


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def prepare(root, *, existing=None, incoming=None):
    write_json(
        root / "data/external-content-opportunities.json",
        {"schemaVersion": 1, "candidates": existing or []},
    )
    write_json(root / "input.json", {"candidates": incoming or []})


def test_repeated_rejected_candidate_is_not_researched_without_new_evidence(tmp_path):
    existing = candidate("EXT-1", status="REJECTED", refs=["ref-a"])
    incoming = candidate("EXT-NEW", status="DISCOVERED", refs=["ref-a"], primary=existing["intent"]["primary"])
    prepare(tmp_path, existing=[existing], incoming=[incoming] + [candidate(f"EXT-{i}") for i in range(2, 11)])

    result = run_external_pipeline(
        tmp_path, "2026-09-02T12:00:00+09:00", tmp_path / "input.json"
    )

    assert result["summary"]["reusedWithoutResearch"] == 1
    preserved = next(row for row in result["candidates"] if row["candidateId"] == "EXT-1")
    assert preserved["status"] == "REJECTED"
    assert preserved["firstDiscoveredAt"] == preserved["lastDiscoveredAt"]


def test_terminal_candidate_reopens_only_with_new_evidence(tmp_path):
    existing = candidate("EXT-1", status="SAME_INTENT", refs=["ref-a"])
    incoming = candidate("EXT-NEW", refs=["ref-a", "ref-b"], primary=existing["intent"]["primary"])
    prepare(tmp_path, existing=[existing], incoming=[incoming] + [candidate(f"EXT-{i}") for i in range(2, 11)])

    result = run_external_pipeline(
        tmp_path, "2026-09-02T12:00:00+09:00", tmp_path / "input.json"
    )

    reopened = next(row for row in result["candidates"] if row["candidateId"] == "EXT-1")
    assert reopened["status"] != "SAME_INTENT"
    assert reopened["discovery"]["evidenceRefs"] == ["ref-a", "ref-b"]


def test_run_requires_ten_to_thirty_external_candidates(tmp_path):
    prepare(tmp_path, incoming=[candidate(f"EXT-{i}") for i in range(9)])
    result = run_external_pipeline(
        tmp_path, "2026-09-02T12:00:00+09:00", tmp_path / "input.json"
    )
    assert result["dataStatus"] == "INSUFFICIENT_DATA"
    assert result["readyToLaunch"] == []


def test_top_ten_are_sorted_and_report_has_required_counts(tmp_path):
    rows = [
        candidate(
            f"EXT-{i:02d}",
            opportunity=70 + i,
            quality=80,
            source="GOOGLE" if i < 5 else "NAVER" if i < 8 else "OTHER_WEBSITE",
        )
        for i in range(10)
    ]
    prepare(tmp_path, incoming=rows)

    result = run_external_pipeline(
        tmp_path, "2026-09-02T12:00:00+09:00", tmp_path / "input.json"
    )

    assert [row["candidateId"] for row in result["top10"]] == [
        f"EXT-{i:02d}" for i in reversed(range(10))
    ]
    assert result["summary"]["google"] == 5
    assert result["summary"]["naver"] == 3
    assert result["summary"]["otherWebsites"] == 2
    report = (tmp_path / "reports/external-discovery-pipeline.md").read_text(
        encoding="utf-8"
    )
    for heading in (
        "EXTERNAL DISCOVERY PIPELINE",
        "TOP 10 EXTERNAL OPPORTUNITIES",
        "DUPLICATE REMOVAL RESULTS",
        "Pages launched today",
    ):
        assert heading in report


def test_same_input_and_run_time_are_byte_deterministic(tmp_path):
    prepare(tmp_path, incoming=[candidate(f"EXT-{i}") for i in range(10)])
    run_external_pipeline(
        tmp_path, "2026-09-02T12:00:00+09:00", tmp_path / "input.json"
    )
    first = (tmp_path / "data/external-content-opportunities.json").read_bytes()
    run_external_pipeline(
        tmp_path, "2026-09-02T12:00:00+09:00", tmp_path / "input.json"
    )
    assert first == (tmp_path / "data/external-content-opportunities.json").read_bytes()
