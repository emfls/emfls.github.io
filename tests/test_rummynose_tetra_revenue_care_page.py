from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/animal/rummynosetetra.html"


class RummynoseParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.care_checks = 0
        self.links = []
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li" and "data-rummynose-check" in attrs:
            self.care_checks += 1
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json_ld = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json_ld = False

    def handle_data(self, data):
        if self.in_json_ld and data.strip():
            self.json_ld.append(json.loads(data))


class RummynoseRevenueCarePageTest(unittest.TestCase):
    def setUp(self):
        self.html = PAGE.read_text(encoding="utf-8")
        self.parser = RummynoseParser()
        self.parser.feed(self.html)

    def test_prioritizes_safe_acclimation_and_water_checks(self):
        self.assertGreaterEqual(self.parser.care_checks, 6)
        self.assertIn("암모니아·아질산 0", self.html)
        self.assertIn("수질 검사 도구를 대신하지 않습니다", self.html)
        self.assertNotIn("전문가가 알려주는", self.html)
        self.assertNotIn("수질 상태를 나타내는 살아있는 지표", self.html)

    def test_links_sources_and_related_aquarium_guides(self):
        for link in (
            "https://ornamentalfish.org/wp-content/uploads/How-to-understand-test-water-quality-in-freshwater-aquariums1.pdf",
            "https://fishbase.se/summary/12365",
            "/kor/report/animal/",
            "/kor/report/animal/medaka.html",
            "/kor/report/animal/discus.html",
        ):
            self.assertIn(link, self.parser.links)
        self.assertTrue(
            any(
                item.get("@type") == "Article"
                and item.get("dateModified") == "2026-08-24"
                for item in self.parser.json_ld
            )
        )


if __name__ == "__main__":
    unittest.main()
