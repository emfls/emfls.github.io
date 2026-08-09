import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "game/MatrixDefense/index.html"


class MatrixDefensePageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_search_and_schema(self):
        combined = (self.page.title + self.page.h1 + self.page.meta["description"]).lower()
        for phrase in ("Matrix Defense", "free", "browser", "idle", "upgrade"):
            self.assertIn(phrase.lower(), combined)
        for phrase in ("2026-08-09", "No download", "ATK", "RATE", "RNG", "LASER"):
            self.assertIn(phrase, self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"VideoGame", "FAQPage"})

    def test_contract_and_mobile_scroll(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/game/MatrixDefense/")
        for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function upgrade", "function spawnEnemy"):
            self.assertIn(phrase, self.html)
        self.assertEqual(self.html.count('id="dmgC"'), 1)
        self.assertNotIn('document.body.addEventListener(\n                "touchmove"', self.html)
        self.assertIn('div[id^="aswift_"]', self.html)


if __name__ == "__main__": unittest.main()
