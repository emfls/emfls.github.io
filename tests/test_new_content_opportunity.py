from scripts.new_content_opportunity import (
    build_experiment,
    classify_overlap,
    evaluate_launch_cohort,
    evaluate_pattern,
    score_new_content,
    select_new_pages,
    validate_demand_evidence,
)


def evidence(**overrides):
    row = {
        "source": "NAVER_QUERY_EXPORT",
        "query": "논산 무료 차박 화장실",
        "period": {"start": "2026-08-25", "end": "2026-08-31"},
        "metrics": {"impressions": 420, "clicks": 12},
        "collectedAt": "2026-09-01T03:40:00+09:00",
        "evidenceRef": "data/research/naver-query-2026-09-01.json",
        "status": "VERIFIED",
    }
    row.update(overrides)
    return row


def candidate(index, score, overlap="NO_OVERLAP", demand="VERIFIED"):
    return {
        "candidateId": f"C-{index}", "url": f"/new-{index}.html", "score": score,
        "demand": {"status": demand}, "overlap": {"level": overlap}, "decision": "NEW_PAGE",
    }


def test_evidence_requires_direct_query_period_metric_and_reference():
    assert validate_demand_evidence(evidence(), "2026-09-01")["status"] == "VERIFIED"
    assert validate_demand_evidence(evidence(evidenceRef=None), "2026-09-01")["status"] == "INSUFFICIENT_DATA"
    assert validate_demand_evidence(evidence(source="RELATED_WINNER_URL_PERFORMANCE"), "2026-09-01")["status"] == "ESTIMATED"


def test_stale_direct_evidence_is_not_verified():
    old = evidence(period={"start": "2026-08-01", "end": "2026-08-20"})
    assert validate_demand_evidence(old, "2026-09-01")["status"] == "STALE_DATA"


def test_same_goal_blocks_new_page_and_score_is_explainable():
    overlap = classify_overlap(
        {"targetIntent": "논산 무료 차박 장소와 화장실 확인"},
        {"url": "/kor/report/camp/nonsan.html", "targetIntent": "논산 무료 차박 장소와 화장실 확인"},
    )
    assert (overlap["level"], overlap["decision"]) == ("SAME_INTENT", "IMPROVE_EXISTING")
    result = score_new_content({
        "demand": {"status": "VERIFIED", "strength": .8}, "winnerRelevance": .8,
        "overlap": {"level": "NO_OVERLAP"}, "monetizationPotential": .6,
        "clusterExpandability": .7, "differentiation": .9, "benefitVsCost": .8,
    })
    assert sum(row["max"] for row in result["components"]) == 100
    assert all(row["reason"] for row in result["components"])
    assert "adsenseCtr" not in str(result)


def test_selection_never_exceeds_three_pages_per_local_day():
    rows = [candidate(1, 98), candidate(2, 94), candidate(3, 90), candidate(4, 86), candidate(5, 84)]
    assert [r["candidateId"] for r in select_new_pages(rows, 0, [])] == ["C-1", "C-2", "C-3"]
    assert len(select_new_pages(rows, 0, [{"publishedAt": "x"}] * 2)) == 1
    assert select_new_pages(rows, 0, [{"publishedAt": "x"}] * 3) == []
    assert select_new_pages(rows, 20, []) == []


def test_experiment_and_mature_pattern_rules():
    experiment = build_experiment(candidate(1, 90), "2026-09-01T04:00:00+09:00", 1)
    assert experiment["observeUntil"] == "2026-09-29"
    assert experiment["before"]["naver"]["impressions"] is None
    rows = [{"type": "CONTENT_LAUNCH_EXPERIMENT", "pattern": "camp-free", "publishedOn": "2026-07-01", "result": "WINNER"} for _ in range(10)]
    assert evaluate_launch_cohort(rows, "2026-09-01") == {"mature": 10, "winners": 10, "winRate": 1.0}
    assert evaluate_pattern(rows, "camp-free", "2026-09-01") == "SCALE_PATTERN"
    assert evaluate_pattern(rows[:9], "camp-free", "2026-09-01") == "OBSERVE_PATTERN"
