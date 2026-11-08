import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ('maple-planet-bishop-4th-skill-quest-guide-2026', 'maple-planet-no-capital-rice-farming-2026', 'mapleland-bishop-free-leveling-guide-2026')


class HTML(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.loaders, self.units, self.links, self.ids = [], [], [], []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'script' and '/adsbygoogle.js' in a.get('src', ''):
            self.loaders.append(a['src'])
        if tag == 'ins' and 'adsbygoogle' in a.get('class', '').split():
            self.units.append(a)
        if tag == 'a':
            self.links.append(a.get('href', ''))
        if a.get('id'):
            self.ids.append(a['id'])


class MapleReaderRecoveryTest(unittest.TestCase):
    def test_one_loader_preserves_the_existing_manual_unit(self):
        for name in PAGES:
            with self.subTest(page=name):
                html = (ROOT / 'kor/column' / (name + '.html')).read_text()
                parsed = HTML(html)
                self.assertEqual(len(parsed.loaders), 1)
                self.assertEqual(len(parsed.units), 1)
                self.assertEqual(parsed.units[0]['data-ad-slot'], '5182890312')
                self.assertEqual(html.count('(adsbygoogle=window.adsbygoogle||[]).push({});'), 1)

    def test_query_answer_is_early_and_jump_links_resolve(self):
        html = (ROOT / 'kor/column/maple-planet-no-capital-rice-farming-2026.html').read_text()
        parsed = HTML(html)
        self.assertIn('id="quick-answer"', html)
        self.assertLess(html.index('id="quick-answer"'), html.index('메이플 플래닛은 MapleStory Worlds'))
        for target in ('rmt-policy', 'meso-net'):
            self.assertIn('#' + target, parsed.links)
            self.assertEqual(parsed.ids.count(target), 1)
        self.assertIn('미판매 아이템', html)
        self.assertIn('입장료', html)
        self.assertIn('정비', html)
        self.assertIn('현금거래', html)
        self.assertIn('https://mapleplanet.co.kr/policy/mapleplanet', parsed.links)


if __name__ == '__main__':
    unittest.main()
