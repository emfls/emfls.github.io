import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]

CASES = {
    "game/AeroJump/index.html": ("Aero Jump", "platform", "arrow keys", "https://emfls.github.io/game/AeroJump/", "VideoGame", "2026-08-12", ("gameCanvas", "function initGame", "function spawnRow")),
    "game/FlagQuest/index.html": ("Flag Quest", "flag quiz", "4 choices", "https://emfls.github.io/game/FlagQuest/", "VideoGame", "2026-08-09", ("function loadQuestion", "function checkAnswer", "function restartGame")),
    "jp/util/color-extractor/index.html": ("カラー抽出", "HEX", "無料", "https://emfls.github.io/jp/util/color-extractor/", "WebApplication", "2026-08-13", ("FileReader", "ColorThief", "rgbToHex", "rgbToHsl")),
}

class FourthBatchGameToolPagesTest(unittest.TestCase):
    def test_contracts(self):
        for path, (name, intent, detail, canonical, page_type, checked_on, functions) in CASES.items():
            with self.subTest(path=path):
                html = (ROOT / path).read_text(encoding="utf-8")
                page = PageParser(); page.feed(html)
                combined = page.title + page.h1 + page.meta.get("description", "")
                for phrase in (name, intent, detail): self.assertIn(phrase.lower(), combined.lower())
                for phrase in (checked_on, "privacy", *functions): self.assertIn(phrase.lower(), html.lower())
                self.assertEqual(page.canonical, canonical)
                self.assertEqual({item.get("@type") for item in page.json_ld}, {page_type, "FAQPage"})
                for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", 'div[id^="aswift_"]'):
                    self.assertIn(phrase, html)

if __name__ == "__main__": unittest.main()
