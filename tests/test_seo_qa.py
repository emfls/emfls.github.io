import tempfile
import unittest
from datetime import date
from pathlib import Path

from scripts.seo_qa import collect_issues, compare_baseline


def page(path="a.html", **overrides):
    value = {
        "path": path,
        "url": "/" + path,
        "title": "Title",
        "description": "Description",
        "canonical": "https://emfls.github.io/" + path,
        "h1_count": 1,
        "published_date": "2026-01-01",
        "updated_date": "2026-01-02",
    }
    value.update(overrides)
    return value


class SeoQaTests(unittest.TestCase):
    def test_collects_required_metadata_h1_and_future_date_issues(self):
        audit = {"pages": [page(title="", description="", canonical="", h1_count=2, updated_date="2026-09-01")]}
        with tempfile.TemporaryDirectory() as tmp:
            issues = collect_issues(audit, [], Path(tmp), today=date(2026, 8, 20))
        kinds = {item["kind"] for item in issues["critical"]}
        self.assertEqual(kinds, {"missing_title", "missing_description", "missing_canonical", "h1_not_one", "future_date"})

    def test_existing_baseline_is_allowed_but_new_critical_issue_fails(self):
        baseline = {"critical": ["missing_title:a.html"], "warnings": []}
        current = {
            "critical": [
                {"id": "missing_title:a.html", "kind": "missing_title"},
                {"id": "missing_description:b.html", "kind": "missing_description"},
            ],
            "warnings": [],
        }
        result = compare_baseline(current, baseline)
        self.assertEqual([item["id"] for item in result["new_critical"]], ["missing_description:b.html"])
        self.assertTrue(result["failed"])

    def test_duplicate_titles_are_warnings(self):
        audit = {"pages": [page("a.html", title="Same"), page("b.html", title="Same")]}
        with tempfile.TemporaryDirectory() as tmp:
            issues = collect_issues(audit, [], Path(tmp), today=date(2026, 8, 20))
        self.assertIn("duplicate_title", {item["kind"] for item in issues["warnings"]})

    def test_retired_domain_and_embedded_secret_cannot_be_baselined(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "generator.py").write_text(
                'SITE_URL = "https://emfls.com"\nTOKEN = "github_pat_' + 'A' * 30 + '"\n',
                encoding="utf-8",
            )
            issues = collect_issues({"pages": [page()]}, [], root, today=date(2026, 8, 20))
        baseline = {"critical": [item["id"] for item in issues["critical"]], "warnings": []}
        result = compare_baseline(issues, baseline)
        self.assertEqual(
            {item["kind"] for item in result["new_critical"]},
            {"retired_domain", "embedded_secret"},
        )

    def test_broken_internal_links_are_critical(self):
        broken = [{"source": "/a", "target": "/missing"}]
        with tempfile.TemporaryDirectory() as tmp:
            issues = collect_issues({"pages": [page()]}, broken, Path(tmp), today=date(2026, 8, 20))
        self.assertEqual(issues["critical"][0]["id"], "broken_internal_link:/a->/missing")


if __name__ == "__main__":
    unittest.main()
