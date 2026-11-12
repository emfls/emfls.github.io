"""Fail-closed regression coverage for automated GitHub Pages recovery."""
from __future__ import annotations

from datetime import datetime
from contextlib import redirect_stdout
import io
import re
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
        self.current_sha = SHA
        self.run_reads = 0
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
        if method == "GET" and path.endswith("/git/ref/heads/main"):
            return {"object": {"sha": self.current_sha}}
        if method == "GET" and path.endswith("/actions/runs/700"):
            self.run_reads += 1
            return dict(self.run)
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

    def test_pending_deployment_that_fails_can_be_retried_in_same_invocation(self):
        self.run.update({"status": "in_progress", "conclusion": None})
        now = [0]
        def sleep(seconds):
            now[0] += seconds
            self.run.update({"status": "completed", "conclusion": "failure"})
        result = recovery.recover(
            self.root, REPO, SHA, "dummy", api=self.api,
            live_check=lambda root: self.posts > 0, sleep=sleep,
            monotonic=lambda: now[0], wait_seconds=40)
        self.assertEqual(result["status"], "RECOVERED_LIVE")
        self.assertEqual(self.posts, 1)

    def test_page_became_live_while_success_response_arrived(self):
        self.run["conclusion"] = "success"
        checks = 0
        def live_check(root):
            nonlocal checks
            checks += 1
            return checks > 1
        result = self.call(live_check)
        self.assertEqual(result["status"], "BECAME_LIVE")
        self.assertEqual(self.posts, 0)

    def test_changed_main_blocks_deployment_retry(self):
        self.current_sha = "b" * 40
        with self.assertRaisesRegex(recovery.RecoveryError, "main changed"):
            self.call(lambda root: False)
        self.assertEqual(self.posts, 0)

    def test_retry_is_not_repeated_within_one_invocation(self):
        now = [0]
        def sleep(seconds):
            now[0] += seconds
        with self.assertRaisesRegex(recovery.RecoveryError, "publishing remains blocked"):
            recovery.recover(
                self.root, REPO, SHA, "dummy", api=self.api,
                live_check=lambda root: False, sleep=sleep,
                monotonic=lambda: now[0], wait_seconds=40)
        self.assertEqual(self.posts, 1)

    def test_retry_request_uncertain_failure_is_not_repeated(self):
        def api(method, path, token):
            value = self.api(method, path, token)
            if method == "POST":
                raise recovery.RecoveryError("request outcome unknown")
            return value
        with self.assertRaisesRegex(recovery.RecoveryError, "outcome unknown"):
            recovery.recover(self.root, REPO, SHA, "dummy", api=api,
                             live_check=lambda root: False)
        self.assertEqual(self.posts, 1)

    def test_current_release_budget_covers_initial_tail_and_full_retry(self):
        workflow = (SCRIPTS.parent / ".github/workflows/notion-two-hour-publisher.yml").read_text()
        fallback = workflow.split('name: Recover current Pages deployment', 1)[1].split('name: Mark Notion', 1)[0]
        setting = re.search(r'--wait-seconds (\d+)', fallback)
        self.assertIsNotNone(setting, 'Current-release recovery needs an explicit bounded total budget')
        budget = int(setting.group(1))
        self.assertEqual(budget, 900)
        now = [0]
        self.run.update({"status": "in_progress", "conclusion": None})
        def sleep(seconds):
            now[0] += seconds
            if self.posts:
                self.run.update({"status": "in_progress", "conclusion": None, "run_attempt": 2})
            elif now[0] >= 100:
                self.run.update({"status": "completed", "conclusion": "failure"})
        # First deployment fails 100s into recovery; retry takes another 620s.
        # The old 660s total deadline ended before this valid retry could finish.
        result = recovery.recover(
            self.root, REPO, SHA, "dummy", api=self.api,
            live_check=lambda root: now[0] >= 720, sleep=sleep,
            monotonic=lambda: now[0], wait_seconds=budget)
        self.assertEqual(result["status"], "RECOVERED_LIVE")
        self.assertEqual(self.posts, 1)
        self.assertLessEqual(now[0], budget)

    def test_retry_status_is_refreshed_without_another_retry(self):
        now = [0]
        def sleep(seconds):
            now[0] += seconds
            self.run.update({"status": "in_progress", "conclusion": None, "run_attempt": 2})
        captured = io.StringIO()
        with redirect_stdout(captured):
            with self.assertRaisesRegex(recovery.RecoveryError, "publishing remains blocked"):
                recovery.recover(
                    self.root, REPO, SHA, "dummy", api=self.api,
                    live_check=lambda root: False, sleep=sleep,
                    monotonic=lambda: now[0], wait_seconds=40)
        self.assertGreater(self.run_reads, 0)
        self.assertIn('status=in_progress conclusion=None attempt=2', captured.getvalue())
        self.assertEqual(self.posts, 1)

    def test_publisher_runs_qa_before_merge_and_recovery_before_finalization(self):
        workflow = (SCRIPTS.parent / ".github/workflows/notion-two-hour-publisher.yml").read_text()
        qa = workflow.index('python3 scripts/run_notion_discovery_qa.py --destination')
        merge = workflow.index('gh pr merge')
        verify = workflow.index('id: verify')
        recover = workflow.index('name: Recover current Pages deployment')
        finalize = workflow.index('name: Mark Notion item published')
        self.assertLess(qa, merge)
        self.assertLess(merge, verify)
        self.assertLess(verify, recover)
        self.assertIn('deadline=time.monotonic()+600', workflow[verify:recover])
        self.assertIn('timeout=min(15,remaining)', workflow[verify:recover])
        self.assertLess(recover, finalize)
        self.assertIn("steps.verify.outcome == 'failure'", workflow[recover:finalize])
        self.assertIn('git fetch --no-tags origin main', workflow[recover:finalize])
        self.assertIn('--sha "$(git rev-parse origin/main)"', workflow[recover:finalize])
        self.assertNotIn('continue-on-error', workflow[recover:finalize])

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
