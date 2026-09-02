import json

from scripts.prepare_external_launch import prepare_external_launch


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def ready_candidate(candidate_id, opportunity=90, quality=90):
    slug = candidate_id.casefold()
    return {
        "candidateId": candidate_id,
        "idea": f"준비된 외부 후보 {candidate_id}",
        "status": "READY_TO_LAUNCH",
        "locale": "ko-KR",
        "url": f"/kor/report/external/{slug}.html",
        "contentPath": f"kor/report/external/{slug}.html",
        "sitemapPath": "kor/report/external/sitemap.xml",
        "hubPath": "kor/report/external/index.html",
        "discovery": {
            "origin": "EXTERNAL_WEB",
            "source": "GOOGLE",
            "method": "RELATED_SEARCH",
            "observedTopic": f"외부 주제 {candidate_id}",
            "demandStatus": "OBSERVED_SEARCH_SIGNAL",
            "evidenceRefs": [f"https://example.com/{slug}"],
        },
        "intent": {"primary": f"독립 검색 의도 {candidate_id}", "secondary": ["확인 방법"]},
        "overlap": {"level": "NO_OVERLAP", "closestUrl": None},
        "contentGap": "공식 확인 절차와 표가 없다.",
        "additionalValue": ["CHECKLIST"],
        "officialSources": [
            {"url": f"https://official.example/{slug}", "reviewedAt": "2026-09-02"}
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
        "selectionInputs": {
            "expectedRevenueImpact": opportunity / 100,
            "demandConfidence": 0.7,
            "evergreenPotential": 0.9,
            "competitionCost": 0.5,
        },
        "brief": {
            "primaryIntent": f"독립 검색 의도 {candidate_id}",
            "secondaryIntents": ["확인 방법"],
            "keyFacts": ["공식 확인 절차"],
            "potentialTable": "조건별 확인표",
            "potentialTool": "체크 도구",
            "faqCandidates": ["어디서 확인하나요?"],
            "closestExistingPage": None,
            "internalLinkPlan": ["/kor/"],
            "whySeparatePage": "기존 페이지에 이 독립 intent가 없다.",
        },
    }


def prepare(root, candidates, experiments=None):
    write_json(
        root / "data/external-content-opportunities.json",
        {
            "schemaVersion": 1,
            "candidates": candidates,
            "readyToLaunch": [row["candidateId"] for row in candidates],
        },
    )
    write_json(
        root / "data/content-launch-experiments.json",
        {"experiments": experiments or []},
    )


def test_same_intent_and_incomplete_brief_never_enter_manifest(tmp_path):
    valid = ready_candidate("A")
    same = ready_candidate("B")
    same["overlap"]["level"] = "SAME_INTENT"
    incomplete = ready_candidate("C")
    incomplete["brief"]["whySeparatePage"] = ""
    prepare(tmp_path, [valid, same, incomplete])

    result = prepare_external_launch(tmp_path, "2026-09-02T14:00:00+09:00")

    assert result["candidateIds"] == ["A"]
    assert result["urls"] == [valid["url"]]


def test_manifest_respects_remaining_daily_slots(tmp_path):
    rows = [ready_candidate(str(i), opportunity=95 - i) for i in range(5)]
    prepare(
        tmp_path,
        rows,
        experiments=[
            {"publishedOn": "2026-09-02", "publishedAt": "2026-09-02T01:00:00+09:00"},
            {"publishedOn": "2026-09-02", "publishedAt": "2026-09-02T03:00:00+09:00"},
            {"publishedOn": "2026-09-01", "publishedAt": "2026-09-01T23:00:00+09:00"},
        ],
    )

    result = prepare_external_launch(tmp_path, "2026-09-02T14:00:00+09:00")

    assert len(result["candidateIds"]) == 1
    assert result["candidateIds"] == ["0"]


def test_no_ready_candidate_writes_no_publication_manifest(tmp_path):
    row = ready_candidate("A")
    row["officialSources"] = []
    prepare(tmp_path, [row])

    result = prepare_external_launch(tmp_path, "2026-09-02T14:00:00+09:00")

    assert result["status"] == "NO_PUBLICATION"
    assert result["candidateIds"] == []
    index = json.loads(
        (tmp_path / "data/google-index-candidates.json").read_text(encoding="utf-8")
    )
    assert index["candidates"] == []


def test_expected_value_ranking_is_deterministic(tmp_path):
    low = ready_candidate("LOW", opportunity=75, quality=90)
    high = ready_candidate("HIGH", opportunity=95, quality=90)
    prepare(tmp_path, [low, high])

    result = prepare_external_launch(tmp_path, "2026-09-02T14:00:00+09:00")

    assert result["candidateIds"] == ["HIGH", "LOW"]
