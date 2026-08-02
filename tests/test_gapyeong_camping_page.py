import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/gapyeong.html"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.h1 = ""
        self.links = []
        self.meta = {}
        self.canonical = None
        self.json_ld = []
        self._capture = None
        self._buffer = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "title":
            self._capture = "title"
            self._buffer = []
        elif tag == "h1":
            self._capture = "h1"
            self._buffer = []
        elif tag == "script" and attributes.get("type") == "application/ld+json":
            self._capture = "json_ld"
            self._buffer = []
        elif tag == "a":
            self.links.append(attributes)
        elif tag == "meta":
            key = attributes.get("name") or attributes.get("property")
            if key:
                self.meta[key] = attributes.get("content", "")
        elif tag == "link" and attributes.get("rel") == "canonical":
            self.canonical = attributes.get("href")

    def handle_data(self, data):
        if self._capture:
            self._buffer.append(data)

    def handle_endtag(self, tag):
        expected = {"title": "title", "h1": "h1", "script": "json_ld"}.get(tag)
        if self._capture is None or expected != self._capture:
            return
        value = " ".join("".join(self._buffer).split())
        if self._capture == "json_ld":
            self.json_ld.append(json.loads(value))
        else:
            setattr(self, self._capture, value)
        self._capture = None
        self._buffer = []


class GapyeongCampingPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_search_result_answers_registered_campground_intent(self):
        self.assertIn("가평 캠핑장", self.page.title)
        self.assertIn("자라섬", self.page.title)
        self.assertIn("예약", self.page.title)
        self.assertIn("가평 캠핑장", self.page.h1)
        self.assertIn("공식", self.page.meta["description"])

    def test_keeps_canonical_and_measurement_tags(self):
        self.assertEqual(
            self.page.canonical,
            "https://emfls.github.io/kor/report/camp/gapyeong.html",
        )
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertIn("ca-pub-8830524482034754", self.html)

    def test_gives_current_source_backed_information(self):
        self.assertIn("2026-08-02", self.html)
        official_links = [
            link for link in self.page.links
            if "gocamping.or.kr" in link.get("href", "")
        ]
        self.assertGreaterEqual(len(official_links), 3)
        for link in official_links:
            self.assertEqual(link.get("target"), "_blank")
            self.assertEqual(link.get("rel"), "noopener noreferrer")

    def test_structured_data_matches_visible_page_types(self):
        types = set()
        for block in self.page.json_ld:
            graph = block.get("@graph", [block])
            types.update(item.get("@type") for item in graph)
        self.assertIn("WebPage", types)
        self.assertIn("FAQPage", types)

    def test_removes_unsupported_wild_camping_claims(self):
        for unsafe_claim in (
            "완전무료",
            "용문산 입구 공터",
            "자라섬 외곽 둔치",
            "무료 노지 캠핑장",
        ):
            self.assertNotIn(unsafe_claim, self.html)

    def test_mobile_layout_and_navigation_do_not_cover_content(self):
        self.assertRegex(
            self.html,
            re.compile(r"grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*280px\),\s*1fr\)\)"),
        )
        home_links = [link for link in self.page.links if link.get("class") == "home-button"]
        self.assertEqual(len(home_links), 1)
        self.assertEqual(home_links[0].get("href"), "index.html")
        self.assertNotIn("position: fixed", self.html)

    def test_automatic_ads_are_bounded_to_the_mobile_viewport(self):
        self.assertIn('div[id^="aswift_"]', self.html)
        self.assertIn('iframe[id^="aswift_"]', self.html)
        self.assertRegex(self.html, re.compile(r"max-width:\s*100%\s*!important"))
        self.assertRegex(self.html, re.compile(r"overflow-x:\s*clip\s*!important"))


if __name__ == "__main__":
    unittest.main()
