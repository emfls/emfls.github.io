from html.parser import HTMLParser
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/animal/index.html"


class AnimalHubParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_priority = False
        self.priority_links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "section" and attrs.get("data-animal-priority") == "aquarium-care":
            self.in_priority = True
        if self.in_priority and tag == "a" and attrs.get("href"):
            self.priority_links.append(attrs["href"])

    def handle_endtag(self, tag):
        if tag == "section" and self.in_priority:
            self.in_priority = False


class AnimalHubRevenueRoutingTest(unittest.TestCase):
    def setUp(self):
        self.html = PAGE.read_text(encoding="utf-8")
        self.parser = AnimalHubParser()
        self.parser.feed(self.html)

    def test_routes_visitors_to_reviewed_aquarium_guides(self):
        self.assertEqual(
            self.parser.priority_links,
            ["betta.html", "discus.html", "rummynosetetra.html", "medaka.html"],
        )
        self.assertIn("입수 전 준비와 수질 점검부터 확인하세요", self.html)

    def test_removes_stale_titles_and_irrelevant_disclaimer(self):
        for title in (
            "베타 키우기 2026 | 수조·여과·먹이·합사 점검",
            "디스커스 키우기 2026 | 입수 준비·수질·이상 징후 점검",
            "러미노즈테트라 키우기 2026 | 군영·입수 적응·수질 점검",
            "메다카 키우기 2026 | 물잡이·수조·입수 점검",
        ):
            self.assertIn(title, self.html)
        self.assertNotIn("투자 권유가 아닙니다", self.html)


if __name__ == "__main__":
    unittest.main()
