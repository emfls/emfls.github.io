from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).parents[1]
HUB = ROOT / "kor/column/index.html"
GUIDES = {
    "/kor/column/maple-planet-no-capital-rice-farming-2026.html": "무자본 메소 수급과 현금거래 정책",
    "/kor/column/maple-planet-suncall-blizzard-hp-zero-setup-2026.html": "썬콜 부기 사냥 방어 세팅",
    "/kor/column/maple-planet-lv80-black-centaurus-leveling-2026.html": "80레벨 검켄 사냥 효율",
}


class HubParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sections = []
        self.section = None
        self.heading = False
        self.links = []
        self.link = None
        self.viewport = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta" and attrs.get("name") == "viewport" and "initial-scale=1" in attrs.get("content", ""):
            self.viewport = True
        if tag == "section" and attrs.get("id") == "maple-planet-guides":
            self.section = {"label": attrs.get("aria-labelledby"), "heading_id": None, "heading": "", "links": []}
            self.sections.append(self.section)
        elif self.section is not None and tag == "h2":
            self.section["heading_id"] = attrs.get("id")
            self.heading = True
        elif self.section is not None and tag == "a":
            self.link = {"href": attrs.get("href"), "class": attrs.get("class", ""), "text": ""}
            self.section["links"].append(self.link)

    def handle_endtag(self, tag):
        if tag == "h2":
            self.heading = False
        elif tag == "a":
            self.link = None
        elif tag == "section" and self.section is not None:
            self.section = None

    def handle_data(self, data):
        if self.section is not None and self.heading:
            self.section["heading"] += data
        if self.link is not None:
            self.link["text"] += data


class TargetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonical = None
        self.title = ""
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href")
        elif tag == "title":
            self.in_title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


class TestMaplePlanetColumnHub(unittest.TestCase):
    def setUp(self):
        self.html = HUB.read_text(encoding="utf-8")
        self.parser = HubParser()
        self.parser.feed(self.html)

    def test_hub_has_one_accessibly_named_guide_section(self):
        self.assertEqual(len(self.parser.sections), 1)
        section = self.parser.sections[0]
        self.assertEqual(section["label"], "maple-planet-guides-title")
        self.assertEqual(section["heading_id"], section["label"])
        self.assertEqual(section["heading"].strip(), "메이플 플래닛 공략")

    def test_hub_links_each_existing_guide_once_with_descriptive_text(self):
        links = self.parser.sections[0]["links"]
        self.assertEqual({link["href"] for link in links}, set(GUIDES))
        self.assertEqual(len(links), len(GUIDES))
        for href, fragment in GUIDES.items():
            link = next(item for item in links if item["href"] == href)
            self.assertIn("col-card", link["class"].split())
            self.assertIn(fragment, link["text"])
            target = ROOT / href.lstrip("/")
            self.assertTrue(target.is_file(), href)
            metadata = TargetParser()
            metadata.feed(target.read_text(encoding="utf-8"))
            self.assertEqual(metadata.canonical, "https://emfls.github.io" + href)
            self.assertTrue(metadata.title.strip())

    def test_section_uses_existing_responsive_hub_contract(self):
        self.assertTrue(self.parser.viewport)
        start = self.html.index('id="maple-planet-guides"')
        end = self.html.index("</section>", start)
        section_html = self.html[start:end]
        self.assertIn("card-grid", section_html)
        self.assertIn("minmax(280px,1fr)", self.html)
        self.assertIn("padding:36px 20px", self.html)
        self.assertGreaterEqual(320 - 2 * 20, 280)


if __name__ == "__main__":
    unittest.main()
