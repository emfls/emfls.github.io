import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/rwanda.html"

class RwandaVisaPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_answers_korean_passport_intent(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("르완다 비자", "한국 여권", "도착비자"):
            self.assertIn(phrase, combined)
        self.assertIn("사전 신청 없이", self.html)

    def test_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/visa/rwanda.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterVisas", "function toggleFAQ", "2026-08-13"):
            self.assertIn(marker, self.html)
        self.assertEqual({x.get("@type") for x in self.page.json_ld}, {"WebPage", "FAQPage", "Article", "BreadcrumbList"})
        self.assertIn('div[id^="aswift_"]', self.html)

    def test_official_sources(self):
        official = [a for a in self.page.links if any(d in a.get("href", "") for d in ("migration.gov.rw", "irembo.gov.rw", "rbc.gov.rw", "who.int"))]
        self.assertGreaterEqual(len(official), 7)

    def test_removes_wrong_claims(self):
        for phrase in ("30일 단수 입국 비자는 $30", "관광 목적도 필요", "처리 기간: 72시간", "황열병 예방접종 증명서 (옐로우카드)", "WebSite", "SearchAction"):
            self.assertNotIn(phrase, self.html)

if __name__ == "__main__": unittest.main()
