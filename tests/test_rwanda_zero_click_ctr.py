import unittest
from pathlib import Path


PAGE = Path(__file__).resolve().parents[1] / "kor/report/visa/rwanda.html"


class RwandaZeroClickCtrTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_search_result_answers_the_decision(self):
        for phrase in (
            "르완다 비자 필요할까?",
            "한국 일반여권: 도착비자 신청 가능",
            "모든 국가 국민",
            "사전 신청 없이 도착비자",
            "단수 30일",
        ):
            self.assertIn(phrase, self.html)

    def test_current_and_policy_safe(self):
        self.assertIn('dateModified":"2026-08-13"', self.html)
        self.assertIn("migration.gov.rw", self.html)
        self.assertNotIn("한국인은 무비자", self.html)
        self.assertNotIn("입국이 보장", self.html)


if __name__ == "__main__":
    unittest.main()
