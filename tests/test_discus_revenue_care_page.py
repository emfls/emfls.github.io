from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/animal/discus.html"


class DiscusParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.checks = 0
        self.links = []
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li" and "data-discus-check" in attrs:
            self.checks += 1
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


class DiscusRevenueCarePageTest(unittest.TestCase):
    def setUp(self):
        self.html = PAGE.read_text(encoding="utf-8")
        self.parser = DiscusParser()
        self.parser.feed(self.html)

    def test_prioritizes_water_quality_before_treatment(self):
        self.assertGreaterEqual(self.parser.checks, 6)
        self.assertIn("암모니아·아질산 0", self.html)
        self.assertIn("진단 없이 수온을 일률적으로 올리거나 약을 투입하지 않습니다", self.html)
        self.assertNotIn("전문가가 알려주는 모든 정보", self.html)
        self.assertNotIn("먼저 수온을 30도로 올리고", self.html)

    def test_links_sources_and_related_aquarium_guides(self):
        for link in (
            "https://ornamentalfish.org/what-we-do/advice-information/care-sheets/caresheets-tropical-freshwater-fish/how-to-look-after-discus/",
            "https://www.merckvetmanual.com/exotic-and-laboratory-animals/aquarium-fish/management-of-aquarium-fish",
            "/kor/report/animal/",
            "/kor/report/animal/rummynosetetra.html",
            "/kor/report/animal/medaka.html",
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
