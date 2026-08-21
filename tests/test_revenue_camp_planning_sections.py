from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "namyangju.html": ({"gyeonggi-best.html", "uijeongbu.html", "goyang.html"}, "2026-08-21"),
    "jeongseon.html": ({"gangwon-best.html", "taebaek.html", "pyeongchang.html"}, "2026-08-21"),
    "hadong.html": ({"gyeongnam-best.html", "jinju.html", "gimhae.html"}, "2026-08-21"),
    "gwangyang.html": ({"jeonnam-best.html", "suncheon.html", "yeosu.html"}, "2026-08-21"),
    "yangyang.html": ({"gangwon-best.html", "sokcho.html", "gangneung.html"}, "2026-08-21"),
    "gyeonggi-best.html": ({"namyangju.html", "goyang.html", "uijeongbu.html"}, "2026-08-22"),
    "taebaek.html": ({"gangwon-best.html", "jeongseon.html", "pyeongchang.html"}, "2026-08-22"),
    "gyeongnam-best.html": ({"hadong.html", "jinju.html", "gimhae.html"}, "2026-08-22"),
    "geumsan.html": ({"chungcheong-camping-best.html", "nonsan.html", "gongju.html"}, "2026-08-22"),
    "jinju.html": ({"gyeongnam-best.html", "hadong.html", "gimhae.html"}, "2026-08-22"),
    "cheorwon.html": ({"gangwon-best.html", "taebaek.html", "pyeongchang.html"}, "2026-08-22"),
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


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        elif tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json_ld = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json_ld = False

    def handle_data(self, data):
        if self.in_json_ld and data.strip():
            self.json_ld.append(json.loads(data))


class RevenueCampPlanningSectionsTest(unittest.TestCase):
    def test_pages_expose_quick_planning_facts_and_regional_navigation(self):
        for page, (related_files, modified_date) in PAGES.items():
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
                        item.get("@type") in {"WebPage", "TravelGuide"}
                        and item.get("dateModified") == modified_date
                        for item in parser.json_ld
                    )
                )

    def test_jeonnam_hub_links_to_the_gwangyang_revenue_page(self):
        parser = LinkParser()
        parser.feed(
            (ROOT / "kor/report/camp/jeonnam-best.html").read_text(encoding="utf-8")
        )
        self.assertIn(
            "https://emfls.github.io/kor/report/camp/gwangyang.html",
            parser.links,
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
