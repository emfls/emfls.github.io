from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/column/maple-planet-bishop-4th-skill-quest-guide-2026.html"


class BishopParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.steps = 0
        self.links = []
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li" and "data-bishop-quick-step" in attrs:
            self.steps += 1
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json_ld = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json_ld = False

    def handle_data(self, data):
        if self.in_json_ld and data.strip():
            self.json_ld.append(json.loads(data))


class BishopSkillRevenueAnswerTest(unittest.TestCase):
    def setUp(self):
        self.html = PAGE.read_text(encoding="utf-8")
        self.parser = BishopParser()
        self.parser.feed(self.html)

    def test_answers_start_and_order_before_long_guide(self):
        self.assertEqual(self.parser.steps, 5)
        self.assertIn("4차 전직 완료와 게임 내 퀘스트 발생 여부", self.html)
        self.assertIn("제네시스 → 리저렉션 → 바하뮤트", self.html)
        self.assertIn("인원·재료·드롭·재도전 시간은 패치로 바뀔 수 있습니다", self.html)

    def test_preserves_related_routes_and_freshness(self):
        for link in (
            "maple-planet-lv80-black-centaurus-leveling-2026.html",
            "maple-planet-suncall-blizzard-hp-zero-setup-2026.html",
            "./",
        ):
            self.assertIn(link, self.parser.links)
        self.assertTrue(
            any(
                item.get("@type") == "Article"
                and item.get("dateModified") == "2026-08-24"
                for item in self.parser.json_ld
            )
        )
        self.assertNotIn("YouTube 영상 자막을 기반으로 자동 생성되었습니다", self.html)


if __name__ == "__main__":
    unittest.main()
