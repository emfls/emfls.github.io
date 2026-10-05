#!/usr/bin/env python3
"""Prepare a fail-closed launch manifest from the external READY queue."""

import argparse
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    from scripts.external_content_opportunity import launch_readiness
except ModuleNotFoundError:
    from external_content_opportunity import launch_readiness

try:
    from scripts.content_launch_policy import DAILY_PUBLICATION_LIMIT, publication_day, publication_manifest_count
except ModuleNotFoundError:
    from content_launch_policy import DAILY_PUBLICATION_LIMIT, publication_day, publication_manifest_count


SEOUL = ZoneInfo("Asia/Seoul")


def _seoul_datetime(value):
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed.astimezone(SEOUL) if parsed.tzinfo is not None else parsed.replace(tzinfo=SEOUL)

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


def _published_today(experiments, run_at, reset_at=None):
    local_day = publication_day(run_at)
    rows = []
    for row in experiments:
        published_at = row.get("publishedAt")
        try:
            row_day = _seoul_datetime(published_at).date() if published_at else publication_day(row.get("publishedOn"))
        except (TypeError, ValueError):
            row_day = publication_day(row.get("publishedOn"))
        if row_day == local_day:
            rows.append(row)
    if not reset_at:
        return rows
    reset_time = _seoul_datetime(reset_at)
    result = []
    for row in rows:
        try:
            published_at = _seoul_datetime(row.get("publishedAt"))
        except (TypeError, ValueError):
            continue
        if published_at > reset_time:
            result.append(row)
    return result


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
    counter_state = _read(root / "data/content-launch-counter.json", {})
    previous_manifest = _read(root / "data/content-launch-manifest.json", {})
    reset_at = counter_state.get("resetAt")
    published_candidate_ids = {
        row.get("candidateId") for row in experiments if row.get("candidateId")
    }
    ready_ids = set(queue.get("readyToLaunch") or [])
    eligible = []
    for candidate in queue.get("candidates") or []:
        readiness = launch_readiness(candidate)
        if candidate.get("candidateId") in published_candidate_ids:
            continue
        if candidate.get("candidateId") not in ready_ids:
            continue
        if readiness.get("status") != "READY_TO_LAUNCH":
            continue
        if not _required_paths(candidate):
            continue
        eligible.append({**candidate, "readiness": readiness})
    eligible.sort(key=lambda row: (-_expected_value(row), row.get("candidateId", "")))
    selected_day = publication_day(run_at)
    published_today = _published_today(experiments, run_at, reset_at)
    counter_count = 0
    if publication_day(counter_state.get("date")) == selected_day:
        try:
            counter_count = max(0, int(counter_state.get("launchedCount", 0)))
        except (TypeError, ValueError):
            counter_count = DAILY_PUBLICATION_LIMIT
    manifest_count = publication_manifest_count(
        previous_manifest, selected_day, DAILY_PUBLICATION_LIMIT
    )
    # These are parallel views of today's total; max avoids counting the same launch twice.
    published_today_count = max(counter_count, manifest_count, len(published_today))
    remaining_capacity = max(0, DAILY_PUBLICATION_LIMIT - published_today_count)
    selected = eligible[:remaining_capacity]
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
        "dailyLimit": DAILY_PUBLICATION_LIMIT,
        "publishedToday": published_today_count,
        "remainingCapacity": remaining_capacity,
        "publicationAccountingDate": selected_day.isoformat(),
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
