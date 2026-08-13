import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


PAGE = Path(__file__).resolve().parents[1] / "kor/report/visa/russia.html"


class RussiaZeroClickCtrTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_search_snippet_answers_visa_decision(self):
        self.assertIn("러시아 비자 필요할까?", self.page.title)
        self.assertIn("한국 일반여권 60일 무비자", self.page.title)
        self.assertIn("먼저 답 — 한국 일반여권: 1회 최대 60일 무비자", self.html)
        self.assertIn("180일 중 누적 90일", self.html)

    def test_visa_type_intent_has_clear_routes(self):
        for phrase in (
            "러시아 비자 종류와 선택 경로",
            "단기 무비자",
            "통합 eVisa 비대상",
            "취업·유학·취재 비자",
            "일부 지역 여행금지",
        ):
            self.assertIn(phrase, self.html)

    def test_current_official_qualification_is_retained(self):
        self.assertIn('dateModified":"2026-08-13"', self.html)
        self.assertIn("2027-01-31", self.html)
        self.assertIn("kdmid.ru", self.html)
        self.assertIn("0404.go.kr", self.html)
        self.assertIn("입국이나 체류 승인을 보장하지", self.html)


if __name__ == "__main__":
    unittest.main()
