from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/index.html"
EXPECTED = {
    "namyangju.html",
    "gyeonggi-best.html",
    "jeongseon.html",
    "hadong.html",
    "geumsan.html",
    "goyang.html",
}


class RevenuePriorityParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_priority = False
        self.depth = 0
        self.links = []
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json_ld = True
        if tag == "section" and attrs.get("data-revenue-priority") == "camp":
            self.in_priority = True
            self.depth = 1
            return
        if self.in_priority:
            if tag == "section":
                self.depth += 1
            elif tag == "a" and attrs.get("href"):
                self.links.append(attrs["href"])

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json_ld = False
        if self.in_priority and tag == "section":
            self.depth -= 1
            if self.depth == 0:
                self.in_priority = False

    def handle_data(self, data):
        if self.in_json_ld and data.strip():
            self.json_ld.append(json.loads(data))


class CampRevenueHubRoutingTest(unittest.TestCase):
    def test_hub_routes_to_six_current_revenue_winners(self):
        parser = RevenuePriorityParser()
        parser.feed(PAGE.read_text(encoding="utf-8"))
        self.assertEqual(EXPECTED, set(parser.links))
        self.assertTrue(
            any(
                item.get("@type") == "CollectionPage"
                and item.get("dateModified") == "2026-08-24"
                for item in parser.json_ld
            )
        )


if __name__ == "__main__":
    unittest.main()
