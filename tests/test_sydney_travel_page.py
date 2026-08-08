import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/travel/australia-sydney.html"

class SydneyTravelPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_search_intent(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("시드니 여행", "3박 4일", "ETA", "교통"):
            self.assertIn(phrase, combined)
        for phrase in ("오페라하우스", "본다이", "블루마운틴"):
            self.assertIn(phrase, self.html)

    def test_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/travel/australia-sydney.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterGuide", "function toggleFAQ", "2026-08-09"):
            self.assertIn(marker, self.html)
        self.assertEqual({x.get("@type") for x in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)

    def test_official_sources_and_stale_removal(self):
        official = [a for a in self.page.links if any(d in a.get("href", "") for d in ("australia.com", "transportnsw.info", "homeaffairs.gov.au"))]
        self.assertGreaterEqual(len(official), 6)
        for phrase in ("1 AUD = 850원", "하루 예산: 100-150 AUD", "ETA 처리시간: 24시간", "무료 와이파이가 모든 곳"):
            self.assertNotIn(phrase, self.html)

if __name__ == "__main__": unittest.main()
