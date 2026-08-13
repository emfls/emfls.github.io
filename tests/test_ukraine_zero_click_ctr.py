import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


PAGE = Path(__file__).resolve().parents[1] / "kor/report/visa/ukraine.html"


class UkraineZeroClickCtrTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_search_snippet_answers_visa_and_safety_decisions(self):
        self.assertIn("우크라이나 비자 필요할까?", cls_text := self.page.title)
        self.assertIn("한국 일반여권 90일 무비자", cls_text)
        self.assertIn("전역 여행금지", cls_text)
        self.assertIn("한국 일반여권: 180일 중 최대 90일 무비자", self.html)
        self.assertIn("현재 우크라이나 전역은 여행금지", self.html)

    def test_current_official_qualification_is_retained(self):
        self.assertIn('dateModified":"2026-08-13"', self.html)
        self.assertIn("2027-01-31", self.html)
        self.assertIn("예외적 여권사용허가", self.html)
        self.assertIn("0404.go.kr", self.html)
        self.assertIn("mfa.gov.ua", self.html)


if __name__ == "__main__":
    unittest.main()
