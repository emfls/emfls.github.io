import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "game/BlockBreaker/index.html"


class BlockBreakerPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_search_intent(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("Block Breaker", "free", "browser game", "mouse", "touch"):
            self.assertIn(phrase, combined)
        for phrase in ("No download", "2026-08-09", "Every 8 bricks"):
            self.assertIn(phrase, self.html)

    def test_contract_and_game_logic(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/game/BlockBreaker/")
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"VideoGame", "FAQPage"})
        for phrase in ("G-QP5Q67GE5B", "function collisionBall", "spawnNewRow"):
            self.assertIn(phrase, self.html)
        self.assertNotIn("adsbygoogle", self.html)
        self.assertNotIn("pagead2.googlesyndication.com", self.html)
        self.assertNotIn("(_, c) => ({\n                                (_, c) => ({", self.html)


if __name__ == "__main__":
    unittest.main()
