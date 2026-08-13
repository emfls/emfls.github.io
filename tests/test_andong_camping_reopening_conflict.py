import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/andong.html"


class AndongCampingReopeningConflictTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_surfaces_newer_city_reopening_record(self):
        for phrase in (
            "2026년 7월 14일 새 단장 개장",
            "고캠핑은 현재 휴업 중으로 표시",
            "두 공식 정보가 일치하지 않습니다",
            "예약 가능일을 최종 확인",
            "2026-08-13",
        ):
            self.assertIn(phrase, self.html)

    def test_does_not_repeat_stale_unqualified_closure_claim(self):
        self.assertNotIn("단호샌드파크는 현재 휴업 중", self.html)


if __name__ == "__main__":
    unittest.main()
