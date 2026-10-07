import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
HUB = ROOT / "kor/report/travel/index.html"
CANONICAL = "https://emfls.github.io/kor/report/travel/"


class HubParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.anchors = []
        self.canonical = ""
        self.description = ""
        self.h1 = []
        self.json_ld = []
        self.title = ""
        self._capture = None
        self._buffer = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "a" and values.get("href"):
            self.anchors.append(values["href"])
        elif tag == "link" and "canonical" in values.get("rel", ""):
            self.canonical = values.get("href", "")
        elif tag == "meta" and values.get("name") == "description":
            self.description = values.get("content", "")
        if tag in {"title", "h1"}:
            self._capture = tag
            self._buffer = []
        elif tag == "script" and values.get("type") == "application/ld+json":
            self._capture = "json"
            self._buffer = []

    def handle_data(self, data):
        if self._capture:
            self._buffer.append(data)

    def handle_endtag(self, tag):
        if self._capture == tag:
            text = "".join(self._buffer).strip()
            if tag == "title":
                self.title = text
            else:
                self.h1.append(text)
            self._capture = None
        elif tag == "script" and self._capture == "json":
            self.json_ld.append(json.loads("".join(self._buffer)))
            self._capture = None


def parse_hub():
    html = HUB.read_text(encoding="utf-8")
    parser = HubParser()
    parser.feed(html)
    return html, parser


def local_target(href):
    path = urlparse(href).path.lstrip("/")
    target = ROOT / path
    return target / "index.html" if href.endswith("/") else target


def test_travel_hub_is_a_compact_search_intent_page_not_a_bulk_directory():
    html, page = parse_hub()
    internal_destinations = {
        href for href in page.anchors if href.startswith("/kor/") and "#" not in href
    }

    assert 10_000 <= len(html.encode("utf-8")) <= 80_000
    assert 30 <= len(internal_destinations) <= 50
    assert all(local_target(href).is_file() for href in internal_destinations)


def test_travel_hub_preserves_seo_measurement_ads_and_accessible_html_links():
    html, page = parse_hub()

    assert page.title == "한국어 여행 정보 허브 | 여행 준비·국가별 가이드"
    assert page.h1 == ["한국어 여행 정보 허브"]
    assert 70 <= len(page.description) <= 160
    assert page.canonical == CANONICAL
    assert 'name="viewport"' in html
    assert "G-QP5Q67GE5B" in html
    assert "ca-pub-8830524482034754" in html
    assert "여행 준비부터 시작하기" in html
    assert "국가·지역별 여행 가이드" in html
    assert "목적에 맞춰 고르기" in html
    assert "최근 점검·주요 콘텐츠" in html


def test_travel_hub_structured_data_describes_collection_and_visible_items():
    _, page = parse_hub()
    schemas = {item.get("@type"): item for item in page.json_ld}

    assert {"CollectionPage", "ItemList"} <= schemas.keys()
    assert schemas["CollectionPage"]["url"] == CANONICAL
    items = schemas["ItemList"]["itemListElement"]
    assert 8 <= len(items) <= 20
    assert [item["position"] for item in items] == list(range(1, len(items) + 1))
    visible_urls = {urlparse(href).path for href in page.anchors}
    assert all(urlparse(item["url"]).path in visible_urls for item in items)


def test_travel_inventory_remains_discoverable_without_rendering_every_link_in_hub():
    sitemap = ET.parse(ROOT / "kor/report/travel/sitemap.xml")
    sitemap_urls = {
        node.text for node in sitemap.iter() if node.tag.endswith("loc") and node.text
    }
    content_index = json.loads(
        (ROOT / "data/content-index-ko.json").read_text(encoding="utf-8")
    )
    indexed_travel_urls = {
        row["url"]
        for row in content_index
        if row.get("url", "").startswith("/kor/report/travel/")
    }
    hub_row = next(
        row for row in content_index if row.get("url") == "/kor/report/travel/index.html"
    )

    assert CANONICAL in sitemap_urls
    assert len(sitemap_urls) >= 5_000
    assert len(indexed_travel_urls) >= 5_000
    assert hub_row["title"] == "한국어 여행 정보 허브 | 여행 준비·국가별 가이드"
    assert hub_row["updated_at"] == "2026-09-13"
    for path in (
        "/kor/report/travel/japan-tokyo.html",
        "/kor/report/travel/thailand-bangkok.html",
        "/kor/report/travel/france-paris.html",
        "/kor/report/travel/australia-sydney.html",
    ):
        assert "https://emfls.github.io" + path in sitemap_urls
        assert path in indexed_travel_urls
