from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/travel/korean-souvenir-foreigners-2026.html"


class SouvenirParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = 0
        self.shopping_guide = False
        self.links = []
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li" and "data-souvenir-item" in attrs:
            self.items += 1
        if tag == "section" and attrs.get("data-shopping-guide") == "souvenir":
            self.shopping_guide = True
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


class KoreanSouvenirRevenuePageTest(unittest.TestCase):
    def setUp(self):
        self.html = PAGE.read_text(encoding="utf-8")
        self.parser = SouvenirParser()
        self.parser.feed(self.html)

    def test_replaces_empty_price_ranking_with_nineteen_useful_items(self):
        self.assertEqual(19, self.parser.items)
        self.assertNotIn("rank-price", self.html)
        self.assertNotIn("쿠팡 인기 순위", self.html)

    def test_exposes_purchase_checks_sources_and_related_routes(self):
        self.assertTrue(self.parser.shopping_guide)
        for link in (
            "https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=142699",
            "https://english.visitkorea.or.kr/svc/contents/contentsView.do?menuSn=929&vcontsId=248765",
            "/kor/report/travel/",
            "/kor/report/travel/weekend-travel-korea-2026.html",
            "/kor/report/travel/%EA%B7%BC%EC%B2%98-%EB%A7%9B%EC%A7%91-%EC%B6%94%EC%B2%9C.html",
        ):
            self.assertIn(link, self.parser.links)
        self.assertTrue(
            any(item.get("dateModified") == "2026-08-24" for item in self.parser.json_ld)
        )


if __name__ == "__main__":
    unittest.main()
