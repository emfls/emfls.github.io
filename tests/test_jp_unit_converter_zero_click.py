import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


PAGE = Path(__file__).resolve().parents[1] / "jp/util/unitconverter/index.html"


class JapaneseUnitConverterZeroClickTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_search_snippet_matches_length_web_intent(self):
        self.assertIn("長さの単位変換", self.page.title)
        self.assertIn("Web", self.page.title)
        self.assertIn("長さ・重さ・温度の単位変換", self.page.h1)
        self.assertIn("まず答え：数値を入力すると、長さの単位をWeb上ですぐ変換できます", self.html)

    def test_indexable_examples_and_internal_route_exist(self):
        for phrase in (
            "よく使う長さの換算例",
            "1インチ = 2.54センチメートル",
            "1フィート = 30.48センチメートル",
            "1マイル = 1.60934キロメートル",
            'href="/jp/util/"',
        ):
            self.assertIn(phrase, self.html)

    def test_contract_stays_current(self):
        self.assertIn('dateModified":"2026-08-13"', self.html)
        self.assertIn("function convert", self.html)
        self.assertIn("ca-pub-8830524482034754", self.html)


if __name__ == "__main__":
    unittest.main()
