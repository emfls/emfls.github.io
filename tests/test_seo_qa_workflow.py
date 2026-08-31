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


if __name__ == "__main__":
    unittest.main()
