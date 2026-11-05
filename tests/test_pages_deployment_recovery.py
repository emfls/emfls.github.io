"""Fail-closed regression coverage for automated GitHub Pages recovery."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import importlib.util
import json
import sys
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location(
    "recover_pages_deployment", SCRIPTS / "recover_pages_deployment.py")
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)

SHA = "a" * 40
REPO = "emfls/emfls.github.io"
TARGET = "https://emfls.github.io/kor/report/it/test-article-2026.html"


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.root = Path(self.dir.name)
        (self.root / "data").mkdir()
        self.ledger = self.root / "data/scheduled-publication-ledger.jsonl"
        self.ledger.write_text(
            json.dumps({"notionPageId": "page-1", "url": TARGET, "title": "Test article",
                        "slotKst": "2026-11-05T09:30:00+09:00"}) + "\n",
            encoding="utf-8")
        self.api_calls = []
        self.posts = 0
        self.run = {
            "id": 700, "name": "pages build and deployment", "head_sha": SHA,
            "event": "dynamic", "status": "completed", "conclusion": "failure",
            "run_attempt": 1, "created_at": "2026-11-05T00:31:00Z",
        }
        self.jobs = {"jobs": [
            {"id": 11, "name": "build", "conclusion": "success"},
            {"id": 12, "name": "deploy", "conclusion": "failure"},
        ]}

    def api(self, method, path, token):
        self.api_calls.append((method, path))
        self.assertEqual(token, "dummy")
        if method == "GET" and path.endswith("/actions/runs?per_page=100"):
            return {"workflow_runs": [self.run]}
        if method == "GET" and path.endswith("/jobs?per_page=100"):
            return self.jobs
        if method == "POST" and path.endswith("/actions/jobs/12/rerun"):
            self.posts += 1
            return {}
        raise AssertionError((method, path))

    def call(self, live_check, **opts):
        return recovery.recover(
            self.root, REPO, SHA, "dummy", api=self.api,
            live_check=live_check, sleep=lambda t: None,
            monotonic=lambda: 0, wait_seconds=0, **opts)

    def test_live_page_never_touches_actions_api(self):
        result = self.call(lambda root: True)
        self.assertEqual(result["status"], "ALREADY_LIVE")
        self.assertEqual(self.api_calls, [])
        self.assertEqual(self.posts, 0)

    def test_failed_deploy_only_is_rerun_then_page_is_verified(self):
        checks = 0
        def live_check(root):
            nonlocal checks
            checks += 1
            return self.posts > 0
        result = self.call(live_check)
        self.assertEqual(result["status"], "RECOVERED_LIVE")
        self.assertEqual(self.posts, 1)
        self.assertEqual(result["pages_run_id"], 700)

    def test_retry_cap_blocks_infinite_retries(self):
        self.run["run_attempt"] = recovery.MAX_RUN_ATTEMPTS
        with self.assertRaisesRegex(recovery.RecoveryError, "exhausted"):
            self.call(lambda root: False)
        self.assertEqual(self.posts, 0)

    def test_different_commit_cannot_be_retried(self):
        self.run["head_sha"] = "b" * 40
        with self.assertRaisesRegex(recovery.RecoveryError, "matches main SHA"):
            self.call(lambda root: False)
        self.assertEqual(self.posts, 0)

    def test_failed_non_deploy_job_cannot_be_rerun(self):
        self.jobs["jobs"][0]["conclusion"] = "failure"
        with self.assertRaisesRegex(recovery.RecoveryError, "exclusively"):
            self.call(lambda root: False)
        self.assertEqual(self.posts, 0)

    def test_in_progress_pages_run_is_never_retried(self):
        self.run.update({"status": "in_progress", "conclusion": None})
        checked = 0
        def live_check(root):
            nonlocal checked
            checked += 1
            return checked >= 2
        result = self.call(live_check)
        self.assertEqual(result["status"], "BECAME_LIVE")
        self.assertEqual(self.posts, 0)

    def test_successful_but_not_live_run_is_not_rerun(self):
        self.run["conclusion"] = "success"
        with self.assertRaisesRegex(recovery.RecoveryError, "not rerunning"):
            self.call(lambda root: False)
        self.assertEqual(self.posts, 0)

    def test_missing_live_page_remains_blocked_after_retry(self):
        with self.assertRaisesRegex(recovery.RecoveryError, "publishing remains blocked"):
            self.call(lambda root: False)
        self.assertEqual(self.posts, 1)

    def test_no_history_requires_no_api(self):
        self.ledger.unlink()
        result = self.call(lambda root: False)
        self.assertEqual(result["status"], "NO_PREVIOUS_NOTION_ARTICLE")
        self.assertEqual(self.api_calls, [])


if __name__ == "__main__":
    unittest.main()
