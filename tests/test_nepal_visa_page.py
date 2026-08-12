import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/nepal.html"


class NepalVisaPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_answers_korean_passport_arrival_intent(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("네팔 비자", "한국 여권", "도착비자"):
            self.assertIn(phrase, combined)
        self.assertIn("15일·30일·90일", self.html)

    def test_explains_online_receipt_and_passport(self):
        self.assertIn("온라인 영수증은 비자 자체가 아닙니다", self.html)
        self.assertIn("15일 동안 유효", self.html)
        self.assertIn("여행일 기준 최소 6개월", self.html)

    def test_contract_and_official_sources(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/visa/nepal.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterVisas", "function toggleFAQ", "2026-08-12"):
            self.assertIn(marker, self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)
        official = [a for a in self.page.links if any(domain in a.get("href", "") for domain in ("immigration.gov.np", "nepaliport.immigration.gov.np", "kr.nepalembassy.gov.np"))]
        self.assertGreaterEqual(len(official), 6)

    def test_removes_stale_or_unsupported_claims(self):
        for phrase in ("15일 체류: 6개월 복수비자", "처리기간: 2-3일", "월 수수료: NPR 8,798", "2025년 신여권", "최대 5년 연장", "WebSite", "SearchAction"):
            self.assertNotIn(phrase, self.html)


if __name__ == "__main__":
    unittest.main()
