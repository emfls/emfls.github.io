import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/senegal.html"


class SenegalVisaZeroClickTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_gives_the_visa_decision_before_supporting_detail(self):
        self.assertIn("세네갈 비자 필요할까?", self.page.title)
        self.assertIn("세네갈 비자 필요할까?", self.page.h1)
        self.assertIn(
            "대한민국 일반여권은 세네갈 3개월 미만 방문에 사전 비자가 필요하지 않습니다",
            self.html,
        )
        for decision_branch in ("여권 유효기간 6개월", "3개월 이상", "취업·유학·장기체류"):
            self.assertIn(decision_branch, self.html)

    def test_uses_current_primary_sources_without_a_stale_transit_threshold(self):
        for source in (
            "https://www.diplomatie.gouv.sn/visiter-le-senegal",
            "yellow-fever-country-list-ith-travel.pdf",
            "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON610",
        ):
            self.assertIn(source, self.html)
        self.assertIn("평생 유효", self.html)
        self.assertNotIn("12시간을 초과", self.html)
        self.assertNotIn("12시간 초과", self.html)

    def test_keeps_indexing_ads_and_freshness_contract(self):
        self.assertEqual(
            self.page.canonical,
            "https://emfls.github.io/kor/report/visa/senegal.html",
        )
        for marker in ("2026-08-13", "ca-pub-8830524482034754", 'data-ad-format="auto"'):
            self.assertIn(marker, self.html)


if __name__ == "__main__":
    unittest.main()
