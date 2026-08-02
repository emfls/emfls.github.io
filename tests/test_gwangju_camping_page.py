import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/gwangju.html"

class GwangjuCampingPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_answers_booking_intent(self):
        for phrase in ("광주 캠핑장", "공식", "예약"):
            self.assertIn(phrase, cls_text(self.page))
        for name in ("시민의숲", "승촌보", "휴파크", "패밀리랜드"):
            self.assertIn(name, self.html)

    def test_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/camp/gwangju.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterCamps", "function toggleFAQ", "2026-08-02"):
            self.assertIn(marker, self.html)
        self.assertEqual({x.get("@type") for x in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)
        self.assertIn("max-width:100% !important", self.html)

    def test_official_sources(self):
        official = [a for a in self.page.links if any(d in a.get("href", "") for d in ("gwangju.go.kr", "gocamping.or.kr"))]
        self.assertGreaterEqual(len(official), 6)

    def test_removes_unsupported_claims(self):
        for phrase in ("무료 노지 캠핑장", "무등산 국립공원 차박", "곡성 압록유원지 캠핑", "나주 드들강 캠핑", "무안 홀통해수욕장 차박"):
            self.assertNotIn(phrase, self.html)

def cls_text(page):
    return page.title + page.h1 + page.meta["description"]

if __name__ == "__main__": unittest.main()
