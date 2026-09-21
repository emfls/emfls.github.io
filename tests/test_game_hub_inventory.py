from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree
import json

ROOT = Path(__file__).parents[1]
BASE = "https://emfls.github.io/game/"
CATEGORIES = {"Quick & Reflex", "Puzzle & Logic", "Classic & Board", "Action & Arcade", "Quiz & Knowledge"}


class HubParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.cards = []; self.card = None; self.anchor = None; self.category_span = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li" and "data-category" in attrs:
            self.card = {"category": attrs["data-category"], "anchors": []}
        if self.card and tag == "a" and "game-card" in attrs.get("class", "").split():
            self.anchor = {"href": attrs.get("href"), "classes": set(), "text": ""}; self.card["anchors"].append(self.anchor)
        if self.anchor and tag == "span" and "game-category" in attrs.get("class", "").split():
            self.category_span = {"text": ""}; self.anchor.setdefault("category_spans", []).append(self.category_span)
        if self.anchor and "class" in attrs:
            self.anchor["classes"].update(set(attrs["class"].split()) & {"game-title", "game-description", "game-category", "game-cta"})
    def handle_data(self, data):
        if self.anchor:
            self.anchor["text"] += data
            if self.category_span: self.category_span["text"] += data
    def handle_endtag(self, tag):
        if tag == "span" and self.category_span: self.category_span = None
        if tag == "a": self.anchor = None
        if tag == "li" and self.card: self.cards.append(self.card); self.card = None


def page_text(): return (ROOT / "game/index.html").read_text()
def parse_hub():
    parser = HubParser(); parser.feed(page_text()); return parser.cards
def repo_set(): return {f"{path.parent.name}/" for path in (ROOT / "game").glob("*/index.html")}
def sitemap_children():
    root = ElementTree.parse(ROOT / "game/sitemap.xml").getroot()
    urls = {loc.text for loc in root.iter() if loc.tag.endswith("loc")}
    return [url.removeprefix(BASE) for url in urls if url.startswith(BASE) and url != BASE]


def test_three_way_inventory_parity_and_no_duplicates():
    cards = parse_hub(); hub = {a["href"] for c in cards for a in c["anchors"]}
    repo, sitemap_list = repo_set(), sitemap_children(); sitemap = set(sitemap_list)
    assert len(repo) == len(sitemap_list) == len(hub) == 25
    assert len(sitemap_list) == len(sitemap) == 25
    assert repo == sitemap == hub
    assert "LadderGame/" in repo
    assert len([a["href"] for c in cards for a in c["anchors"]]) == len(hub)


def test_card_anchor_and_category_contract():
    cards = parse_hub(); expected = {"game-title", "game-description", "game-category", "game-cta"}
    assert {c["category"] for c in cards} == CATEGORIES
    assert all(len(c["anchors"]) == 1 for c in cards)
    assert all(c["anchors"][0]["classes"] == expected for c in cards)
    assert all(len(c["anchors"][0].get("category_spans", [])) == 1 for c in cards)
    assert all(c["anchors"][0]["category_spans"][0]["text"].strip() == c["category"] for c in cards)
    ladder = next(c for c in cards if c["anchors"][0]["href"] == "LadderGame/")
    assert ladder["category"] == "Classic & Board"
    assert "Pick a number" in ladder["anchors"][0]["text"] and "ladder" in ladder["anchors"][0]["text"].lower()


def test_filters_search_and_accessibility_structure():
    text = page_text(); start = text.index('<div class="filters"'); end = text.index('<ul id="gameList">')
    filters = text[start:end]
    assert filters.count('class="category-button"') == 6 and filters.count('type="button"') == 6
    assert filters.count('aria-pressed=') == 6 and 'aria-pressed="true"' in filters
    assert text.index("</div>", start) < text.index('<ul id="gameList">')
    assert 'for="searchInput"' in text and 'id="searchInput"' in text and 'aria-live="polite"' in text
    assert "onclick=\"launchGame" not in text and "user-select:none" not in text


def test_identity_trust_schema_and_measurement():
    text = page_text(); schema = json.loads(text.split('<script type="application/ld+json">', 1)[1].split('</script>', 1)[0])
    assert text.count("<h1>") == 1 and "Free Browser Games" in text
    assert "no download" in text.lower() and "no login" in text.lower() and "killing time" not in text.lower()
    assert "16-Type Personality Quiz" in text and "not the official MBTI" in text
    assert schema["@type"] == "CollectionPage" and schema["inLanguage"] == "en" and schema["dateModified"] == "2026-09-21"
    assert "FAQPage" not in text and "ItemList" not in text and "G-QP5Q67GE5B" in text and "adsbygoogle" not in text


def test_generated_rss_matches_page_metadata_exactly():
    class MetadataParser(HTMLParser):
        def __init__(self): super().__init__(); self.title = ""; self.description = ""; self.in_title = False
        def handle_starttag(self, tag, attrs):
            if tag == "title": self.in_title = True
            if tag == "meta" and dict(attrs).get("name") == "description": self.description = dict(attrs)["content"]
        def handle_endtag(self, tag):
            if tag == "title": self.in_title = False
        def handle_data(self, data):
            if self.in_title: self.title += data
    metadata = MetadataParser(); metadata.feed(page_text())
    title, description = metadata.title, metadata.description
    items = [item for item in ElementTree.parse(ROOT / "feed.xml").getroot().iter("item") if item.findtext("link") == BASE]
    assert len(items) == 1; item = items[0]
    assert item.findtext("title") == title and item.findtext("description") == description
    assert item.findtext("guid") == BASE and item.findtext("pubDate") == "Mon, 21 Sep 2026 00:00:00 +0000"
