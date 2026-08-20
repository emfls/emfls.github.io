import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/seo-qa.yml"


class SeoQaWorkflowTests(unittest.TestCase):
    def test_workflow_runs_audit_gate_and_full_tests_without_rewriting_baseline(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("scripts/seo_audit.py", source)
        self.assertIn("scripts/seo_qa.py", source)
        self.assertIn("python3 -m unittest discover -s tests -q", source)
        self.assertIn("python3 -m pytest -q", source)
        self.assertIn("pip install pytest requests", source)
        self.assertNotIn("--write-baseline", source)

    def test_workflow_has_read_only_repository_permissions(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("permissions:\n  contents: read", source)


if __name__ == "__main__":
    unittest.main()
