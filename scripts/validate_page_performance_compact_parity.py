#!/usr/bin/env python3
"""Fail closed unless the compact page artifact preserves existing consumers."""

import argparse
import json
import sys
import tempfile
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from scripts.build_page_performance_manifest import verify_manifest
    from scripts.collect_gsc_opportunity_query_snapshot import current_opportunity_urls
    from scripts.compact_page_performance import project
    from scripts.keyword_hunter_improvements import select_improvement_candidates
    from scripts.revenue_growth import run_revenue_growth
    from scripts.validate_measurement_artifact import validate
except ModuleNotFoundError:
    from build_page_performance_manifest import verify_manifest
    from collect_gsc_opportunity_query_snapshot import current_opportunity_urls
    from compact_page_performance import project
    from keyword_hunter_improvements import select_improvement_candidates
    from revenue_growth import run_revenue_growth
    from validate_measurement_artifact import validate


def _read_json(path, label):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"could not read {label} JSON: {exc}") from exc


def validate_manifest_for_parity(
    manifest_path,
    full_path,
    ga4_snapshot_path,
    gsc_snapshot_path,
    adsense_snapshot_path,
    naver_snapshot_path,
    *,
    analysis_commit,
    workflow_run_id,
    workflow_run_attempt,
    repository_root=None,
    pull_request_head_sha=None,
    ga4_source_revision=None,
    adsense_source_revision=None,
):
    """Verify provenance against the exact current full artifact and snapshots."""
    manifest = _read_json(manifest_path, "page-performance manifest")
    return verify_manifest(
        manifest,
        full_path,
        ga4_snapshot_path,
        gsc_snapshot_path,
        adsense_snapshot_path,
        naver_snapshot_path,
        analysis_commit,
        workflow_run_id,
        workflow_run_attempt,
        repository_root=repository_root,
        pull_request_head_sha=pull_request_head_sha,
        ga4_source_revision=ga4_source_revision,
        adsense_source_revision=adsense_source_revision,
    )


def compare_page_projection(full_payload, compact_payload):
    """Require every established page/channel value and missingness state to match."""
    expected = project(full_payload)
    if compact_payload != expected:
        raise ValueError("compact page projection differs from expected full projection")
    return {"pageCount": len(expected["pages"]), "status": "PASS"}


def compare_basic_consumers(full_payload, compact_payload, revenue_opportunities):
    full_keyword = select_improvement_candidates(full_payload)
    compact_keyword = select_improvement_candidates(compact_payload)
    if full_keyword != compact_keyword:
        raise ValueError("Keyword Hunter consumer parity failed")

    full_urls = current_opportunity_urls(full_payload, revenue_opportunities)
    compact_urls = current_opportunity_urls(compact_payload, revenue_opportunities)
    if full_urls != compact_urls:
        raise ValueError("GSC opportunity URL consumer parity failed")
    return {
        "keywordHunterCandidates": full_keyword["candidateCount"],
        "gscOpportunityUrls": full_urls,
        "status": "PASS",
    }


def compare_revenue_results(full_result, compact_result):
    """Compare all pipeline outputs, with explicit checks for protected/action sets."""
    if full_result["pages"] != compact_result["pages"]:
        raise ValueError("revenue pipeline parity failed: page payload differs")
    if full_result["summary"] != compact_result["summary"]:
        raise ValueError("revenue pipeline parity failed: summary, protected winners, or selected/top rows differ")
    if full_result["report"] != compact_result["report"]:
        raise ValueError("revenue pipeline parity failed: report text differs")
    summary = full_result["summary"]
    return {
        "classificationCounts": summary.get("classificationCounts"),
        "protectedWinnerCount": len(summary.get("protectedWinners") or []),
        "selectedImprovementUrls": [row.get("url") for row in summary.get("selectedImprovements") or []],
        "topOpportunityUrls": [row.get("url") for row in summary.get("topOpportunities") or []],
        "reportStatus": "PASS",
        "status": "PASS",
    }


