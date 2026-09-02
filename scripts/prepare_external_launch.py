#!/usr/bin/env python3
"""Prepare a fail-closed launch manifest from the external READY queue."""

import argparse
import json
from datetime import datetime
from pathlib import Path

try:
    from scripts.external_content_opportunity import launch_readiness
except ModuleNotFoundError:
    from external_content_opportunity import launch_readiness


def _read(path, default):
    path = Path(path)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _write(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _published_today(experiments, run_at):
    local_day = datetime.fromisoformat(run_at).date().isoformat()
    return [row for row in experiments if row.get("publishedOn") == local_day]


def _expected_value(candidate):
    inputs = candidate.get("selectionInputs") or {}
    revenue = float(inputs.get("expectedRevenueImpact") or 0)
    demand = float(inputs.get("demandConfidence") or 0)
    quality = float((candidate.get("qualityScore") or launch_readiness(candidate).get("qualityScore") or 0)) / 100
    evergreen = float(inputs.get("evergreenPotential") or 0)
    competition = max(float(inputs.get("competitionCost") or 0), 0.1)
    return revenue * demand * quality * evergreen / competition


def _required_paths(candidate):
    return all(
        candidate.get(key)
        for key in ("url", "contentPath", "sitemapPath", "hubPath", "candidateId")
    )


def prepare_external_launch(root, run_at, write=True):
    root = Path(root)
    queue = _read(
        root / "data/external-content-opportunities.json",
        {"candidates": [], "readyToLaunch": []},
    )
    experiments = _read(
        root / "data/content-launch-experiments.json", {"experiments": []}
    ).get("experiments") or []
    ready_ids = set(queue.get("readyToLaunch") or [])
    eligible = []
    for candidate in queue.get("candidates") or []:
        readiness = launch_readiness(candidate)
        if candidate.get("candidateId") not in ready_ids:
            continue
        if readiness.get("status") != "READY_TO_LAUNCH":
            continue
        if not _required_paths(candidate):
            continue
        eligible.append({**candidate, "readiness": readiness})
    eligible.sort(key=lambda row: (-_expected_value(row), row.get("candidateId", "")))
    capacity = max(0, 3 - len(_published_today(experiments, run_at)))
    selected = eligible[:capacity]
    manifest = {
        "schemaVersion": 1,
        "runId": "EXT-RUN-" + datetime.fromisoformat(run_at).strftime("%Y%m%d-%H%M"),
        "runAt": run_at,
        "status": "READY" if selected else "NO_PUBLICATION",
        "urls": [row["url"] for row in selected],
        "candidateIds": [row["candidateId"] for row in selected],
        "contentPaths": [row["contentPath"] for row in selected],
        "sitemapPaths": sorted({row["sitemapPath"] for row in selected}),
        "hubPaths": sorted({row["hubPath"] for row in selected}),
        "dailyLimit": 3,
        "publishedToday": len(_published_today(experiments, run_at)),
        "remainingCapacity": capacity,
    }
    index_candidates = {
        "schemaVersion": 1,
        "runAt": run_at,
        "status": "REVIEW_ONLY",
        "candidates": [
            {
                "url": row["url"],
                "candidateId": row["candidateId"],
                "status": "PENDING_CONTENT_LAUNCH",
            }
            for row in selected
        ],
    }
    if write:
        _write(root / "data/content-launch-manifest.json", manifest)
        _write(root / "data/google-index-candidates.json", index_candidates)
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--run-at", required=True)
    args = parser.parse_args()
    result = prepare_external_launch(args.root, args.run_at)
    print(
        json.dumps(
            {
                "status": result["status"],
                "selected": len(result["candidateIds"]),
                "remainingCapacity": result["remainingCapacity"],
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
