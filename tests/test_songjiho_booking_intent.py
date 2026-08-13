import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/goseong.html"


class SongjihoBookingIntentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_search_result_and_first_answer_match_booking_intent(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        self.assertIn("송지호 오토캠핑장 예약", combined)
        self.assertIn("고성군 통합예약", self.html)
        self.assertIn("매월 셋째 주 화요일 10시", self.html)
        self.assertIn("다음 달 1일부터 말일까지", self.html)

    def test_official_booking_decision_is_safe_and_current(self):
        self.assertIn("https://gwgs.pubcamping.kr/@song/index", self.html)
        for marker in ("실시간 예약 화면", "예약 가능 여부를 보장하지 않습니다", "2026-08-13"):
            self.assertIn(marker, self.html)
        self.assertNotIn("예약 필수", self.html)
        self.assertNotIn("성수기 비쌈", self.html)

    def test_keeps_canonical_measurement_ads_and_structured_data(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/camp/goseong.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754"):
            self.assertIn(marker, self.html)
        types = {item.get("@type") for item in self.page.json_ld}
        self.assertTrue({"WebPage", "FAQPage"}.issubset(types))


if __name__ == "__main__":
    unittest.main()
