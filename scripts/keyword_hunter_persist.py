#!/usr/bin/env python3
"""Persist Keyword Hunter outputs with one fail-closed non-fast-forward recovery."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


BROAD_PATHS = (
    "data/keywords_master.csv",
    "data/keyword_seeds.json",
    "data/keyword_clusters.json",
    "data/rejected_keywords.json",
    "data/recent_exploration_history.json",
    "data/api_usage.json",
    "data/existing-page-improvement-candidates.json",
    "data/content-launch-queue.json",
    "PROJECT_HISTORY.md",
)
TARGETED_FIXED_PATHS = (
    "data/keyword-targeted-validation/latest.json",
    "data/api_usage.json",
)
HISTORY_PATH = "PROJECT_HISTORY.md"
PROTECTED_PUBLICATION_PATHS = (
    "data/published_keywords.json",
    "data/content-launch-counter.json",
    "data/content-launch-manifest.json",
    "data/content-launch-decisions.json",
)
UNSAFE_REMOTE_PREFIXES = ("data/", "scripts/", ".github/workflows/", ".github/actions/")
MAX_PUSH_ATTEMPTS = 2


class PersistenceError(RuntimeError):
    pass


def _git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", *args], cwd=root, text=True, capture_output=True, check=False
    )
    if check and result.returncode:
        raise PersistenceError(
            f"git {' '.join(args[:2])} failed ({result.returncode}): "
            f"{_redact(result.stderr.strip())}"
        )
    return result


def _redact(value: str) -> str:
    for key, secret in os.environ.items():
        if secret and any(token in key.upper() for token in ("TOKEN", "SECRET", "KEY", "PASSWORD")):
            value = value.replace(secret, "[REDACTED]")
    return re.sub(r"(https?://)[^/@\s]+@", r"\1[REDACTED]@", value)


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _diagnostic(diag_dir: Path, name: str, content: str) -> None:
    diag_dir.mkdir(parents=True, exist_ok=True)
    (diag_dir / name).write_text(_redact(content), encoding="utf-8")


def _load_json(path: Path):
    def reject_constant(value: str):
        raise ValueError(f"Invalid JSON numeric constant: {value}")

    return json.loads(path.read_text(encoding="utf-8"), parse_constant=reject_constant)


def _queue_is_valid(root: Path) -> None:
    from scripts.content_launch_policy import DAILY_PUBLICATION_LIMIT

    queue_path = root / "data/content-launch-queue.json"
    queue = _load_json(queue_path)
    daily_limit = queue.get("dailyLimit")
    if type(daily_limit) is not int or not 0 <= daily_limit <= DAILY_PUBLICATION_LIMIT:
        raise PersistenceError("Invalid review queue dailyLimit")
    items = queue.get("queue", [])
    if not isinstance(items, list) or len(items) > daily_limit:
        raise PersistenceError("Invalid review queue item count")
    for item in items:
        if (
            item.get("status") != "READY_TO_LAUNCH"
            or item.get("review_status") != "PAGE_REVIEW_READY"
            or not str(item.get("suggested_url", "")).startswith("/kor/")
        ):
            raise PersistenceError("Review queue failed the existing publication policy")


def _validate_outputs(root: Path, mode: str, paths: tuple[str, ...]) -> None:
    existing = [path for path in paths if (root / path).is_file()]
    if mode == "broad":
        from scripts.keyword_hunter_state import read_master

        master = root / "data/keywords_master.csv"
        if not master.is_file():
            raise PersistenceError("Missing Keyword Hunter master CSV")
        required = set(paths) - {HISTORY_PATH}
        missing = sorted(required - set(existing))
        if missing:
            raise PersistenceError(f"Missing broad measurement output: {', '.join(missing)}")
        # read_master validates the canonical columns, statuses, and normalized uniqueness.
        read_master(root)
        for path in existing:
            if path.endswith(".json"):
                value = _load_json(root / path)
                if path == "data/keyword_seeds.json" and (not isinstance(value, dict) or not isinstance(value.get("seeds"), list)):
                    raise PersistenceError("Keyword seeds output has an invalid schema")
                if path == "data/keyword_clusters.json" and not isinstance(value, dict):
                    raise PersistenceError("Keyword clusters output must be a JSON object")
                if path == "data/rejected_keywords.json" and not isinstance(value, list):
                    raise PersistenceError("Rejected keywords output must be a JSON array")
                if path == "data/recent_exploration_history.json" and (not isinstance(value, dict) or not isinstance(value.get("runs"), list)):
                    raise PersistenceError("Recent exploration history has an invalid schema")
                if path == "data/api_usage.json" and not isinstance(value, dict):
                    raise PersistenceError("API usage output must be a JSON object")
                if path == "data/existing-page-improvement-candidates.json" and (not isinstance(value, dict) or not isinstance(value.get("candidates"), list)):
                    raise PersistenceError("Existing-page candidate output has an invalid schema")
                if path == "data/content-launch-queue.json" and not isinstance(value, dict):
                    raise PersistenceError("Review queue output must be a JSON object")
        _queue_is_valid(root)
    else:
        if not existing:
            raise PersistenceError("Targeted run produced no approved measurement output")
        for path in existing:
            if path.endswith(".json"):
                value = _load_json(root / path)
                if not isinstance(value, dict):
                    raise PersistenceError(f"Targeted measurement output must be a JSON object: {path}")


def _verify_local_protections(root: Path, base_sha: str) -> None:
    for path in PROTECTED_PUBLICATION_PATHS:
        changed = _git(root, "diff", "--quiet", base_sha, "--", path, check=False)
        if changed.returncode:
            raise PersistenceError(f"Protected publication state changed locally: {path}")
        untracked = _git(root, "ls-files", "--others", "--exclude-standard", "--", path)
        if untracked.stdout.strip():
            raise PersistenceError(f"Protected publication state is untracked: {path}")

    status = _git(root, "status", "--porcelain", "--untracked-files=all").stdout
    for line in status.splitlines():
        changed_path = line[3:].split(" -> ")[-1]
        if changed_path.startswith("kor/") and changed_path.endswith(".html"):
            raise PersistenceError(f"HTML changed during Keyword Hunter measurement: {changed_path}")


def _changed_paths(root: Path, base_sha: str, target_sha: str) -> set[str]:
    result = _git(root, "diff", "--name-only", "--no-renames", base_sha, target_sha)
    return set(result.stdout.splitlines())


def _stage_paths(root: Path, paths: tuple[str, ...]) -> set[str]:
    staged_before = set(_git(root, "diff", "--cached", "--name-only").stdout.splitlines())
    if staged_before:
        raise PersistenceError("Unexpected pre-staged files before Keyword Hunter persistence")
    _git(root, "add", "-A", "--", *paths)
    staged = set(_git(root, "diff", "--cached", "--name-only").stdout.splitlines())
    unexpected = staged - set(paths)
    if unexpected:
        raise PersistenceError(f"Unexpected staged files: {', '.join(sorted(unexpected))}")
    return staged


def _is_non_fast_forward(stderr: str) -> bool:
    text = stderr.lower()
    return "non-fast-forward" in text or "fetch first" in text


def _history_merge(root: Path, base_sha: str, local_sha: str, remote_sha: str) -> bytes:
    def show(revision: str) -> bytes:
        result = subprocess.run(
            ["git", "show", f"{revision}:{HISTORY_PATH}"],
            cwd=root, capture_output=True, check=False,
        )
        if result.returncode:
            raise PersistenceError(f"Cannot read {HISTORY_PATH} at {revision}")
        return result.stdout

    base = show(base_sha)
    local = show(local_sha)
    remote = show(remote_sha)
    if not local.startswith(base) or not remote.startswith(base):
        raise PersistenceError("PROJECT_HISTORY.md is not append-only on both sides")
    local_suffix = local[len(base):]
    remote_suffix = remote[len(base):]
    if not local_suffix:
        return remote
    if local_suffix in remote_suffix:
        return remote
    separator = b""
    if remote and not remote.endswith(b"\n"):
        separator = b"\n"
    return remote + separator + local_suffix


def _safe_remote_changes(changed: set[str], state_paths: set[str]) -> tuple[bool, str]:
    protected = set(PROTECTED_PUBLICATION_PATHS)
    overlap = sorted((changed & state_paths) - {HISTORY_PATH})
    if overlap:
        return False, f"Remote measurement output changed: {', '.join(overlap)}"
    changed_protected = sorted(changed & protected)
    if changed_protected:
        return False, f"Remote publication state changed: {', '.join(changed_protected)}"
    unsafe = sorted(
        path for path in changed
        if path != HISTORY_PATH and path.startswith(UNSAFE_REMOTE_PREFIXES)
    )
    if unsafe:
        return False, f"Remote data or execution policy changed: {', '.join(unsafe)}"
    return True, "remote changes are disjoint from measured state and trusted policy"


def _recover_once(
    root: Path,
    base_sha: str,
    local_sha: str,
    paths: tuple[str, ...],
    mode: str,
    diag_dir: Path,
    diagnostics: dict[str, object],
) -> tuple[str, set[str]]:
    fetch = _git(root, "fetch", "--no-tags", "--deepen=64", "origin", "main", check=False)
    if fetch.returncode:
        raise PersistenceError(f"Cannot fetch latest origin/main: {_redact(fetch.stderr.strip())}")
    remote_sha = _git(root, "rev-parse", "FETCH_HEAD").stdout.strip()
    ancestor = _git(root, "merge-base", "--is-ancestor", base_sha, remote_sha, check=False)
    if ancestor.returncode:
        raise PersistenceError("Original execution SHA is not proven as an ancestor of latest main")

    changed = _changed_paths(root, base_sha, remote_sha)
    _write_json(diag_dir / "remote-changes.json", {
        "baseSha": base_sha,
        "remoteSha": remote_sha,
        "changedPaths": sorted(changed),
    })
    state_paths = set(paths)
    safe, reason = _safe_remote_changes(changed, state_paths)
    if not safe:
        raise PersistenceError(reason)

    local_changed = _changed_paths(root, base_sha, local_sha)
    unexpected_local = local_changed - set(paths)
    if unexpected_local:
        raise PersistenceError(f"Local measurement commit contains unexpected paths: {', '.join(sorted(unexpected_local))}")

    diag_dir.mkdir(parents=True, exist_ok=True)
    patch_file = diag_dir / "pending-measurements.patch"
    diff = subprocess.run(
        ["git", "diff", "--binary", base_sha, local_sha, "--", *[p for p in paths if p != HISTORY_PATH]],
        cwd=root, capture_output=True, check=False,
    )
    if diff.returncode:
        raise PersistenceError(f"Cannot preserve pending measurement patch: {_redact(diff.stderr.decode(errors='replace'))}")
    patch_file.write_bytes(diff.stdout)

    temp_root = Path(tempfile.mkdtemp(prefix="keyword-hunter-recovery-"))
    worktree = temp_root / "checkout"
    try:
        added = _git(root, "worktree", "add", "--detach", str(worktree), remote_sha, check=False)
        if added.returncode:
            raise PersistenceError(f"Cannot create recovery worktree: {_redact(added.stderr.strip())}")
        if diff.stdout:
            applied = _git(worktree, "apply", "--index", str(patch_file), check=False)
            if applied.returncode:
                raise PersistenceError(f"Cannot apply non-overlapping measurement patch: {_redact(applied.stderr.strip())}")

        if HISTORY_PATH in local_changed:
            history = _history_merge(root, base_sha, local_sha, remote_sha)
            history_path = worktree / HISTORY_PATH
            history_path.write_bytes(history)
            _git(worktree, "add", "--", HISTORY_PATH)

        _validate_outputs(worktree, mode, paths)
        _verify_local_protections(worktree, remote_sha)
        staged = set(_git(worktree, "diff", "--cached", "--name-only").stdout.splitlines())
        unexpected_staged = staged - set(paths)
        if unexpected_staged:
            raise PersistenceError(f"Recovery staged unexpected files: {', '.join(sorted(unexpected_staged))}")
        if not staged:
            # Another execution may have already persisted byte-identical state.
            return remote_sha, changed

        _git(worktree, "config", "user.name", "github-actions[bot]")
        _git(worktree, "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
        committed = _git(worktree, "commit", "-m", "chore: update keyword hunter observations", check=False)
        if committed.returncode:
            raise PersistenceError(f"Cannot commit recovered measurements: {_redact(committed.stderr.strip())}")
        recovered_sha = _git(worktree, "rev-parse", "HEAD").stdout.strip()
        actual = _changed_paths(worktree, remote_sha, recovered_sha)
        if actual - set(paths):
            raise PersistenceError(f"Recovered commit contains unexpected paths: {', '.join(sorted(actual - set(paths)))}")
        diagnostics["pushAttempts"] = 2
        _write_json(diag_dir / "persistence-provenance.json", diagnostics)
        pushed = _git(worktree, "push", "origin", "HEAD:refs/heads/main", check=False)
        if pushed.returncode:
            raise PersistenceError(f"Single recovery push failed: {_redact(pushed.stderr.strip())}")
        return recovered_sha, changed
    finally:
        if worktree.exists():
            _git(root, "worktree", "remove", "--force", str(worktree), check=False)
        shutil.rmtree(temp_root, ignore_errors=True)


def _target_paths(run_id: str, run_attempt: str) -> tuple[str, ...]:
    if not re.fullmatch(r"\d+", run_id) or not re.fullmatch(r"\d+", run_attempt):
        raise PersistenceError("Targeted persistence requires numeric GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT")
    return TARGETED_FIXED_PATHS + (f"reports/keyword-targeted-validation/{run_id}-{run_attempt}.json",)


def persist(root: Path, mode: str, base_sha: str, diag_dir: Path) -> int:
    paths = BROAD_PATHS if mode == "broad" else _target_paths(
        os.environ.get("GITHUB_RUN_ID", ""), os.environ.get("GITHUB_RUN_ATTEMPT", "")
    )
    base_sha = _git(root, "rev-parse", f"{base_sha}^{{commit}}").stdout.strip()
    diagnostics: dict[str, object] = {
        "mode": mode,
        "baseSha": base_sha,
        "executionSha": os.environ.get("GITHUB_SHA", base_sha),
        "workflowRunId": os.environ.get("GITHUB_RUN_ID"),
        "workflowRunAttempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
        "maxPushAttempts": MAX_PUSH_ATTEMPTS,
        "pushAttempts": 0,
        "result": "running",
    }
    diag_dir.mkdir(parents=True, exist_ok=True)
    _write_json(diag_dir / "persistence-provenance.json", diagnostics)
    try:
        _verify_local_protections(root, base_sha)
        _validate_outputs(root, mode, paths)
        staged = _stage_paths(root, paths)
        if not staged:
            diagnostics["result"] = "no_changes"
            _write_json(diag_dir / "persistence-provenance.json", diagnostics)
            print("Keyword Hunter persistence: no approved output changes; no commit or push.")
            return 0

        _validate_outputs(root, mode, paths)
        staged_names = sorted(staged)
        _git(root, "config", "user.name", "github-actions[bot]")
        _git(root, "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
        committed = _git(root, "commit", "-m", "chore: record targeted keyword measurements" if mode == "targeted" else "chore: update keyword hunter observations", check=False)
        if committed.returncode:
            raise PersistenceError(f"Cannot commit approved measurements: {_redact(committed.stderr.strip())}")
        local_sha = _git(root, "rev-parse", "HEAD").stdout.strip()
        diagnostics.update({"localCommit": local_sha, "stagedPaths": staged_names})
        push = _git(root, "push", "origin", "HEAD:refs/heads/main", check=False)
        diagnostics["pushAttempts"] = 1
        if push.returncode == 0:
            diagnostics["result"] = "pushed"
            _write_json(diag_dir / "persistence-provenance.json", diagnostics)
            print(f"Keyword Hunter persistence: pushed {local_sha}.")
            return 0

        stderr = _redact(push.stderr.strip())
        _diagnostic(diag_dir, "initial-push-error.txt", stderr + "\n")
        if not _is_non_fast_forward(push.stderr):
            raise PersistenceError(f"Initial push failed outside the non-fast-forward recovery gate: {stderr}")

        pending_patch = subprocess.run(
            ["git", "diff", "--binary", base_sha, local_sha, "--", *paths],
            cwd=root, capture_output=True, check=False,
        )
        if pending_patch.returncode == 0:
            (diag_dir / "pending-all-approved-state.patch").write_bytes(pending_patch.stdout)
        recovered_sha, remote_changes = _recover_once(root, base_sha, local_sha, paths, mode, diag_dir, diagnostics)
        recovery_base = _git(root, "rev-parse", "FETCH_HEAD").stdout.strip()
        diagnostics.update({
            "result": "recovered_and_pushed" if recovered_sha != recovery_base else "already_present",
            "recoveryBase": recovery_base,
            "recoveredCommit": recovered_sha,
            "remoteChangedPaths": sorted(remote_changes),
        })
        _write_json(diag_dir / "persistence-provenance.json", diagnostics)
        print(f"Keyword Hunter persistence: safe recovery completed at {recovered_sha}.")
        return 0
    except Exception as exc:
        diagnostics["result"] = "failed_closed"
        diagnostics["error"] = _redact(str(exc))
        _write_json(diag_dir / "persistence-provenance.json", diagnostics)
        _diagnostic(diag_dir, "failure.txt", _redact(str(exc)) + "\n")
        print(f"::error::Keyword Hunter persistence failed closed: {_redact(str(exc))}", file=sys.stderr)
        return 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("broad", "targeted"), required=True)
    parser.add_argument("--base-sha", default=os.environ.get("GITHUB_SHA", ""))
    parser.add_argument("--root", default=".")
    parser.add_argument("--diagnostics-dir", default=os.environ.get("RUNNER_TEMP", tempfile.gettempdir()))
    args = parser.parse_args()
    if not args.base_sha:
        parser.error("--base-sha or GITHUB_SHA is required")
    return persist(Path(args.root).resolve(), args.mode, args.base_sha, Path(args.diagnostics_dir).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
