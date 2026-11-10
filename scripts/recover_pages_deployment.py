#!/usr/bin/env python3
"""Recover a failed GitHub Pages deployment before selecting another Notion draft.

This is a bounded, fail-closed action. It can retry the failed *deploy job* for
the current main SHA, but it never publishes or edits a draft, commits to Git,
changes the Notion status, or overrides the live-page check.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import json
import os
import re
import subprocess
import sys
import time

from publish_scheduled_queue import previous_release_is_live

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "data/scheduled-publication-ledger.jsonl"
MAX_RUN_ATTEMPTS = 3  # Original deploy + at most two recovery attempts.
WAIT_SECONDS = 660
POLL_SECONDS = 20


class RecoveryError(RuntimeError):
    pass


def previous_notion_entry(root: Path) -> dict | None:
    ledger = root / "data/scheduled-publication-ledger.jsonl"
    if not ledger.is_file():
        return None
    for line in reversed(ledger.read_text(encoding="utf-8").splitlines()):
        if not line.strip():
            continue
        record = json.loads(line)
        if record.get("notionPageId") and record.get("url") and record.get("title"):
            return record
    return None


def request_api(method: str, path: str, token: str) -> dict:
    req = Request(
        "https://api.github.com" + path,
        method=method,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "emfls-pages-recovery",
        },
    )
    try:
        with urlopen(req, timeout=25) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except HTTPError as exc:
        detail = exc.read(600).decode("utf-8", errors="replace")
        raise RecoveryError(f"GitHub API {method} {path} returned HTTP {exc.code}: {detail}") from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise RecoveryError(f"GitHub API unavailable for {method} {path}: {type(exc).__name__}") from exc


def latest_pages_run(api, repo: str, sha: str, token: str) -> dict:
    data = api("GET", f"/repos/{repo}/actions/runs?per_page=100", token)
    candidates = [
        run for run in data.get("workflow_runs", [])
        if run.get("name") == "pages build and deployment"
        and run.get("head_sha") == sha
        and run.get("event") == "dynamic"
    ]
    if not candidates:
        raise RecoveryError(
            f"Previous Notion page is not live, and no Pages deployment run "
            f"matches main SHA {sha[:12]}; refusing to retry unrelated deployments"
        )
    return max(candidates, key=lambda run: (run.get("created_at") or "", int(run["id"])))


def failed_deploy_job(api, repo: str, run: dict, token: str) -> int:
    data = api("GET", f"/repos/{repo}/actions/runs/{run['id']}/jobs?per_page=100", token)
    jobs = data.get("jobs", [])
    deploys = [
        job for job in jobs
        if job.get("name") == "deploy" and job.get("conclusion") == "failure"
    ]
    other_failures = [
        job for job in jobs
        if job.get("conclusion") == "failure" and job.get("name") != "deploy"
    ]
    if len(deploys) != 1 or other_failures:
        raise RecoveryError(
            f"Pages run {run['id']} did not fail exclusively in its deploy job; "
            "manual investigation is required"
        )
    return int(deploys[0]["id"])


def recover(
    root: Path,
    repo: str,
    sha: str,
    token: str,
    *,
    live_check=previous_release_is_live,
    api=request_api,
    sleep=time.sleep,
    monotonic=time.monotonic,
    wait_seconds: int = WAIT_SECONDS,
) -> dict:
    last = previous_notion_entry(root)
    if last is None:
        return {"status": "NO_PREVIOUS_NOTION_ARTICLE"}
    # Live check MUST happen before calling the GitHub API to avoid needless reruns.
    if live_check(root):
        return {"status": "ALREADY_LIVE", "url": last["url"]}
    if not token:
        raise RecoveryError("GITHUB_TOKEN missing; cannot safely recover Pages")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise RecoveryError("Current main commit SHA missing or invalid")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
        raise RecoveryError("GITHUB_REPOSITORY missing or invalid")

    run = latest_pages_run(api, repo, sha, token)
    started_retry = False
    deadline = monotonic() + max(0, wait_seconds)
    while True:
        # Content can become readable between the initial probe and a completed
        # run response. Recheck before refusing a successful/cancelled run.
        if live_check(root):
            status = "RECOVERED_LIVE" if started_retry else "BECAME_LIVE"
            return {"status": status, "url": last["url"], "pages_run_id": run["id"]}
        state = run.get("status")
        conclusion = run.get("conclusion")
        attempt = int(run.get("run_attempt") or 1)
        print(
            f"PAGES_RECOVERY_DETECTED: last_url={last['url']} "
            f"run={run['id']} status={state} conclusion={conclusion} attempt={attempt}",
            flush=True,
        )
        if not started_retry:
            if state == "completed" and conclusion == "failure":
                if attempt >= MAX_RUN_ATTEMPTS:
                    raise RecoveryError(
                        f"Pages run {run['id']} exhausted {MAX_RUN_ATTEMPTS} attempts; "
                        "manual intervention required"
                    )
                job_id = failed_deploy_job(api, repo, run, token)
                # Never redeploy a stale commit after another writer advances main.
                current = api("GET", f"/repos/{repo}/git/ref/heads/main", token)
                if current.get("object", {}).get("sha") != sha:
                    raise RecoveryError("Current main changed; refusing to retry a stale deployment")
                # At most ONE retry per invocation. An uncertain API response aborts
                # instead of making another POST. Global attempt cap is preserved.
                api("POST", f"/repos/{repo}/actions/jobs/{job_id}/rerun", token)
                started_retry = True
                print(f"PAGES_RECOVERY_RERUN_REQUESTED: run={run['id']} job={job_id}", flush=True)
            elif state in ("queued", "in_progress", "waiting", "requested", "pending"):
                print(f"PAGES_RECOVERY_DEPLOY_IN_PROGRESS: run={run['id']}", flush=True)
            else:
                raise RecoveryError(
                    f"Previous page still not live but Pages run {run['id']} is "
                    f"status={state} conclusion={conclusion}; not rerunning a successful/cancelled run"
                )
        # Keep the original exact published-title guard as the source of truth.
        if live_check(root):
            status = "RECOVERED_LIVE" if started_retry else "BECAME_LIVE"
            print(f"PAGES_RECOVERY_LIVE_VERIFIED: url={last['url']}", flush=True)
            return {"status": status, "url": last['url'], "pages_run_id": run['id']}
        remaining = deadline - monotonic()
        if remaining <= 0:
            break
        sleep(min(POLL_SECONDS, remaining))
        # Refresh even after the one allowed retry so diagnostics describe the
        # current attempt, not the failed attempt cached before the POST.
        # started_retry still prevents any additional retry in this invocation.
        run = api("GET", f"/repos/{repo}/actions/runs/{run['id']}", token)
        if run.get("head_sha") != sha or run.get("event") != "dynamic":
            raise RecoveryError("Pages run identity changed while waiting")
    raise RecoveryError(
        f"Previous article was not live after {wait_seconds}s of Pages recovery; "
        f"url={last['url']} run={run['id']}; publishing remains blocked"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sha", help="Exact merged main SHA (default: checkout HEAD)")
    parser.add_argument("--wait-seconds", type=int, default=WAIT_SECONDS)
    args = parser.parse_args()
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    sha = args.sha or subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    try:
        result = recover(ROOT, repo, sha, token, wait_seconds=args.wait_seconds)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except (RecoveryError, ValueError, OSError) as exc:
        print("PAGES_RECOVERY_FAILED: " + str(exc), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
