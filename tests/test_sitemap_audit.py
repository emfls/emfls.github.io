import tempfile
import unittest
from pathlib import Path

from scripts.sitemap_audit import audit_local_sitemaps


class SitemapAuditTests(unittest.TestCase):
    def test_reports_leaf_sitemaps_missing_from_root_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "sitemap.xml").write_text(
                '<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                '<sitemap><loc>https://emfls.github.io/a/sitemap.xml</loc></sitemap></sitemapindex>', encoding="utf-8")
            for name in ("a", "b"):
                (root / name).mkdir()
                (root / name / "sitemap.xml").write_text(
                    '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                    f'<url><loc>https://emfls.github.io/{name}/</loc></url></urlset>', encoding="utf-8")
            result = audit_local_sitemaps(root)
        self.assertEqual(result["leaf_sitemaps"], 2)
        self.assertEqual(result["indexed_sitemaps"], 1)
        self.assertEqual(result["leaf_sitemap_paths"], ["/a/sitemap.xml", "/b/sitemap.xml"])
        self.assertEqual(result["omitted_from_root"], ["/b/sitemap.xml"])
        self.assertEqual(result["invalid_xml"], [])

    def test_current_root_index_references_every_leaf_sitemap(self):
        root = Path(__file__).resolve().parents[1]
        result = audit_local_sitemaps(root)
        self.assertEqual(result["omitted_from_root"], [])


if __name__ == "__main__":
    unittest.main()
