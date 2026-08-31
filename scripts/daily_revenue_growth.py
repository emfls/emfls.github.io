#!/usr/bin/env python3
"""Build deterministic, fail-closed artifacts for each growth run."""

import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path

try:
    from scripts.new_content_opportunity import classify_overlap, evaluate_launch_cohort, score_new_content, select_new_pages, validate_demand_evidence
except ModuleNotFoundError:
    from new_content_opportunity import classify_overlap, evaluate_launch_cohort, score_new_content, select_new_pages, validate_demand_evidence


def read_json(path, default):
    path = Path(path)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def write_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _evaluate(raw, as_of):
    evidence = [validate_demand_evidence(row, as_of[:10]) for row in raw.get("demandEvidence") or []]
    direct = next((row for row in evidence if row.get("status") == "VERIFIED"), None)
    overlap = classify_overlap(raw, raw.get("closest"))
    demand = {"status": "VERIFIED" if direct else (evidence[0].get("status") if evidence else "INSUFFICIENT_DATA"), "strength": raw.get("demandStrength") if direct else 0, "evidence": evidence}
    candidate = {**raw, "demand": demand, "overlap": overlap}
    scored = score_new_content(candidate)
    decision = overlap["decision"]
    if not direct and decision == "NEW_PAGE":
        decision = "WAIT_FOR_DATA"
    return {**candidate, "score": scored["score"], "scoreComponents": scored["components"], "decision": decision}


def _recent_launches(experiments, run_at):
    current = datetime.fromisoformat(run_at)
    cutoff = current - timedelta(hours=24)
    rows = []
    for row in experiments:
        try:
            published = datetime.fromisoformat(row.get("publishedAt", ""))
        except ValueError:
            continue
        if cutoff <= published <= current:
            rows.append(row)
    return rows


def _report(payload):
    lines = ["# Daily Revenue Growth", "", f"- Run: {payload['runAt']}", f"- Data Status: {payload['dataStatus']}", f"- Researched: {len(payload['candidates'])}", f"- Selected: {len(payload['selected'])}", f"- Published: 0 (analysis and selection are separate)", "", "## New Page Win Rate", "", f"- Mature cohort: {payload['kpis']['matureCohort']}", f"- Win rate: {payload['kpis']['newPageWinRate']}", "", "## Data Limitations", ""]
    lines.append("- No eligible direct query evidence; zero publication is expected." if not payload["selected"] else "- Selected pages still require content creation and the launch guard.")
    lines.extend(["", "## Candidates", ""])
    for row in payload["candidates"]:
        lines.append("- `{}` — {} / {} / {}".format(row.get("url"), row.get("score"), row.get("decision"), row.get("demand", {}).get("status")))
    return "\n".join(lines) + "\n"


def run_daily_analysis(root, run_at, research_path, write=True):
    root = Path(root)
    research = read_json(research_path, {"candidates": []})
    raw = research.get("candidates") or []
    candidates = sorted((_evaluate(row, run_at) for row in raw), key=lambda row: (-float(row.get("score") or 0), row.get("url", "")))
    launches = read_json(root / "data/content-launch-experiments.json", {"experiments": []}).get("experiments") or []
    active = sum(row.get("status") == "OBSERVING" for row in launches)
    complete_research = 10 <= len(raw) <= 20
    selected = select_new_pages(candidates, active, _recent_launches(launches, run_at)) if complete_research else []
    cohort = evaluate_launch_cohort(launches, run_at[:10])
    status = "VERIFIED" if complete_research and any((row.get("demand") or {}).get("status") == "VERIFIED" for row in candidates) else "INSUFFICIENT_DATA"
    payload = {
        "schemaVersion": 1, "runAt": run_at, "dataStatus": status,
        "candidates": candidates, "selected": selected,
        "kpis": {"activeContentExperiments": active, "newPagesLast28d": sum(row.get("publishedOn", "") >= (datetime.fromisoformat(run_at).date() - timedelta(days=28)).isoformat() for row in launches), "matureCohort": cohort["mature"], "newPageWinRate": cohort["winRate"]},
    }
    manifest = {
        "schemaVersion": 1, "runId": "RUN-" + datetime.fromisoformat(run_at).strftime("%Y%m%d-%H%M"), "runAt": run_at,
        "status": "READY" if selected else "NO_PUBLICATION", "urls": [row["url"] for row in selected],
        "candidateIds": [row["candidateId"] for row in selected], "contentPaths": [row["contentPath"] for row in selected],
        "sitemapPaths": sorted({row["sitemapPath"] for row in selected}), "hubPaths": sorted({row["hubPath"] for row in selected}),
    }
    index_candidates = {"schemaVersion": 1, "runAt": run_at, "status": "REVIEW_ONLY", "candidates": [{"url": row["url"], "status": "PENDING_CONTENT_LAUNCH"} for row in selected]}
    if write:
        write_json(root / "data/new-content-opportunities.json", payload)
        write_json(root / "data/content-launch-manifest.json", manifest)
        write_json(root / "data/google-index-candidates.json", index_candidates)
        report = root / "reports/daily-revenue-growth.md"
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(_report(payload), encoding="utf-8")
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--run-at", required=True)
    parser.add_argument("--research", type=Path, default=Path("data/new-content-research.json"))
    args = parser.parse_args()
    result = run_daily_analysis(args.root, args.run_at, args.research)
    print(json.dumps({"researched": len(result["candidates"]), "selected": len(result["selected"]), "status": result["dataStatus"]}))


if __name__ == "__main__":
    main()
