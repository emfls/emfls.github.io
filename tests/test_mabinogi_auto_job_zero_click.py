import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/mabinogi-mobile-jobs.html"


class MabinogiAutoJobZeroClickTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_answers_auto_hunting_search_without_inventing_a_tier(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        self.assertIn("마비노기 모바일 자동사냥 직업 추천", combined)
        for phrase in (
            "공식 가이드에는 ‘자동사냥 1티어’ 순위가 없습니다",
            "자동사냥·오토 직업을 찾는다면 먼저 구분",
            "외부 매크로·비인가 프로그램",
            "반복 전투 조작 부담",
        ):
            self.assertIn(phrase, self.html)

    def test_keeps_official_source_and_current_review_date(self):
        self.assertIn("https://mabinogimobile.nexon.com/Info/Class", self.html)
        self.assertIn("2026-08-13", self.html)


if __name__ == "__main__":
    unittest.main()
