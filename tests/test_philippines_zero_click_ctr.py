import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


PAGE = Path(__file__).resolve().parents[1] / "kor/report/visa/philippines.html"


class PhilippinesZeroClickCtrTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_search_snippet_answers_korean_passport_decision(self):
        self.assertIn("필리핀 비자 필요할까?", self.page.title)
        self.assertIn("한국 일반여권 30일 무비자", self.page.title)
        self.assertIn("먼저 답 — 한국 일반여권: 관광 30일 무비자", self.html)

    def test_visa_type_intent_has_clear_routes(self):
        for phrase in (
            "필리핀 비자 종류 한눈에",
            "30일 무비자",
            "9(a) 단기방문비자",
            "비자 면제 체류 연장",
            "취업·장기체류",
        ):
            self.assertIn(phrase, self.html)

    def test_current_official_qualification_is_retained(self):
        self.assertIn('dateModified":"2026-08-13"', self.html)
        self.assertIn("etravel.gov.ph", self.html)
        self.assertIn("immigration.gov.ph", self.html)
        self.assertIn("입국을 보장하지", self.html)


if __name__ == "__main__":
    unittest.main()
