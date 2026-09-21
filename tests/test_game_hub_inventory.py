from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).parents[1]
CATEGORIES = {"Quick & Reflex", "Puzzle & Logic", "Classic & Board", "Action & Arcade", "Quiz & Knowledge"}

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.cards=[]; self.card=None
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag == "li" and "data-category" in a: self.card={"href":None,"category":a["data-category"],"classes":set()}
        if self.card and tag == "a" and "game-card" in a.get("class","").split(): self.card["href"]=a.get("href")
        if self.card and "class" in a: self.card["classes"].update(set(a["class"].split()) & {"game-title","game-description","game-category","game-cta"})
    def handle_endtag(self, tag):
        if tag == "li" and self.card: self.cards.append(self.card); self.card=None

def parse():
    p=Parser(); p.feed((ROOT/"game/index.html").read_text()); return p

def test_hub_has_exact_repo_inventory_and_static_cards():
    repo={x.parent.name for x in (ROOT/"game").glob("*/index.html")}; cards=parse().cards
    assert len(repo) == len(cards) == 25
    assert {c["href"] for c in cards} == {f"{name}/" for name in repo}
    assert "LadderGame/" in {c["href"] for c in cards}

def test_cards_and_discovery_contract():
    text=(ROOT/"game/index.html").read_text(); cards=parse().cards
    assert {c["category"] for c in cards} == CATEGORIES
    assert all(c["classes"] == {"game-title","game-description","game-category","game-cta"} for c in cards)
    assert "onclick=\"launchGame" not in text and "user-select:none" not in text and "killing time" not in text.lower()
    assert text.count('class="category-button"') == 6 and 'aria-live="polite"' in text and 'for="searchInput"' in text

def test_identity_trust_schema_and_measurement():
    text=(ROOT/"game/index.html").read_text()
    assert text.count("<h1>") == 1 and "Free Browser Games" in text
    assert "no download" in text.lower() and "no login" in text.lower()
    assert "16-Type Personality Quiz" in text and "not the official MBTI" in text
    assert text.count('"@type":"CollectionPage"') == 1 and "FAQPage" not in text and "ItemList" not in text
    assert '"dateModified":"2026-09-21"' in text and '"inLanguage":"en"' in text
    assert "G-QP5Q67GE5B" in text and "adsbygoogle" not in text

def test_generated_rss_matches_hub_metadata():
    feed=(ROOT/"feed.xml").read_text()
    assert "<link>https://emfls.github.io/game/</link>" in feed
    assert "<title>Free Browser Games – No Download, No Login | QuickPlay</title>" in feed
    assert "Play 25 free browser games with no download or login." in feed
