import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/gimje.html"

class GimjeCampingPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_search_answer(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("김제 캠핑장", "모악산 캠핑파크", "예약"):
            self.assertIn(phrase, combined)
        for name in ("대율저수지", "봄빛 글램핑"):
            self.assertIn(name, self.html)

    def test_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/camp/gimje.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterCamps", "function toggleFAQ", "2026-08-09"):
            self.assertIn(marker, self.html)
        self.assertEqual({x.get("@type") for x in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)

    def test_sources_and_corrections(self):
        official = [a for a in self.page.links if any(d in a.get("href", "") for d in ("gimje.go.kr", "gocamping.or.kr"))]
        self.assertGreaterEqual(len(official), 6)
        for phrase in ("무료 노지 캠핑", "심포항 무료 캠핑", "만경강 차박 명소", "새만금 방조제 무료 캠핑"):
            self.assertNotIn(phrase, self.html)

if __name__ == "__main__": unittest.main()
