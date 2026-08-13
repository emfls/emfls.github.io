import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/travel/australia-newcastle.html"


class AustraliaNewcastleZeroClickTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_answers_day_trip_or_overnight_decision(self):
        for phrase in (
            "호주 뉴캐슬 여행 2026",
            "시드니 당일치기·1박 2일",
            "처음 방문하고 해안 산책이 목적이라면",
            "당일치기",
            "1박 2일",
        ):
            self.assertIn(phrase, self.html)

    def test_uses_official_walk_facts_and_map(self):
        for phrase in (
            "6km 편도",
            "약 3시간",
            "450m",
            "A Day in Newcastle",
            "6789-A-Day-In-Newcastle-Walking-Tour-2025-V5-WEB.pdf",
            "2026-08-13",
        ):
            self.assertIn(phrase, self.html)


if __name__ == "__main__":
    unittest.main()
