import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

from scripts.sitemap_audit import audit_local_sitemaps, render_root_index


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

    def test_ignores_sitemaps_inside_isolated_worktrees(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "sitemap.xml").write_text(
                '<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>',
                encoding="utf-8",
            )
            isolated = root / ".worktrees" / "feature"
            isolated.mkdir(parents=True)
            (isolated / "sitemap.xml").write_text(
                '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
                encoding="utf-8",
            )

            result = audit_local_sitemaps(root)

            self.assertEqual(result["sitemap_files"], 1)
            self.assertNotIn("/.worktrees/feature/sitemap.xml", render_root_index(root))

    def test_directory_hubs_use_canonical_slash_urls(self):
        root = Path(__file__).resolve().parents[1]
        namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        index_entries = []
        for sitemap in root.rglob("sitemap.xml"):
            xml_root = ET.parse(sitemap).getroot()
            if xml_root.tag.rsplit("}", 1)[-1] != "urlset":
                continue
            index_entries.extend(
                (loc.text or "").strip()
                for loc in xml_root.findall("sm:url/sm:loc", namespace)
                if (loc.text or "").strip().endswith("/index.html")
            )
        self.assertEqual(index_entries, [])


if __name__ == "__main__":
    unittest.main()
