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
    from scripts.content_launch_policy import (
        DAILY_PUBLICATION_LIMIT,
        FINAL_PUBLICATION_STATUSES,
        publication_day,
        publication_manifest_count,
    )
except ModuleNotFoundError:
    from content_launch_policy import (
        DAILY_PUBLICATION_LIMIT,
        FINAL_PUBLICATION_STATUSES,
        publication_day,
        publication_manifest_count,
    )


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


def _published_today(experiments, run_at):
    """Count every experiment published on the run's KST day; resets cannot erase history."""
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
    return rows


def _read_ledger(path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8")), True, False
    except FileNotFoundError:
        return default, False, False
    except (OSError, UnicodeError, ValueError):
        return default, True, True


def _manifest_count(manifest, is_final, selected_day):
    published_today = manifest.get("publishedToday")
    if published_today is not None:
        if not (
            type(published_today) is int and published_today >= 0
            or isinstance(published_today, str) and published_today.strip().isdigit()
        ):
            raise ValueError("invalid manifest publication count")
    elif not is_final:
        raise ValueError("accounting manifest has no publication count")
    if is_final:
        for key in ("urls", "candidateIds", "contentPaths"):
            values = manifest.get(key)
            if values is None:
                continue
            if not isinstance(values, (list, tuple)) or any(
                not isinstance(value, str) or not value.strip() for value in values
            ):
                raise ValueError("invalid manifest publication identities")
    count = publication_manifest_count(manifest, selected_day, DAILY_PUBLICATION_LIMIT)
    if is_final and count == 0:
        raise ValueError("published manifest has no publication count")
    return count


def _publication_accounting(
    counter,
    counter_present,
    manifest,
    manifest_present,
    experiment_doc,
    experiment_present,
    run_at,
    selected_day,
    read_error=False,
):
    if selected_day is None:
        return "INVALID", None, []
    if read_error or (counter_present and not isinstance(counter, dict)):
        return "INVALID", None, []
    if manifest_present and not isinstance(manifest, dict):
        return "INVALID", None, []
    if experiment_present and not isinstance(experiment_doc, dict):
        return "INVALID", None, []

    counts = {}
    if counter_present:
        counter_day = publication_day(counter.get("date"))
        if counter_day == selected_day:
            count = counter.get("launchedCount")
            if type(count) is not int or count < 0:
                return "INVALID", None, []
            counts["counter"] = count

    if experiment_present:
        rows = experiment_doc.get("experiments")
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            return "INVALID", None, []
        rows_today = _published_today(rows, run_at)
        if publication_day(experiment_doc.get("asOf")) == selected_day:
            counts["experiments"] = len(rows_today)
        elif rows_today:
            return "INVALID", None, []

    derived_count = None
    if manifest_present:
        history = manifest.get("preservedManifestRecords", [])
        if not isinstance(history, list) or any(not isinstance(row, dict) for row in history):
            return "INVALID", None, []
        status = str(manifest.get("status") or "").upper()
        is_final = status in FINAL_PUBLICATION_STATUSES
        manifest_day = publication_day(
            manifest.get("runAt") if is_final else manifest.get("publicationAccountingDate")
        )
        if is_final and manifest_day is None:
            return "INVALID", None, []
        if is_final and manifest_day == selected_day:
            try:
                counts["manifest"] = _manifest_count(manifest, True, selected_day)
            except ValueError:
                return "INVALID", None, []
        elif (
            status in {"READY", "NO_PUBLICATION"}
            and publication_day(manifest.get("publicationAccountingDate")) == selected_day
        ):
            try:
                derived_count = _manifest_count(manifest, False, selected_day)
            except ValueError:
                return "INVALID", None, []

    if not counts:
        return "UNKNOWN", None, []
    if len(set(counts.values())) != 1:
        return "CONFLICT", None, sorted(counts)
    verified_count = next(iter(counts.values()))
    if derived_count is not None and derived_count > verified_count:
        return "CONFLICT", None, sorted(counts)
    return "VERIFIED", max(verified_count, derived_count or 0), sorted(counts)


def _preserved_manifest_records(manifest):
    history = [dict(row) for row in manifest.get("preservedManifestRecords", [])]
    if str(manifest.get("status") or "").upper() in FINAL_PUBLICATION_STATUSES:
        previous = {
            key: value for key, value in manifest.items()
            if key != "preservedManifestRecords"
        }
        run_id = previous.get("runId")
        if not any(
            row.get("runId") == run_id if run_id else row == previous
            for row in history
        ):
            history.append(previous)
    return history


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
    experiment_doc, experiment_present, experiment_error = _read_ledger(
        root / "data/content-launch-experiments.json", {}
    )
    counter_state, counter_present, counter_error = _read_ledger(
        root / "data/content-launch-counter.json", {}
    )
    previous_manifest, manifest_present, manifest_error = _read_ledger(
        root / "data/content-launch-manifest.json", {}
    )
    selected_day = publication_day(run_at)
    accounting_status, published_today_count, accounting_sources = _publication_accounting(
        counter_state,
        counter_present,
        previous_manifest,
        manifest_present,
        experiment_doc,
        experiment_present,
        run_at,
        selected_day,
        counter_error or manifest_error or experiment_error,
    )
    if accounting_status != "VERIFIED":
        return {
            "schemaVersion": 1,
            "runId": "EXT-RUN-" + datetime.fromisoformat(run_at).strftime("%Y%m%d-%H%M"),
            "runAt": run_at,
            "status": "HOLD",
            "urls": [],
            "candidateIds": [],
            "contentPaths": [],
            "sitemapPaths": [],
            "hubPaths": [],
            "dailyLimit": DAILY_PUBLICATION_LIMIT,
            "publishedToday": None,
            "remainingCapacity": 0,
            "publicationAccountingDate": selected_day.isoformat() if selected_day else None,
            "publicationAccountingStatus": accounting_status,
            "publicationAccountingSources": accounting_sources,
        }
    experiments = experiment_doc.get("experiments", [])
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
        "publicationAccountingStatus": accounting_status,
        "publicationAccountingSources": accounting_sources,
    }
    preserved_records = _preserved_manifest_records(previous_manifest)
    if preserved_records:
        manifest["preservedManifestRecords"] = preserved_records
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
