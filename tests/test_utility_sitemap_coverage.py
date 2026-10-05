from html.parser import HTMLParser
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
TARGET_PAGES = {
    "https://emfls.github.io/kor/util/japan-travel-packing-checklist/": (
        ROOT / "kor/util/japan-travel-packing-checklist/index.html"
    ),
    "https://emfls.github.io/kor/util/japan-esim-data-calculator/": (
        ROOT / "kor/util/japan-esim-data-calculator/index.html"
    ),
    "https://emfls.github.io/kor/util/camping-packing-checklist/": (
        ROOT / "kor/util/camping-packing-checklist/index.html"
    ),
}


class PageMetadataParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.robots = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and "canonical" in attrs.get("rel", "").lower().split():
            self.canonicals.append(attrs.get("href", ""))
        if tag == "meta" and attrs.get("name", "").lower() == "robots":
            self.robots.append(attrs.get("content", ""))


class UtilitySitemapCoverageTests(unittest.TestCase):
    def test_three_utility_pages_are_indexable_canonicals_listed_once(self):
        sitemap_root = ET.parse(ROOT / "kor/sitemap.xml").getroot()
        sitemap_urls = [
            (node.text or "").strip()
            for node in sitemap_root.findall("sm:url/sm:loc", SITEMAP_NS)
        ]

        for canonical, page_path in TARGET_PAGES.items():
            with self.subTest(url=canonical):
                self.assertTrue(page_path.is_file(), f"missing page: {page_path}")

                metadata = PageMetadataParser()
                metadata.feed(page_path.read_text(encoding="utf-8"))
                self.assertEqual([canonical], metadata.canonicals)

                directives = {
                    directive.strip().lower()
                    for value in metadata.robots
                    for directive in value.split(",")
                }
                self.assertIn("index", directives)
                self.assertIn("follow", directives)
                self.assertNotIn("noindex", directives)

                self.assertEqual(1, sitemap_urls.count(canonical))
                self.assertNotIn(canonical + "index.html", sitemap_urls)

    def test_sitemap_xml_parses_and_root_index_references_korean_sitemap_once(self):
        root_index = ET.parse(ROOT / "sitemap.xml").getroot()
        korean_sitemap = "https://emfls.github.io/kor/sitemap.xml"
        references = [
            (node.text or "").strip()
            for node in root_index.findall("sm:sitemap/sm:loc", SITEMAP_NS)
        ]
        self.assertEqual(1, references.count(korean_sitemap))


if __name__ == "__main__":
    unittest.main()
