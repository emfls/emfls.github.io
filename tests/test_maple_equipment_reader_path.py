from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTICLE = ROOT / 'kor/column/maple-planet-equip-setup-guide-2026.html'


class NextGuides(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'aside' and attrs.get('aria-labelledby') == 'equipment-next-title':
            self.inside = True
        if self.inside and tag == 'a':
            self.links.append(attrs.get('href', ''))

    def handle_endtag(self, tag):
        if tag == 'aside':
            self.inside = False


def test_equipment_next_steps_lead_to_existing_same_game_guides():
    parser = NextGuides()
    parser.feed(ARTICLE.read_text())
    assert len(parser.links) == 3
    assert len(set(parser.links)) == 3
    for href in parser.links:
        assert href.startswith('/kor/column/maple-planet-')
        target = ROOT / href.lstrip('/')
        assert target.is_file()
        content = target.read_text()
        assert f'<link rel="canonical" href="https://emfls.github.io{href}"' in content
        assert '메이플 플래닛' in content
