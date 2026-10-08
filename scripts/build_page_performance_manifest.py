#!/usr/bin/env python3
"""Build and verify the bounded manifest for a full page-performance artifact."""

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path


SOURCE_LOGICAL_PATHS = {
    "ga4": "data/performance/ga4-latest.json",
    "gsc": "data/performance/gsc-latest.json",
    "adsense": "data/performance/adsense-latest.json",
}
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
GIT_SHA_RE = re.compile(r"^[0-9a-f]{40}$")
POSITIVE_INTEGER_RE = re.compile(r"^[1-9][0-9]*$")


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


def _required_git_sha(value, label):
    value = _required_identity(value, label)
    if not GIT_SHA_RE.fullmatch(value):
        raise ValueError(f"{label} must be a full 40-character Git SHA")
    return value


def _required_run_identity(value, label):
    value = _required_identity(value, label)
    if not POSITIVE_INTEGER_RE.fullmatch(value):
        raise ValueError(f"{label} must be a positive Actions identity; zero is not valid execution evidence")
    return value


def _repository_relative_path(path, repository_root):
    root = Path(repository_root).resolve()
    candidate = Path(path)
    if not candidate.is_absolute():
        candidate = root / candidate
    try:
        return candidate.resolve().relative_to(root).as_posix()
    except ValueError:
        raise ValueError("Naver snapshot must resolve inside the repository root") from None


def _verify_source_revision_blob(repository_root, revision, expected_sha256, source_key):
    """Require a claimed historical source revision to contain the exact input bytes."""
    label = {"ga4": "GA4", "adsense": "AdSense"}[source_key]
    revision = _required_git_sha(revision, f"{label} source revision")
    logical_path = SOURCE_LOGICAL_PATHS[source_key]
    try:
        source_bytes = subprocess.run(
            ["git", "show", f"{revision}:{logical_path}"],
            cwd=repository_root,
            capture_output=True,
            check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as exc:
        raise ValueError(f"could not read {label} source revision blob: {exc}") from exc
    actual_sha256 = hashlib.sha256(source_bytes).hexdigest()
    if actual_sha256 != expected_sha256:
        raise ValueError(f"{label} snapshot bytes do not match recorded {label} revision")
    return revision


def build_manifest(
    full_path,
    ga4_snapshot_path,
    gsc_snapshot_path,
    adsense_snapshot_path,
    naver_snapshot_path,
    analysis_commit,
    workflow_run_id,
    workflow_run_attempt,
    *,
    repository_root=None,
    pull_request_head_sha=None,
    ga4_source_revision=None,
    adsense_source_revision=None,
):
    """Return deterministic manifest metadata without exposing runner paths."""
    analysis_commit = _required_git_sha(analysis_commit, "analysis commit")
    workflow_run_id = _required_run_identity(workflow_run_id, "workflow run ID")
    workflow_run_attempt = _required_run_identity(workflow_run_attempt, "workflow run attempt")
    pull_request_head_sha = (
        _required_git_sha(pull_request_head_sha, "pull request head SHA")
        if pull_request_head_sha
        else None
    )
    repository_root = Path(repository_root or Path.cwd())
    ga4_source_revision = _verify_source_revision_blob(
        repository_root, ga4_source_revision, _sha256(ga4_snapshot_path)[0], "ga4"
    ) if ga4_source_revision else None
    adsense_source_revision = _verify_source_revision_blob(
        repository_root, adsense_source_revision, _sha256(adsense_snapshot_path)[0], "adsense"
    ) if adsense_source_revision else None

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
    naver = _read_json(naver_snapshot_path, "Naver source snapshot")
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
        snapshot = {"path": SOURCE_LOGICAL_PATHS[key], "sha256": source_hash}
        if key == "ga4":
            snapshot["revision"] = ga4_source_revision
        elif key == "adsense":
            snapshot["revision"] = adsense_source_revision
        source_snapshots[key] = snapshot

    naver_hash, _ = _sha256(naver_snapshot_path)
    if not isinstance(naver, dict):
        raise ValueError("Naver source snapshot must be an object")
    source_snapshots["naver"] = {
        "path": _repository_relative_path(naver_snapshot_path, repository_root),
        "sha256": naver_hash,
        "source": naver.get("source"),
        "period": naver.get("period"),
        "periodPreset": naver.get("periodPreset"),
        "dataUpdatedAt": naver.get("dataUpdatedAt"),
    }

    return {
        "schemaVersion": 2,
        "analysisCommit": analysis_commit,
        "pullRequestHeadSha": pull_request_head_sha,
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
    naver_snapshot_path,
    analysis_commit,
    workflow_run_id,
    workflow_run_attempt,
    *,
    repository_root=None,
    pull_request_head_sha=None,
    ga4_source_revision=None,
    adsense_source_revision=None,
):
    """Fail closed unless the supplied manifest exactly matches current inputs."""
    expected = build_manifest(
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
    parser.add_argument("--naver", type=Path, required=True)
    parser.add_argument("--analysis-commit", required=True)
    parser.add_argument("--pull-request-head-sha")
    parser.add_argument("--ga4-source-revision")
    parser.add_argument("--adsense-source-revision")
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
        args.naver,
        args.analysis_commit,
        args.workflow_run_id,
        args.workflow_run_attempt,
    )
    if args.verify:
        result = verify_manifest(
            _read_json(args.verify, "manifest"),
            *inputs,
            pull_request_head_sha=args.pull_request_head_sha,
            ga4_source_revision=args.ga4_source_revision,
            adsense_source_revision=args.adsense_source_revision,
        )
    else:
        manifest = build_manifest(
            *inputs,
            pull_request_head_sha=args.pull_request_head_sha,
            ga4_source_revision=args.ga4_source_revision,
            adsense_source_revision=args.adsense_source_revision,
        )
        _write_atomic(args.output, serialize_manifest(manifest))
        result = {"written": str(args.output), "asOf": manifest["asOf"], "pageCount": manifest["pageCount"]}
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
