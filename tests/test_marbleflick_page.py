import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/game/MarbleFlick/index.html"


class MarbleFlickPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_search_and_measurement_contract(self):
        combined = cls_text(self.page)
        for phrase in ("마블 플릭 게임", "무료", "2인용", "AI", "구슬 튕기기"):
            self.assertIn(phrase, combined)
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/game/MarbleFlick/")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "2026-08-02", "다운로드 없이"):
            self.assertIn(marker, self.html)

    def test_gameplay_duplicate_defects_are_absent(self):
        self.assertEqual(self.html.count('id="turn"'), 1)
        self.assertEqual(self.html.count("showWinner(lastSurvivorColor);"), 1)
        for unchanged_marker in ("let vx = dx * 0.39", "vx *= 0.92", "if (dragLen > 18)", "function aiAuto()"):
            self.assertIn(unchanged_marker, self.html)

    def test_structured_data_and_mobile_ads(self):
        self.assertEqual({x.get("@type") for x in self.page.json_ld}, {"VideoGame", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)
        self.assertIn("max-width:100% !important", self.html)

    def test_visible_play_instructions_and_controls(self):
        for phrase in ("뒤로 당겼다가 놓아", "2인 모드", "AI 모드", "다시 시작", "다른 게임"):
            self.assertIn(phrase, self.html)


def cls_text(page):
    return page.title + page.h1 + page.meta["description"]


if __name__ == "__main__": unittest.main()
