import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


PAGE = Path(__file__).resolve().parents[1] / "jp/util/color-extractor/index.html"


class JapaneseColorExtractorZeroClickTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_search_snippet_matches_color_extraction_intent(self):
        self.assertIn("画像からカラー抽出", self.page.title)
        self.assertIn("画像からカラー抽出", self.page.h1)
        self.assertIn("まず答え：画像を選ぶと主要カラーを自動抽出", self.html)
        self.assertIn("HEX・RGB・HSL", self.page.title)

    def test_indexable_usage_and_internal_route_exist(self):
        for phrase in (
            "画像からカラーを抽出する方法",
            "画像を選択",
            "カラーパレットを確認",
            "HEXコードをコピー",
            'href="/jp/util/"',
        ):
            self.assertIn(phrase, self.html)

    def test_privacy_claim_is_precise_and_current(self):
        self.assertIn('dateModified":"2026-08-13"', self.html)
        self.assertIn("画像の読み込みと色抽出はブラウザ内で処理", self.html)
        self.assertIn("外部通信します", self.html)
        self.assertNotIn("すべての処理はユーザーのブラウザでローカル", self.html)


if __name__ == "__main__":
    unittest.main()
