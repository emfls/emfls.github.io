import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/goheung.html"

class GoheungCampingPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_booking_answer(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("고흥 캠핑장", "예약", "공식"):
            self.assertIn(phrase, combined)
        for name in ("고흥만", "해창만", "팔영산", "거금락"):
            self.assertIn(name, self.html)

    def test_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/camp/goheung.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterCamps", "function toggleFAQ", "2026-08-12"):
            self.assertIn(marker, self.html)
        self.assertEqual({x.get("@type") for x in self.page.json_ld}, {"WebPage", "FAQPage", "Article", "BreadcrumbList"})
        self.assertIn('div[id^="aswift_"]', self.html)

    def test_sources_and_corrections(self):
        official = [a for a in self.page.links if any(d in a.get("href", "") for d in ("goheung.go.kr", "gocamping.or.kr"))]
        self.assertGreaterEqual(len(official), 7)
        for phrase in ("무료 노지 캠핑장", "녹동항 차박", "고흥만 방조제 캠핑", "나로우주해수욕장 캠핑", "익금해변 캠핑"):
            self.assertNotIn(phrase, self.html)

if __name__ == "__main__": unittest.main()
