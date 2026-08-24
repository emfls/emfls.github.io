from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/column/maple-planet-lv80-black-centaurus-leveling-2026.html"


class BenchmarkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.metrics = 0
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li" and "data-benchmark-metric" in attrs:
            self.metrics += 1
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json_ld = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json_ld = False

    def handle_data(self, data):
        if self.in_json_ld and data.strip():
            self.json_ld.append(json.loads(data))


class MapleBlackCentaurusRevenueQuickAnswerTest(unittest.TestCase):
    def test_exposes_ten_minute_benchmark_and_conditional_title(self):
        html = PAGE.read_text(encoding="utf-8")
        parser = BenchmarkParser()
        parser.feed(html)
        self.assertEqual(5, parser.metrics)
        self.assertIn("10분 실측", html)
        self.assertIn("경험치 증가량", html)
        self.assertIn("보장값이 아닙니다", html)
        self.assertIn("검켄 진입 조건·10분 효율 측정", html)
        self.assertNotIn("검켄 30분마다 레벨업 —", html)
        self.assertTrue(
            any(
                item.get("@type") == "Article"
                and item.get("dateModified") == "2026-08-24"
                for item in parser.json_ld
            )
        )


if __name__ == "__main__":
    unittest.main()
