import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/sierra-leone.html"


class SierraLeoneVisaPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_answers_korean_passport_intent(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("시에라리온 비자", "한국 여권", "eVisa"):
            self.assertIn(phrase, combined)
        self.assertIn("출발 전에 비자", self.html)

    def test_explains_official_evisa_and_yellow_fever(self):
        self.assertIn("여행자마다 별도", self.html)
        self.assertIn("터미널에서 비자를 발급", self.html)
        self.assertIn("황열 국제예방접종증명서", self.html)

    def test_contract_and_sources(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/visa/sierra-leone.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterVisas", "function toggleFAQ", "2026-08-12"):
            self.assertIn(marker, self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)
        official = [a for a in self.page.links if any(domain in a.get("href", "") for domain in ("slid.gov.sl", "evisa.sl", "sierra-leone.or.kr", "who.int"))]
        self.assertGreaterEqual(len(official), 6)

    def test_removes_unsupported_fixed_claims(self):
        for phrase in ("비자 수수료 약 80달러 (현금 지불)", "최대 1년 유효기간", "2025년 기준 시에라리온 비자 수수료", "WebSite", "SearchAction"):
            self.assertNotIn(phrase, self.html)


if __name__ == "__main__":
    unittest.main()
