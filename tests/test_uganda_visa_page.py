import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/uganda.html"


class UgandaVisaPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_answers_korean_passport_intent(self):
        combined = cls_text = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("우간다 비자", "한국 여권", "eVisa"):
            self.assertIn(phrase, combined)
        self.assertIn("도착비자는 발급되지 않습니다", self.html)

    def test_has_current_decision_details(self):
        for phrase in ("US$50", "최대 3개월", "최소 10일 전", "6개월", "US$100", "90일", "우간다·케냐·르완다", "평생 유효"):
            self.assertIn(phrase, self.html)

    def test_contract_and_official_sources(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/visa/uganda.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterVisas", "function toggleFAQ", "2026-08-08"):
            self.assertIn(marker, self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)
        official = [a for a in self.page.links if any(d in a.get("href", "") for d in ("immigration.go.ug", "visas.immigration.go.ug", "who.int"))]
        self.assertGreaterEqual(len(official), 6)

    def test_removes_stale_claims(self):
        for phrase in ("250KB", "USD 1.5", "통상 14일", "추가 수수료 없이 3개월", "크루즈비자", "WebSite", "SearchAction"):
            self.assertNotIn(phrase, self.html)


if __name__ == "__main__":
    unittest.main()
