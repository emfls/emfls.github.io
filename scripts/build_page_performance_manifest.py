#!/usr/bin/env python3
"""Build and verify the bounded manifest for a full page-performance artifact."""

import argparse
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path


SOURCE_LOGICAL_PATHS = {
    "ga4": "data/performance/ga4-latest.json",
    "gsc": "data/performance/gsc-latest.json",
    "adsense": "data/performance/adsense-latest.json",
}
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def _read_json(path, label):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"could not read {label} JSON: {exc}") from exc


def _sha256(path):
    digest = hashlib.sha256()
    size = 0
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


def _period(value, label):
    if not isinstance(value, dict):
        raise ValueError(f"{label} is missing or malformed")
    start = value.get("start")
    end = value.get("end")
    if not isinstance(start, str) or not isinstance(end, str) or not start or not end:
        raise ValueError(f"{label} must contain non-empty start and end dates")
    return {"start": start, "end": end}


def _required_identity(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string")
    return value.strip()


def build_manifest(
    full_path,
    ga4_snapshot_path,
    gsc_snapshot_path,
    adsense_snapshot_path,
    analysis_commit,
    workflow_run_id,
    workflow_run_attempt,
):
    """Return deterministic manifest metadata without exposing runner paths."""
    analysis_commit = _required_identity(analysis_commit, "analysis commit")
    workflow_run_id = _required_identity(workflow_run_id, "workflow run ID")
    workflow_run_attempt = _required_identity(workflow_run_attempt, "workflow run attempt")

    full = _read_json(full_path, "full page-performance artifact")
    if not isinstance(full, dict) or not isinstance(full.get("asOf"), str) or not full["asOf"].strip():
        raise ValueError("full page-performance artifact must contain a non-empty asOf")
    pages = full.get("pages")
    summary = full.get("summary")
    if not isinstance(pages, list) or not isinstance(summary, dict):
        raise ValueError("full page-performance artifact must contain pages and summary")
    page_count = len(pages)
    if summary.get("evaluatedIndexablePages") != page_count:
        raise ValueError("full page-performance page count does not match summary")

    ga4 = _read_json(ga4_snapshot_path, "GA4 source snapshot")
    gsc = _read_json(gsc_snapshot_path, "GSC source snapshot")
    adsense = _read_json(adsense_snapshot_path, "AdSense source snapshot")
    ga4_periods = ga4.get("periods") if isinstance(ga4, dict) else None
    gsc_periods = gsc.get("periods") if isinstance(gsc, dict) else None
    ga4_period = _period(ga4_periods.get("ga4") if isinstance(ga4_periods, dict) else None, "GA4 period")
    gsc_period_value = (
        {"start": gsc.get("periodStart"), "end": gsc.get("periodEnd")}
        if isinstance(gsc, dict) and gsc.get("periodStart") and gsc.get("periodEnd")
        else gsc_periods.get("gsc") if isinstance(gsc_periods, dict) else None
    )
    gsc_period = _period(gsc_period_value, "GSC period")
    adsense_period = adsense.get("currentPeriod") if isinstance(adsense, dict) else None
    if not isinstance(adsense_period, dict) or not adsense_period:
        raise ValueError("AdSense currentPeriod is missing or malformed")
    if not isinstance(adsense_period.get("start"), str) or not isinstance(adsense_period.get("end"), str):
        raise ValueError("AdSense currentPeriod must contain start and end dates")

    full_hash, full_size = _sha256(full_path)
    source_snapshots = {}
    for key, path in (
        ("ga4", ga4_snapshot_path),
        ("gsc", gsc_snapshot_path),
        ("adsense", adsense_snapshot_path),
    ):
        source_hash, _ = _sha256(path)
        source_snapshots[key] = {"path": SOURCE_LOGICAL_PATHS[key], "sha256": source_hash}

    return {
        "schemaVersion": 1,
        "analysisCommit": analysis_commit,
        "workflowRunId": workflow_run_id,
        "workflowRunAttempt": workflow_run_attempt,
        "asOf": full["asOf"],
        "pageCount": page_count,
        "fullArtifact": {
            "path": "page-performance-full.json",
            "sha256": full_hash,
            "bytes": full_size,
        },
        "sourceSnapshots": source_snapshots,
        "ga4Period": ga4_period,
        "gscPeriod": gsc_period,
        "adsenseCurrentPeriod": adsense_period,
    }


def verify_manifest(
    manifest,
    full_path,
    ga4_snapshot_path,
    gsc_snapshot_path,
    adsense_snapshot_path,
    analysis_commit,
    workflow_run_id,
    workflow_run_attempt,
):
    """Fail closed unless the supplied manifest exactly matches current inputs."""
    expected = build_manifest(
        full_path,
        ga4_snapshot_path,
        gsc_snapshot_path,
        adsense_snapshot_path,
        analysis_commit,
        workflow_run_id,
        workflow_run_attempt,
    )
    if manifest != expected:
        raise ValueError("manifest does not match current inputs")
    return {"valid": True, "asOf": expected["asOf"], "pageCount": expected["pageCount"]}


def serialize_manifest(manifest):
    return (json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode(
        "utf-8"
    )


def _write_atomic(path, content):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{target.name}.", suffix=".tmp", dir=target.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(content)
        temporary.replace(target)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def _add_inputs(parser):
    parser.add_argument("--full", type=Path, required=True)
    parser.add_argument("--ga4", type=Path, required=True)
    parser.add_argument("--gsc", type=Path, required=True)
    parser.add_argument("--adsense", type=Path, required=True)
    parser.add_argument("--analysis-commit", required=True)
    parser.add_argument("--workflow-run-id", required=True)
    parser.add_argument("--workflow-run-attempt", required=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    _add_inputs(parser)
    output = parser.add_mutually_exclusive_group(required=True)
    output.add_argument("--output", type=Path)
    output.add_argument("--verify", type=Path, help="verify an existing manifest JSON")
    args = parser.parse_args()
    inputs = (
        args.full,
        args.ga4,
        args.gsc,
        args.adsense,
        args.analysis_commit,
        args.workflow_run_id,
        args.workflow_run_attempt,
    )
    if args.verify:
        result = verify_manifest(_read_json(args.verify, "manifest"), *inputs)
    else:
        manifest = build_manifest(*inputs)
        _write_atomic(args.output, serialize_manifest(manifest))
        result = {"written": str(args.output), "asOf": manifest["asOf"], "pageCount": manifest["pageCount"]}
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
