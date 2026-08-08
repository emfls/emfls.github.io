import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/bucheon.html"

class BucheonCampingPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_current_answer(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("부천 캠핑장", "야인시대 캠핑장", "폐쇄"):
            self.assertIn(phrase, combined)
        self.assertIn("현재 예약할 수 없습니다", self.html)

    def test_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/camp/bucheon.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterOptions", "function toggleFAQ", "2026-08-09"):
            self.assertIn(marker, self.html)
        self.assertEqual({x.get("@type") for x in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)

    def test_sources_and_stale_removal(self):
        official = [a for a in self.page.links if any(d in a.get("href", "") for d in ("bucheon.go.kr", "gocamping.or.kr"))]
        self.assertGreaterEqual(len(official), 6)
        for phrase in ("여월농업공원 캠핑장 예약", "야인시대 캠핑장 15,000원", "중앙공원 무료 캠핑", "굴포천 차박"):
            self.assertNotIn(phrase, self.html)

if __name__ == "__main__": unittest.main()
