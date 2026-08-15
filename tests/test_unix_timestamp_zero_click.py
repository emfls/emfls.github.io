import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


PAGE = Path(__file__).resolve().parents[1] / "util/unix-timestamp/index.html"


class UnixTimestampZeroClickTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_search_snippet_matches_milliseconds_intent(self):
        self.assertEqual("Date to Milliseconds Converter | Milliseconds to Date", self.page.title)
        self.assertEqual("Date to Milliseconds & Milliseconds to Date Converter", self.page.h1)
        self.assertIn("Quick answer: choose a local date and time", self.html)
        self.assertLess(self.html.index('id="date"'), self.html.index('id="stamp"'))

    def test_indexable_examples_and_internal_routes_exist(self):
        for phrase in (
            "10-digit Unix timestamp",
            "13-digit Unix timestamp",
            "1786233600000",
            'href="/util/date-difference/"',
            'href="/util/"',
        ):
            self.assertIn(phrase, self.html)

    def test_contract_and_privacy_stay_current(self):
        self.assertIn('dateModified":"2026-08-15"', self.html)
        self.assertIn("function convertTimestamp", self.html)
        self.assertIn("processed in your browser", self.html)
        self.assertIn("Analytics and advertising", self.html)


if __name__ == "__main__":
    unittest.main()
