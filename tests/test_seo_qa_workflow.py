import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/seo-qa.yml"


class SeoQaWorkflowTests(unittest.TestCase):
    def test_workflow_runs_audit_gate_and_full_tests_without_rewriting_baseline(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("scripts/seo_audit.py", source)
        self.assertIn("scripts/seo_qa.py", source)
        self.assertIn("scripts/quality_audit.py", source)
        self.assertIn("/tmp/site-quality-dashboard.html", source)
        self.assertIn("SITE_SCORE.md", source)
        self.assertIn("python3 -m unittest discover -s tests -q", source)
        self.assertIn("python3 -m pytest -q", source)
        self.assertIn("pip install pytest requests", source)
        self.assertNotIn("--write-baseline", source)

    def test_workflow_has_read_only_repository_permissions(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("permissions:\n  contents: read", source)

    def test_workflow_uses_the_sites_korean_operating_date(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("TZ: Asia/Seoul", source)

    def test_workflow_generates_revenue_opportunities_before_final_dashboard_and_tests(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        audit = source.index("scripts/seo_audit.py")
        quality = source.index("scripts/quality_audit.py")
        revenue = source.index("scripts/revenue_growth.py")
        dashboard = source.rindex("scripts/quality_audit.py")
        tests = source.index("python3 -m unittest discover")

        self.assertLess(audit, quality)
        self.assertLess(quality, revenue)
        self.assertLess(revenue, dashboard)
        self.assertLess(dashboard, tests)
        self.assertIn("data/revenue-opportunities.json", source)
        self.assertIn("reports/revenue-growth-report.md", source)

    def test_workflow_validates_daily_launch_without_cron_or_write_permission(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        revenue = source.index("scripts/revenue_growth.py")
        daily = source.index("scripts/daily_revenue_growth.py")
        guard = source.index("scripts/content_launch_guard.py")
        dashboard = source.rindex("scripts/quality_audit.py")
        tests = source.index("python3 -m unittest discover")
        self.assertLess(revenue, daily)
        self.assertLess(daily, guard)
        self.assertLess(guard, dashboard)
        self.assertLess(dashboard, tests)
        self.assertNotIn("schedule:", source)
        self.assertIn("permissions:\n  contents: read", source)
        self.assertNotIn("git push", source)

    def test_push_guard_fetches_event_before_commit_in_shallow_checkout(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        push_branch = source.index('COMPARE_REF="$EVENT_BEFORE"')
        fetch_before = source.index('git fetch origin "$EVENT_BEFORE" --depth=1')
        guard = source.index("scripts/content_launch_guard.py")
        self.assertLess(fetch_before, push_branch)
        self.assertLess(push_branch, guard)


if __name__ == "__main__":
    unittest.main()
