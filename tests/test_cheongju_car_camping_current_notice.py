import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/cheongju.html"


class CheongjuCarCampingCurrentNoticeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_leads_with_current_car_camping_decision(self):
        for phrase in (
            "청주 차박 장소 2026",
            "공식적으로 차박을 허용한 무료 노지 장소는 확인하지 못했습니다",
            "2026년 8월 18일부터 11월 6일까지 이용 불가",
            "문암생태공원 캠핑장 예약",
        ):
            self.assertIn(phrase, self.html)

    def test_links_the_current_official_closure_notice(self):
        self.assertIn("bd_seq=8700", self.html)
        self.assertIn("043-201-4433", self.html)
        self.assertIn("FAQPage", self.html)


if __name__ == "__main__":
    unittest.main()
