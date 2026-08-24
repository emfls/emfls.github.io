from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/animal/betta.html"


class BettaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.checks = 0
        self.links = []
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li" and "data-betta-check" in attrs:
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


class BettaRevenueCarePageTest(unittest.TestCase):
    def setUp(self):
        self.html = PAGE.read_text(encoding="utf-8")
        self.parser = BettaParser()
        self.parser.feed(self.html)

    def test_prioritizes_filtered_tank_and_safe_stocking(self):
        self.assertGreaterEqual(self.parser.checks, 6)
        self.assertIn("암모니아·아질산 0", self.html)
        self.assertIn("공기호흡 능력은 작은 컵 사육의 근거가 아닙니다", self.html)
        self.assertIn("격리할 예비 수조", self.html)
        self.assertIn("암컷끼리도 공격", self.html)
        self.assertNotIn("전문가가 알려주는 모든 정보", self.html)
        self.assertNotIn("자주 환수를 해준다면 여과기가 없어도 되지만", self.html)

    def test_links_source_and_related_aquarium_guides(self):
        for link in (
            "https://ornamentalfish.org/what-we-do/advice-information/care-sheets/caresheets-tropical-freshwater-fish/how-to-look-after-siamese-fighting-fish-bettas/",
            "/kor/report/animal/",
            "/kor/report/animal/rummynosetetra.html",
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
