import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/sweden.html"


class SwedenVisaPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_answers_korean_passport_intent(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("스웨덴 비자", "한국 여권", "무비자"):
            self.assertIn(phrase, combined)
        self.assertIn("180일 중 최대 90일", self.html)

    def test_etias_status_is_current(self):
        self.assertIn("2026년 4분기", self.html)
        self.assertIn("현재는 신청할 필요가 없습니다", self.html)

    def test_contract_and_official_sources(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/visa/sweden.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterVisas", "function toggleFAQ", "2026-08-12"):
            self.assertIn(marker, self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)
        official = [a for a in self.page.links if any(domain in a.get("href", "") for domain in ("migrationsverket.se", "swedenabroad.se", "travel-europe.europa.eu"))]
        self.assertGreaterEqual(len(official), 6)

    def test_removes_stale_or_volatile_claims(self):
        for phrase in ("2025년부터 시행 예정", "최소 연봉 SEK 318,720", "일반적으로 1-3개월", "취업허가: SEK 2,200", "WebSite", "SearchAction"):
            self.assertNotIn(phrase, self.html)


if __name__ == "__main__":
    unittest.main()
