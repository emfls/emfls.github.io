import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/travel/austria-bludenz.html"

class BludenzTravelPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_search_intent(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("블루덴츠 여행", "뤼너제", "교통", "한국 여권"):
            self.assertIn(phrase, combined)
        for phrase in ("브란트너탈", "무터스베르크", "90일"):
            self.assertIn(phrase, self.html)

    def test_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/travel/austria-bludenz.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterGuide", "function toggleFAQ", "2026-08-09"):
            self.assertIn(marker, self.html)
        self.assertEqual({x.get("@type") for x in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)

    def test_sources(self):
        official = [a for a in self.page.links if any(d in a.get("href", "") for d in ("bludenz.travel", "brandnertal.at", "vorarlberg.travel", "oebb.at", "bmeia.gv.at"))]
        self.assertGreaterEqual(len(official), 7)
        for phrase in ("1 EUR = 1,450원", "케이블카 왕복 €20", "기차 2시간 30분 고정", "ETIAS 필수"):
            self.assertNotIn(phrase, self.html)

if __name__ == "__main__": unittest.main()
