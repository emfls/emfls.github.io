import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


PAGE = Path(__file__).resolve().parents[1] / "util/date-difference/index.html"


class DateDifferenceZeroClickTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_search_snippet_matches_diff_and_comparison_intent(self):
        self.assertIn("Date Diff", self.page.title)
        self.assertIn("Date Comparison", self.page.title)
        self.assertIn("Date Difference, Date Diff & Comparison Calculator", self.page.h1)
        self.assertIn("Quick answer: choose two dates to compare their order", self.html)

    def test_result_contract_includes_comparison(self):
        for phrase in (
            "Comparison:",
            "End date is later",
            "End date is earlier",
            "Dates are the same",
            "Inclusive count example",
        ):
            self.assertIn(phrase, self.html)

    def test_contract_stays_current(self):
        self.assertIn('dateModified":"2026-08-13"', self.html)
        self.assertIn("function calculateDateDifference", self.html)
        self.assertIn("processed in your browser", self.html)
        self.assertIn('href="/util/unix-timestamp/"', self.html)


if __name__ == "__main__":
    unittest.main()
