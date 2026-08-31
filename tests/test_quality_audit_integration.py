import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts.quality_audit import run_quality_audit


def page(url, path, indexable=True):
    return {
        "path": path,
        "url": url,
        "title": "Useful Example",
        "description": "A unique useful example description.",
        "language": "en",
        "category": "report",
        "published_date": "2026-01-01",
        "updated_date": "2026-08-01",
        "word_count": 900,
        "h1_count": 1,
        "h2_count": 3,
        "h3_count": 1,
        "internal_links": 1,
        "internal_link_targets": ["/a.html"],
        "external_links": 1,
        "images": 0,
        "image_alt_missing": 0,
        "has_viewport": True,
        "has_table": False,
        "has_table_overflow": False,
        "has_form": False,
        "has_breadcrumb": True,
        "has_related_section": True,
        "has_author_signal": True,
        "has_method_signal": True,
        "has_limitation_signal": True,
        "has_about_methodology_link": True,
        "has_parent_hub_link": True,
        "has_intrusive_popup": False,
        "interactive_controls": 0,
        "visible_text_prefix": "Useful immediate answer with 2026 examples and enough introductory words for the visitor to act.",
        "structured_data_types": ["Article"],
        "canonical": "https://emfls.github.io" + url,
        "indexable": indexable,
        "adsense": True,
        "ga4": True,
        "parse_warnings": [],
    }


class QualityAuditIntegrationTest(unittest.TestCase):
    def test_script_entrypoint_can_load_its_scoring_modules(self):
        root = Path(__file__).resolve().parents[1]
        result = subprocess.run(
            [sys.executable, "scripts/quality_audit.py", "--help"],
            cwd=root,
            text=True,
            capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_writes_every_indexable_page_once_and_is_deterministic(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            audit_path = root / "site-audit.json"
            metadata_path = root / "content-metadata.json"
            performance_dir = root / "performance"
            performance_dir.mkdir()
            cannibalization_path = root / "cannibalization.json"
            page_output = root / "page-scores.json"
            site_output = root / "site-score.json"
            report_output = root / "SITE_SCORE.md"
            dashboard_output = root / "site-quality-dashboard.html"
            audit_path.write_text(
                json.dumps({"summary": {}, "parser_errors": [], "pages": [page("/tool/", "util/tool/index.html"), page("/a.html", "report/a.html"), page("/private.html", "private.html", False)]}),
                encoding="utf-8",
            )
            metadata_path.write_text("[]", encoding="utf-8")
            cannibalization_path.write_text('{"candidate_groups": []}', encoding="utf-8")
            (performance_dir / "2026-08-01.json").write_text(
                json.dumps({"periods": {"gsc": {"start": "2026-07-01", "end": "2026-07-29"}, "ga4": {"start": "2026-07-01", "end": "2026-07-29"}}, "pages": [], "adsense": None}),
                encoding="utf-8",
            )
            (root / "sitemap.xml").write_text(
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://emfls.github.io/a.html</loc></url><url><loc>https://emfls.github.io/tool/</loc></url></urlset>',
                encoding="utf-8",
            )
            (root / "robots.txt").write_text("User-agent: *\nAllow: /\n", encoding="utf-8")

            kwargs = dict(
                root=root,
                audit_path=audit_path,
                metadata_path=metadata_path,
                performance_dir=performance_dir,
                cannibalization_path=cannibalization_path,
                as_of="2026-08-31",
                page_output=page_output,
                site_output=site_output,
                report_output=report_output,
                dashboard_output=dashboard_output,
            )
            _, site = run_quality_audit(**kwargs)
            first_bytes = page_output.read_bytes()
            run_quality_audit(**kwargs)

            self.assertEqual(page_output.read_bytes(), first_bytes)
            payload = json.loads(first_bytes)
            self.assertEqual([row["url"] for row in payload["pages"]], ["/a.html", "/tool/"])
            self.assertEqual(payload["summary"]["evaluated_indexable_pages"], 2)
            self.assertEqual(payload["schema_version"], 1)
            self.assertNotIn("checks", payload["pages"][0]["scores"]["seo"])
            self.assertIn("evidence", payload["pages"][0]["scores"]["seo"])
            self.assertEqual(site["connections"]["gsc"], "STALE_DATA")
            self.assertEqual(site["connections"]["ga4"], "STALE_DATA")
            self.assertIn("현재 SITE SCORE", report_output.read_text(encoding="utf-8"))
            self.assertIn("로컬 전용", dashboard_output.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
