import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/nigeria.html"


class NigeriaVisaPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_answers_korean_passport_application_intent(self):
        for phrase in ("나이지리아 비자", "한국 여권", "e-Visa"):
            self.assertIn(phrase, self.page.title + self.page.h1 + self.page.meta["description"])
        self.assertIn("입국 전에", self.html)

    def test_keeps_canonical_measurement_and_interactions(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/visa/nigeria.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterVisas", "function toggleFAQ"):
            self.assertIn(marker, self.html)

    def test_uses_current_official_sources(self):
        official = [a for a in self.page.links if any(d in a.get("href", "") for d in ("immigration.gov.ng", "nigerianembassy.or.kr", "health.gov.ng", "who.int"))]
        self.assertGreaterEqual(len(official), 6)
        self.assertIn("2026-08-13", self.html)

    def test_structured_data_and_mobile_ads_are_safe(self):
        self.assertEqual({x.get("@type") for x in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)
        self.assertIn("max-width:100% !important", self.html)

    def test_removes_unsupported_or_wrong_claims(self):
        for phrase in ("주한나이지리아대사관: 현재 운영 중단", "https://www.visa.go.kr", "USD 5,000", "처리기간: 7-10일", "대행 수수료", "단기 방문 비자는 e-Visa만"):
            self.assertNotIn(phrase, self.html)


if __name__ == "__main__": unittest.main()
