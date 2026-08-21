from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "namyangju.html": {"gyeonggi-best.html", "uijeongbu.html", "goyang.html"},
    "jeongseon.html": {"gangwon-best.html", "taebaek.html", "pyeongchang.html"},
    "hadong.html": {"gyeongnam-best.html", "jinju.html", "gimhae.html"},
    "gwangyang.html": {"jeonnam-best.html", "suncheon.html", "yeosu.html"},
    "yangyang.html": {"gangwon-best.html", "sokcho.html", "gangneung.html"},
}
REQUIRED_LABELS = {"대표 장소", "주차", "화장실", "취사", "요금·허용 여부", "최종 재검토"}


class PlanningSectionParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_section = False
        self.section_depth = 0
        self.current_term = False
        self.terms = []
        self.links = []
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json_ld = True
        if tag == "section" and attrs.get("data-revenue-planning") == "camp":
            self.in_section = True
            self.section_depth = 1
            return
        if not self.in_section:
            return
        if tag == "section":
            self.section_depth += 1
        elif tag == "dt":
            self.current_term = True
        elif tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json_ld = False
        if not self.in_section:
            return
        if tag == "dt":
            self.current_term = False
        elif tag == "section":
            self.section_depth -= 1
            if self.section_depth == 0:
                self.in_section = False

    def handle_data(self, data):
        if self.in_json_ld and data.strip():
            self.json_ld.append(json.loads(data))
        if self.in_section and self.current_term and data.strip():
            self.terms.append(data.strip())


class RevenueCampPlanningSectionsTest(unittest.TestCase):
    def test_pages_expose_quick_planning_facts_and_regional_navigation(self):
        for page, related_files in PAGES.items():
            with self.subTest(page=page):
                parser = PlanningSectionParser()
                parser.feed((ROOT / "kor/report/camp" / page).read_text(encoding="utf-8"))
                self.assertEqual(REQUIRED_LABELS, set(parser.terms))
                self.assertEqual(
                    {f"/kor/report/camp/{name}" for name in related_files},
                    set(parser.links),
                )
                self.assertTrue(
                    any(
                        item.get("@type") == "WebPage"
                        and item.get("dateModified") == "2026-08-21"
                        for item in parser.json_ld
                    )
                )


if __name__ == "__main__":
    unittest.main()
