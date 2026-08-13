import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/singapore.html"


class SingaporeOnePassZeroClickTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_answers_korean_one_pass_search(self):
        for phrase in (
            "ONE Pass 해외 네트워크 전문가",
            "공식 명칭은 Overseas Networks & Expertise Pass",
            "S$30,000",
            "12개월 연속",
            "한 고용주",
            "최대 5년",
        ):
            self.assertIn(phrase, self.html)

    def test_separates_salary_and_achievement_routes(self):
        for phrase in (
            "US$500 million",
            "US$200 million",
            "스포츠·예술문화·학계·연구",
            "/overseas-networks-expertise-pass/eligibility",
            "후보자가 직접 신청",
        ):
            self.assertIn(phrase, self.html)


if __name__ == "__main__":
    unittest.main()
