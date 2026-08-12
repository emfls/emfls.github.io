import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/senegal.html"


class SenegalVisaPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_answers_korean_passport_intent(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        self.assertIn("세네갈 비자", combined)
        self.assertIn("한국 여권", combined)
        self.assertIn("무비자", combined)
        self.assertIn("3개월 미만", self.html)

    def test_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/visa/senegal.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterVisas", "function toggleFAQ", "2026-08-12"):
            self.assertIn(marker, self.html)
        self.assertEqual({x.get("@type") for x in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)

    def test_official_sources(self):
        official = [a for a in self.page.links if any(d in a.get("href", "") for d in ("diplomatie.gouv.sn", "ambasenegal-us.org", "who.int"))]
        self.assertGreaterEqual(len(official), 6)

    def test_removes_wrong_claims(self):
        for phrase in (
            "대한민국 국민은 세네갈 입국 시 사전에 비자를 발급받아야 합니다",
            "모든 여행자는 황열병 예방접종 증명서가 필수",
            "6개월마다 갱신 필요",
            "2년 유효",
            "WebSite",
            "SearchAction",
        ):
            self.assertNotIn(phrase, self.html)


if __name__ == "__main__":
    unittest.main()
