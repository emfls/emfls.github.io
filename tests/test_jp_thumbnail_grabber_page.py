import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "jp/util/thumbnailgrabber/index.html"


class JapaneseThumbnailGrabberPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_search_and_schema(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("YouTube", "サムネイル", "無料", "ログイン不要"):
            self.assertIn(phrase, combined)
        for phrase in ("2026-08-09", "動画ID", "maxresdefault", "右クリック"):
            self.assertIn(phrase, self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"WebApplication", "FAQPage"})

    def test_truthful_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/jp/util/thumbnailgrabber/")
        for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "getYoutubeThumbs", "YT_THUMB_QUALITIES"):
            self.assertIn(phrase, self.html)
        self.assertNotIn("すべての処理はブラウザ上でローカルに行われます", self.html)
        self.assertNotIn("getTiktokThumb", self.html)
        self.assertNotIn("getXThumb", self.html)
        self.assertIn('div[id^="aswift_"]', self.html)


if __name__ == "__main__": unittest.main()
