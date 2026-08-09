import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "jp/util/dataconvert/index.html"


class JapaneseDataConverterPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_search_and_guidance(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("JSON", "XML", "CSV", "無料", "変換"):
            self.assertIn(phrase, combined)
        for phrase in ("2026-08-09", "1行目", "ルート要素", "小規模～中規模"):
            self.assertIn(phrase, self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"WebApplication", "FAQPage"})

    def test_function_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/jp/util/dataconvert/")
        for phrase in ("JSON.parse", "xml2js", "js2xml", "Papa.parse", "Papa.unparse", "navigator.clipboard"):
            self.assertIn(phrase, self.html)
        for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", 'div[id^="aswift_"]'):
            self.assertIn(phrase, self.html)
        self.assertIn("外部ライブラリ・アクセス解析・広告", self.html)


if __name__ == "__main__": unittest.main()
