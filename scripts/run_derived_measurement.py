#!/usr/bin/env python3
"""Build and validate derived measurement artifacts entirely under emfls-ops."""

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def run(command, repo):
    print("+", " ".join(str(part) for part in command), flush=True)
    subprocess.run([str(part) for part in command], cwd=repo, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--ops", type=Path, required=True)
    args = parser.parse_args()
    repo = args.repo.resolve()
    ops = args.ops.resolve()
    data = ops / "data"
    reports = ops / "reports"
    cache = ops / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    today = datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat()
    run_id = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%d%H%M%S")
    py = sys.executable
    ga4 = data / "performance/ga4-latest.json"
    gsc = data / "performance/gsc-latest.json"
    adsense = data / "performance/adsense-latest.json"
    naver_dir = data / "naver"

    run([py, "scripts/validate_measurement_sources.py", "--ga4", ga4, "--gsc", gsc, "--adsense", adsense, "--as-of", today], repo)
    run([py, "scripts/seo_audit.py", repo, "--json", cache / "site-audit-full.json", "--compact-json", data / "site-audit.json", "--markdown", reports / "seo-audit.md"], repo)
    run([
        py, "scripts/quality_audit.py", "--root", repo, "--audit", cache / "site-audit-full.json",
        "--metadata", data / "content-metadata.json", "--performance-dir", data / "performance",
        "--cannibalization", data / "cannibalization-report.json", "--as-of", today,
        "--page-output", data / "page-scores.json", "--site-output", data / "site-score.json",
        "--report", reports / "site-score.md", "--dashboard", reports / "site-quality-dashboard.html",
    ], repo)

    from scripts.naver_performance import latest_naver_snapshot_path

    naver = latest_naver_snapshot_path(naver_dir)
    if not naver or not naver.is_file():
        raise SystemExit("No eligible Naver Search Advisor snapshot is available under EMFLS_OPS_DIR/data/naver")

    full = cache / "page-performance-full.json"
    revenue = cache / "revenue-opportunities-full.json"
    growth_report = cache / "revenue-growth-report-full.md"
    page_scores = data / "page-scores.json"
    audit = data / "site-audit.json"
    run([
        py, "scripts/revenue_growth.py", "--as-of", today,
        "--performance", ga4, "--audit", audit, "--page-scores", page_scores,
        "--gsc-snapshot", gsc, "--adsense-snapshot", adsense, "--naver-snapshot", naver,
        "--experiments", data / "experiments.json", "--optimization-history", data / "optimization-history.json",
        "--content-experiments", data / "content-launch-experiments.json",
        "--page-output", full, "--opportunity-output", revenue, "--report", growth_report,
    ], repo)
    run([py, "scripts/validate_measurement_artifact.py", full, "--page-scores", page_scores], repo)

    manifest = cache / "page-performance-manifest.json"
    analysis_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip()
    run([
        py, "scripts/build_page_performance_manifest.py", "--full", full, "--ga4", ga4, "--gsc", gsc,
        "--adsense", adsense, "--naver", naver, "--analysis-commit", analysis_commit,
        "--repository-root", ops, "--workflow-run-id", run_id, "--workflow-run-attempt", "1", "--output", manifest,
    ], repo)
    compact = cache / "page-performance-compact.json"
    run([py, "scripts/compact_page_performance.py", full, "--page-scores", page_scores, "--output", compact], repo)
    run([py, "scripts/validate_measurement_artifact.py", compact, "--page-scores", page_scores], repo)
    run([
        py, "scripts/validate_page_performance_compact_parity.py", "--full", full, "--compact", compact,
        "--manifest", manifest, "--page-scores", page_scores, "--revenue-opportunities", revenue,
        "--audit", audit, "--experiments", data / "experiments.json",
        "--optimization-history", data / "optimization-history.json",
        "--content-experiments", data / "content-launch-experiments.json",
        "--ga4-snapshot", ga4, "--gsc-snapshot", gsc, "--adsense-snapshot", adsense,
        "--naver-snapshot", naver, "--repository-root", ops, "--analysis-commit", analysis_commit,
        "--workflow-run-id", run_id, "--workflow-run-attempt", "1",
    ], repo)
    run([
        py, "scripts/promote_measurement_artifacts.py", "--page-source", compact,
        "--opportunity-source", revenue, "--report-source", growth_report,
        "--page-target", data / "page-performance.json",
        "--opportunity-target", data / "revenue-opportunities.json",
        "--report-target", reports / "revenue-growth-report.md",
    ], repo)
    snapshot = json.loads((data / "page-performance.json").read_text(encoding="utf-8"))
    print(json.dumps({"task": "derived-measurement", "rows": len(snapshot["pages"]), "as_of": snapshot.get("asOf"), "status": "PASS"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
