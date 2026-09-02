import json
from pathlib import Path

from scripts.daily_revenue_growth import run_daily_analysis


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def prepare(root, candidates):
    write_json(root / "research.json", {"asOf": "2026-09-01", "candidates": candidates})
    write_json(root / "data/page-performance.json", {"pages": []})
    write_json(root / "data/revenue-opportunities.json", {"protectedWinners": []})
    write_json(root / "data/experiments.json", {"experiments": []})
    write_json(root / "data/content-launch-experiments.json", {"experiments": []})


def raw_candidate(index, source="NAVER_QUERY_EXPORT", score_inputs=1.0):
    return {
        "candidateId": f"C-{index}", "url": f"/kor/report/camp/new-{index}.html",
        "targetIntent": f"서로 다른 차박 목적 {index}", "pattern": "camp-distinct",
        "demandEvidence": [{"source": source, "query": f"차박 질문 {index}",
            "period": {"start": "2026-08-25", "end": "2026-08-31"},
            "metrics": {"impressions": 500}, "evidenceRef": f"data/research/q-{index}.json"}],
        "closest": None, "semanticSimilarity": 0.1, "goalRelation": "DISTINCT",
        "demandStrength": score_inputs, "winnerRelevance": score_inputs,
        "monetizationPotential": score_inputs, "clusterExpandability": score_inputs,
        "differentiation": score_inputs, "benefitVsCost": score_inputs,
        "contentPath": f"kor/report/camp/new-{index}.html",
        "sitemapPath": "kor/report/camp/sitemap.xml", "hubPath": "kor/report/camp/index.html",
    }


def test_indirect_demand_is_wait_for_data_and_zero_publication(tmp_path):
    prepare(tmp_path, [raw_candidate(1, source="RELATED_WINNER_URL_PERFORMANCE")])
    summary = run_daily_analysis(tmp_path, "2026-09-01T14:00:00+09:00", tmp_path / "research.json")
    assert summary["selected"] == []
    assert summary["candidates"][0]["decision"] == "WAIT_FOR_DATA"
    manifest = json.loads((tmp_path / "data/content-launch-manifest.json").read_text())
    assert manifest["status"] == "NO_PUBLICATION"
    assert manifest["urls"] == []


def test_valid_candidates_are_deterministic_and_ctr_experiments_do_not_consume_capacity(tmp_path):
    prepare(tmp_path, [raw_candidate(i) for i in range(1, 11)])
    write_json(tmp_path / "data/experiments.json", {"experiments": [{"status": "OBSERVING"}] * 3})
    first = run_daily_analysis(tmp_path, "2026-09-01T14:00:00+09:00", tmp_path / "research.json")
    first_bytes = (tmp_path / "data/new-content-opportunities.json").read_bytes()
    second = run_daily_analysis(tmp_path, "2026-09-01T14:00:00+09:00", tmp_path / "research.json")
    assert first == second
    assert first_bytes == (tmp_path / "data/new-content-opportunities.json").read_bytes()
    assert len(first["selected"]) == 3
    assert first["kpis"]["activeContentExperiments"] == 0


def test_publications_on_the_same_local_day_reduce_capacity(tmp_path):
    prepare(tmp_path, [raw_candidate(i) for i in range(1, 11)])
    write_json(
        tmp_path / "data/content-launch-experiments.json",
        {"experiments": [
            {"status": "OBSERVING", "publishedAt": "2026-09-01T01:00:00+09:00", "publishedOn": "2026-09-01"},
            {"status": "OBSERVING", "publishedAt": "2026-09-01T13:00:00+09:00", "publishedOn": "2026-09-01"},
            {"status": "OBSERVING", "publishedAt": "2026-08-31T23:00:00+09:00", "publishedOn": "2026-08-31"},
        ]},
    )
    result = run_daily_analysis(
        tmp_path, "2026-09-01T14:00:00+09:00", tmp_path / "research.json"
    )
    assert len(result["selected"]) == 1


def test_fewer_than_ten_researched_candidates_cannot_publish(tmp_path):
    prepare(tmp_path, [raw_candidate(i) for i in range(1, 4)])
    result = run_daily_analysis(tmp_path, "2026-09-01T14:00:00+09:00", tmp_path / "research.json")
    assert result["selected"] == []
    assert result["dataStatus"] == "INSUFFICIENT_DATA"


def test_verified_same_intent_candidates_report_improve_existing_reason(tmp_path):
    rows = [raw_candidate(i) for i in range(1, 11)]
    for row in rows:
        row["goalRelation"] = "SAME_GOAL"
        row["closest"] = {"url": row["url"], "targetIntent": row["targetIntent"]}
    prepare(tmp_path, rows)
    run_daily_analysis(tmp_path, "2026-09-01T15:20:00+09:00", tmp_path / "research.json")
    report = (tmp_path / "reports/daily-revenue-growth.md").read_text(encoding="utf-8")
    assert "Direct query evidence is verified, but every researched intent maps to an existing page." in report
    assert "No eligible direct query evidence" not in report
