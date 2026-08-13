import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/mabinogi-mobile-jobs.html"


class MabinogiMobileJobsPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_source_backed_decision_guide(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("마비노기 모바일", "직업", "초보", "클래스"):
            self.assertIn(phrase, combined)
        for phrase in ("2026-08-13", "견습 클래스", "착용한 무기", "주 능력치", "공식"):
            self.assertIn(phrase, self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"WebPage", "FAQPage"})

    def test_no_unsupported_tier_claims(self):
        for phrase in ("0티어 (OP)", "압도적 단일·광역 DPS", "파티 콘텐츠에서 필수"):
            self.assertNotIn(phrase, self.html)
        for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", 'div[id^="aswift_"]', "https://mabinogimobile.nexon.com/Info/guide"):
            self.assertIn(phrase, self.html)


if __name__ == "__main__": unittest.main()
