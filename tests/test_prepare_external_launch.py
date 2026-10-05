import json

from scripts.prepare_external_launch import prepare_external_launch
from scripts.prepare_keyword_launch import prepare_queue


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


def test_external_ready_queue_is_limited_to_remaining_three_per_day(tmp_path):
    rows = [ready_candidate(str(i), opportunity=95 - i) for i in range(5)]
    prepare(
        tmp_path,
        rows,
        experiments=[
            {"candidateId": "OLD-1", "publishedOn": "2026-09-02", "publishedAt": "2026-09-02T01:00:00+09:00"},
            {"candidateId": "OLD-2", "publishedOn": "2026-09-02", "publishedAt": "2026-09-02T03:00:00+09:00"},
            {"candidateId": "YESTERDAY", "publishedOn": "2026-09-01", "publishedAt": "2026-09-01T23:00:00+09:00"},
        ],
    )

    result = prepare_external_launch(tmp_path, "2026-09-02T14:00:00+09:00", write=False)

    assert len(result["candidateIds"]) == 1
    assert result["candidateIds"] == ["0"]
    assert result["dailyLimit"] == 3
    assert result["publishedToday"] == 2
    assert result["remainingCapacity"] == 1


def test_external_queue_counts_same_day_manifest_over_stale_counter(tmp_path):
    rows = [ready_candidate(str(i), opportunity=95 - i) for i in range(5)]
    prepare(tmp_path, rows)
    write_json(
        tmp_path / "data/content-launch-counter.json",
        {"date": "2026-09-01", "launchedCount": 1, "dailyLimit": 1},
    )
    write_json(
        tmp_path / "data/content-launch-manifest.json",
        {
            "status": "PUBLISHED",
            "runAt": "2026-09-02T06:48:56+09:00",
            "candidateIds": ["keyword:키보드청소방법"],
            "urls": ["/kor/report/it/keyboard-cleaning-guide.html"],
            "publishedToday": 1,
            "dailyLimit": 1,
        },
    )

    result = prepare_external_launch(tmp_path, "2026-09-02T12:00:00+09:00", write=False)

    assert result["dailyLimit"] == 3
    assert result["publishedToday"] == 1
    assert result["remainingCapacity"] == 2
    assert len(result["candidateIds"]) == 2


def test_daily_counter_reset_preserves_history_and_limits_to_remaining_capacity(tmp_path):
    rows = [ready_candidate(str(i), opportunity=95 - i) for i in range(4)]
    prepare(
        tmp_path,
        rows,
        experiments=[
            {
                "candidateId": "OLD",
                "publishedOn": "2026-09-02",
                "publishedAt": "2026-09-02T09:00:00+09:00",
            },
            {
                "candidateId": "NEW",
                "publishedOn": "2026-09-02",
                "publishedAt": "2026-09-02T15:00:00+09:00",
            },
        ],
    )
    write_json(
        tmp_path / "data/content-launch-counter.json",
        {"resetAt": "2026-09-02T12:00:00+09:00", "reason": "MANUAL_RESET"},
    )

    result = prepare_external_launch(tmp_path, "2026-09-02T16:00:00+09:00")

    assert result["publishedToday"] == 2
    assert result["dailyLimit"] == 3
    assert result["remainingCapacity"] == 1
    assert len(result["candidateIds"]) == 1


def test_reset_does_not_restore_capacity_when_three_publications_exist_today(tmp_path):
    rows = [ready_candidate(str(i), opportunity=95 - i) for i in range(4)]
    prepare(
        tmp_path,
        rows,
        experiments=[
            {
                "candidateId": f"PUB-{i}",
                "publishedOn": "2026-09-02",
                "publishedAt": published_at,
            }
            for i, published_at in enumerate(
                (
                    "2026-09-02T09:00:00+09:00",
                    "2026-09-02T13:00:00+09:00",
                    "2026-09-02T14:00:00+09:00",
                )
            )
        ],
    )
    write_json(
        tmp_path / "data/content-launch-counter.json",
        {"resetAt": "2026-09-02T12:00:00+09:00", "reason": "MANUAL_RESET"},
    )

    result = prepare_external_launch(tmp_path, "2026-09-02T16:00:00+09:00", write=False)

    assert result["publishedToday"] == 3
    assert result["dailyLimit"] == 3
    assert result["remainingCapacity"] == 0
    assert result["candidateIds"] == []


def test_reset_does_not_hide_more_than_three_same_day_publications(tmp_path):
    rows = [ready_candidate(str(i), opportunity=95 - i) for i in range(4)]
    prepare(
        tmp_path,
        rows,
        experiments=[
            {
                "candidateId": f"PUB-{i}",
                "publishedOn": "2026-09-02",
                "publishedAt": published_at,
            }
            for i, published_at in enumerate(
                (
                    "2026-09-02T09:00:00+09:00",
                    "2026-09-02T10:00:00+09:00",
                    "2026-09-02T13:00:00+09:00",
                    "2026-09-02T14:00:00+09:00",
                )
            )
        ],
    )
    write_json(
        tmp_path / "data/content-launch-counter.json",
        {"resetAt": "2026-09-02T12:00:00+09:00", "reason": "MANUAL_RESET"},
    )

    result = prepare_external_launch(tmp_path, "2026-09-02T16:00:00+09:00", write=False)

    assert result["publishedToday"] == 4
    assert result["dailyLimit"] == 3
    assert result["remainingCapacity"] == 0
    assert result["candidateIds"] == []


