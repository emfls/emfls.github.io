from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/animal/medaka.html"


class MedakaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.setup_checks = 0
        self.links = []
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li" and "data-medaka-setup" in attrs:
            self.setup_checks += 1
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


class MedakaRevenueCarePageTest(unittest.TestCase):
    def setUp(self):
        self.html = PAGE.read_text(encoding="utf-8")
        self.parser = MedakaParser()
        self.parser.feed(self.html)

    def test_prioritizes_safe_new_tank_setup(self):
        self.assertGreaterEqual(self.parser.setup_checks, 6)
        self.assertIn("암모니아·아질산 0", self.html)
        self.assertIn("부분 환수", self.html)
        self.assertNotIn("작은 물병에서도 사육이 가능", self.html)
        self.assertNotIn("전문가가 알려주는", self.html)

    def test_links_sources_and_related_aquarium_guides(self):
        for link in (
            "https://ornamentalfish.org/what-we-do/advice-information/care-sheets/caresheets-tropical-freshwater-fish/how-to-set-up-and-look-after-a-freshwater-tank-aquarium/",
            "https://www.env.go.jp/content/900408798.pdf",
            "/kor/report/animal/",
            "/kor/report/animal/rummynosetetra.html",
            "/kor/report/animal/betta.html",
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