def _run_revenue(performance_path, common, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    pages, summary = run_revenue_growth(
        **common,
        performance_path=performance_path,
        page_output=output_dir / "page-performance.json",
        opportunity_output=output_dir / "revenue-opportunities.json",
        report_output=output_dir / "revenue-growth-report.md",
    )
    return {
        "pages": pages,
        "summary": summary,
        "report": (output_dir / "revenue-growth-report.md").read_text(encoding="utf-8"),
    }


def validate_parity(
    *,
    full_path,
    compact_path,
    manifest_path,
    page_scores_path,
    revenue_opportunities_path,
    audit_path,
    experiments_path,
    optimization_history_path,
    content_experiments_path,
    ga4_snapshot_path,
    gsc_snapshot_path,
    adsense_snapshot_path,
    naver_snapshot_path,
    analysis_commit,
    workflow_run_id,
    workflow_run_attempt,
    pull_request_head_sha=None,
    ga4_source_revision=None,
    adsense_source_revision=None,
):
    manifest_status = validate_manifest_for_parity(
        manifest_path,
        full_path,
        ga4_snapshot_path=ga4_snapshot_path,
        gsc_snapshot_path=gsc_snapshot_path,
        adsense_snapshot_path=adsense_snapshot_path,
        naver_snapshot_path=naver_snapshot_path,
        analysis_commit=analysis_commit,
        workflow_run_id=workflow_run_id,
        workflow_run_attempt=workflow_run_attempt,
        pull_request_head_sha=pull_request_head_sha,
        ga4_source_revision=ga4_source_revision,
        adsense_source_revision=adsense_source_revision,
    )

    full_payload = _read_json(full_path, "full page-performance artifact")
    compact_payload = _read_json(compact_path, "compact page-performance artifact")
    revenue_opportunities = _read_json(revenue_opportunities_path, "full-derived revenue opportunities")
    page_result = compare_page_projection(full_payload, compact_payload)
    consumer_result = compare_basic_consumers(full_payload, compact_payload, revenue_opportunities)
    full_validation = validate(Path(full_path), page_scores_path=Path(page_scores_path))
    compact_validation = validate(Path(compact_path), page_scores_path=Path(page_scores_path))
    if full_validation != compact_validation:
        raise ValueError("full and compact measurement validator results differ")

    common = {
        "page_scores_path": Path(page_scores_path),
        "audit_path": Path(audit_path),
        "experiments_path": Path(experiments_path),
        "optimization_history_path": Path(optimization_history_path),
        "content_experiments_path": Path(content_experiments_path),
        "gsc_snapshot_path": Path(gsc_snapshot_path),
        "adsense_snapshot_path": Path(adsense_snapshot_path),
        "as_of": full_payload["asOf"],
    }
    common["naver_snapshot_path"] = Path(naver_snapshot_path)
    with tempfile.TemporaryDirectory(prefix="page-performance-parity-") as temporary:
        output_root = Path(temporary)
        full_result = _run_revenue(Path(full_path), common, output_root / "full")
        compact_result = _run_revenue(Path(compact_path), common, output_root / "compact")
    revenue_result = compare_revenue_results(full_result, compact_result)
    return {
        "status": "PASS",
        "manifest": manifest_status,
        "projection": page_result,
        "measurementValidator": full_validation,
        "consumers": consumer_result,
        "revenuePipeline": revenue_result,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("full", "compact", "manifest", "page-scores", "revenue-opportunities", "audit", "experiments", "optimization-history", "content-experiments", "ga4-snapshot", "gsc-snapshot", "adsense-snapshot"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--analysis-commit", required=True)
    parser.add_argument("--workflow-run-id", required=True)
    parser.add_argument("--workflow-run-attempt", required=True)
    parser.add_argument("--naver-snapshot", type=Path, required=True)
    parser.add_argument("--pull-request-head-sha")
    parser.add_argument("--ga4-source-revision")
    parser.add_argument("--adsense-source-revision")
    args = parser.parse_args()
    result = validate_parity(
        full_path=args.full,
        compact_path=args.compact,
        manifest_path=args.manifest,
        page_scores_path=args.page_scores,
        revenue_opportunities_path=args.revenue_opportunities,
        audit_path=args.audit,
        experiments_path=args.experiments,
        optimization_history_path=args.optimization_history,
        content_experiments_path=args.content_experiments,
        ga4_snapshot_path=args.ga4_snapshot,
        gsc_snapshot_path=args.gsc_snapshot,
        adsense_snapshot_path=args.adsense_snapshot,
        naver_snapshot_path=args.naver_snapshot,
        analysis_commit=args.analysis_commit,
        workflow_run_id=args.workflow_run_id,
        workflow_run_attempt=args.workflow_run_attempt,
        pull_request_head_sha=args.pull_request_head_sha,
        ga4_source_revision=args.ga4_source_revision,
        adsense_source_revision=args.adsense_source_revision,
    )
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