def test_previous_kst_day_publications_do_not_consume_today_after_reset(tmp_path):
    rows = [ready_candidate(str(i), opportunity=95 - i) for i in range(4)]
    prepare(
        tmp_path,
        rows,
        experiments=[
            {
                "candidateId": f"YESTERDAY-{i}",
                "publishedOn": "2026-09-02",
                "publishedAt": f"2026-09-02T0{i + 9}:00:00+09:00",
            }
            for i in range(2)
        ],
    )
    write_json(
        tmp_path / "data/content-launch-counter.json",
        {"resetAt": "2026-09-03T00:15:00+09:00", "reason": "MANUAL_RESET"},
    )

    result = prepare_external_launch(tmp_path, "2026-09-03T00:30:00+09:00", write=False)

    assert result["publishedToday"] == 0
    assert result["dailyLimit"] == 3
    assert result["remainingCapacity"] == 3
    assert len(result["candidateIds"]) == 3


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


def test_candidate_already_registered_as_published_is_not_selected_again(tmp_path):
    published = ready_candidate("PUBLISHED")
    fresh = ready_candidate("FRESH", opportunity=80)
    prepare(
        tmp_path,
        [published, fresh],
        experiments=[
            {
                "candidateId": "PUBLISHED",
                "publishedOn": "2026-09-06",
                "status": "OBSERVING",
            }
        ],
    )

    result = prepare_external_launch(tmp_path, "2026-09-06T21:00:00+09:00")

    assert result["candidateIds"] == ["FRESH"]



def test_external_publication_day_uses_kst_for_utc_timestamps(tmp_path):
    rows = [ready_candidate(str(i), opportunity=95 - i) for i in range(5)]
    prepare(
        tmp_path,
        rows,
        experiments=[
            {
                "candidateId": "KST-TODAY-BEFORE-RESET",
                "publishedOn": "2026-09-03",
                "publishedAt": "2026-09-02T15:00:00+00:00",
            },
            {
                "candidateId": "KST-TODAY-AFTER-RESET",
                "publishedOn": "2026-09-03",
                "publishedAt": "2026-09-02T15:20:00+00:00",
            },
            {
                "candidateId": "PREVIOUS-KST-DAY",
                "publishedOn": "2026-09-02",
                "publishedAt": "2026-09-02T14:00:00+00:00",
            },
        ],
    )
    write_json(
        tmp_path / "data/content-launch-counter.json",
        {"resetAt": "2026-09-02T15:10:00+00:00", "reason": "MANUAL_RESET"},
    )

    result = prepare_external_launch(tmp_path, "2026-09-02T15:30:00+00:00", write=False)

    assert result["publishedToday"] == 2
    assert result["remainingCapacity"] == 1
    assert len(result["candidateIds"]) == 1



def test_external_queue_blocks_when_three_publications_are_already_counted(tmp_path):
    rows = [ready_candidate(str(i), opportunity=95 - i) for i in range(4)]
    prepare(
        tmp_path,
        rows,
        experiments=[
            {"candidateId": f"PUB-{i}", "publishedOn": "2026-09-02", "publishedAt": f"2026-09-02T0{i + 1}:00:00+09:00"}
            for i in range(3)
        ],
    )

    result = prepare_external_launch(tmp_path, "2026-09-02T14:00:00+09:00", write=False)

    assert result["candidateIds"] == []
    assert result["dailyLimit"] == 3
    assert result["publishedToday"] == 3
    assert result["remainingCapacity"] == 0


def test_external_ready_manifest_carries_same_day_publication_count(tmp_path):
    candidates = [ready_candidate(str(i), opportunity=95 - i) for i in range(4)]
    prepare(tmp_path, candidates)
    write_json(
        tmp_path / "data/content-launch-manifest.json",
        {
            "status": "PUBLISHED",
            "runAt": "2026-09-02T06:48:56+09:00",
            "candidateIds": ["keyword:키보드청소방법"],
            "urls": ["/kor/report/it/keyboard-cleaning-guide.html"],
            "publishedToday": 1,
            "dailyLimit": 1,
        },
    )

    result = prepare_external_launch(tmp_path, "2026-09-02T12:00:00+09:00")
    prepared_manifest = json.loads(
        (tmp_path / "data/content-launch-manifest.json").read_text(encoding="utf-8")
    )
    later_queue = prepare_queue(
        [
            {
                "keyword": f"안전한도구{index}",
                "status": "NEW",
                "score_valid": "True",
                "opportunity_score": str(90 - index),
                "action": "NEW_PAGE",
                "content_types": "calculator/tool",
                "suggested_url": f"/kor/util/tool-{index}/",
                "overlap": "NO_OVERLAP",
            }
            for index in range(4)
        ],
        daily_limit=3,
        selected_at="2026-09-02T15:00:00+09:00",
        published_manifest=prepared_manifest,
    )

    assert result["publishedToday"] == 1
    assert result["remainingCapacity"] == 2
    assert prepared_manifest["publicationAccountingDate"] == "2026-09-02"
    assert later_queue["publishedToday"] == 1
    assert later_queue["remainingCapacity"] == 2
    assert len(later_queue["queue"]) == 2
