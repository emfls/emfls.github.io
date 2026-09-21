import json
import re
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

    def test_search_snippet_matches_date_only_intent(self):
        self.assertIn("Date Difference Calculator", self.page.title)
        self.assertIn("Days Between Dates", self.page.title)
        self.assertEqual(self.page.h1, "Date Difference Calculator")
        self.assertIn("date-only elapsed days", self.html)

    def test_result_contract_and_semantics_are_visible(self):
        for phrase in ("Include end date in range counts", "Weekdays (Mon–Fri)", "public holidays are not excluded", "Calendar span is not the same as dividing total days into fixed 30-day months", "general calendar-planning estimate"):
            self.assertIn(phrase, self.html)

    def test_schema_and_freshness_contract(self):
        self.assertIn('dateModified":"2026-09-21"', self.html)
        self.assertIn("Reviewed: 2026-09-21", self.html)
        blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', self.html, re.S)
        schemas = [json.loads(block) for block in blocks]
        self.assertEqual([schema.get("@type") for schema in schemas], ["WebApplication"])
        self.assertNotIn("FAQPage", self.html)
        for href in ("/util/time-diff/", "/util/age/", "/util/unix-timestamp/"):
            self.assertIn(f'href="{href}"', self.html)


if __name__ == "__main__":
    unittest.main()
