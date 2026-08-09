import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "game/MBTI/index.html"


class MbtiGamePageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_search_contract(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("Free", "MBTI", "16-question", "personality test"):
            self.assertIn(phrase.lower(), combined.lower())
        for phrase in ("2026-08-09", "entertainment", "No sign-up", "four preference pairs"):
            self.assertIn(phrase, self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"WebApplication", "FAQPage"})

    def test_game_and_measurement_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/game/MBTI/")
        for phrase in ("const questions", "const resultCount", "function showResult", "questions.length"):
            self.assertIn(phrase, self.html)
        self.assertEqual(self.html.count('q: "'), 16)
        self.assertNotIn("\n                },\n                },\n                {\n                    q:", self.html)
        for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", 'div[id^="aswift_"]'):
            self.assertIn(phrase, self.html)


if __name__ == "__main__": unittest.main()
