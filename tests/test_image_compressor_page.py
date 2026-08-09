import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "util/ImageCompressor/index.html"


class ImageCompressorPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_search_and_schema(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("Image Compressor", "Free", "JPEG", "PNG", "WebP", "batch"):
            self.assertIn(phrase.lower(), combined.lower())
        for phrase in ("2026-08-09", "1600", "transparency", "JPEG"):
            self.assertIn(phrase, self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"WebApplication", "FAQPage"})

    def test_function_and_privacy_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/util/ImageCompressor/")
        for phrase in ("compressImage", 'canvas.toDataURL("image/jpeg"', "JSZip", "Download All as ZIP"):
            self.assertIn(phrase, self.html)
        for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", 'div[id^="aswift_"]'):
            self.assertIn(phrase, self.html)
        self.assertIn('accept="image/jpeg,image/png,image/webp"', self.html)
        self.assertIn("analytics and advertising scripts", self.html)


if __name__ == "__main__": unittest.main()
