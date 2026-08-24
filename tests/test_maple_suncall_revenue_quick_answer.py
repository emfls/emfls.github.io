from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/column/maple-planet-suncall-blizzard-hp-zero-setup-2026.html"


class QuickAnswerParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_quick = False
        self.steps = 0
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "section" and attrs.get("data-game-quick-answer") == "suncall-defense":
            self.in_quick = True
        if self.in_quick and tag == "li" and "data-test-step" in attrs:
            self.steps += 1
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json_ld = True

    def handle_endtag(self, tag):
        if tag == "section" and self.in_quick:
            self.in_quick = False
        if tag == "script":
            self.in_json_ld = False

    def handle_data(self, data):
        if self.in_json_ld and data.strip():
            self.json_ld.append(json.loads(data))


class MapleSuncallRevenueQuickAnswerTest(unittest.TestCase):
    def test_page_exposes_reproducible_quick_test_not_a_guarantee(self):
        html = PAGE.read_text(encoding="utf-8")
        parser = QuickAnswerParser()
        parser.feed(html)
        self.assertEqual(5, parser.steps)
        self.assertIn("보장값이 아닙니다", html)
        self.assertIn("10분", html)
        self.assertIn("물약 사용량", html)
        self.assertIn("HP 물약 0개 가능 조건·10분 테스트", html)
        self.assertNotIn("방어력 1700 완벽 가이드", html)
        self.assertTrue(
            any(
                item.get("@type") == "Article"
                and item.get("dateModified") == "2026-08-24"
                for item in parser.json_ld
            )
        )


if __name__ == "__main__":
    unittest.main()
