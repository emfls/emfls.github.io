import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/ukraine.html"

class UkraineVisaPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_answers_korean_passport_and_safety_intent(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("우크라이나 비자", "한국 일반여권", "여행금지"):
            self.assertIn(phrase, combined)
        for phrase in ("180일 중 최대 90일", "2027-01-31", "예외적 여권사용허가"):
            self.assertIn(phrase, self.html)

    def test_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/visa/ukraine.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterVisas", "function toggleFAQ", "2026-09-20"):
            self.assertIn(marker, self.html)
        self.assertEqual([x.get("@type") for x in self.page.json_ld].count("WebPage"), 1)
        self.assertEqual([x.get("@type") for x in self.page.json_ld].count("FAQPage"), 1)
        self.assertIn('div[id^="aswift_"]', self.html)

    def test_official_sources(self):
        official = [a for a in self.page.links if any(d in a.get("href", "") for d in ("mfa.gov.ua", "0404.go.kr", "overseas.mofa.go.kr"))]
        self.assertGreaterEqual(len(official), 7)

    def test_current_safety_sources_and_exception_inquiry(self):
        self.assertIn("여행금지 국가·지역 현황", self.html)
        self.assertIn("2026-07-09", self.html)
        self.assertIn("boho@mofa.go.kr", self.html)
        self.assertIn("재외동포365민원포털", self.html)
        self.assertIn("MST0000000000102/2/detail", self.html)
        self.assertIn("문의 또는 신청만으로 허가가 보장되는 것은 아닙니다", self.html)

    def test_removes_wrong_or_stale_claims(self):
        for phrase in ("ETIAS", "출발 96시간 전", "최소 월급 UAH 6,700", "미화 40달러", "HIV 검사 결과서", "WebSite", "SearchAction"):
            self.assertNotIn(phrase, self.html)

if __name__ == "__main__": unittest.main()
