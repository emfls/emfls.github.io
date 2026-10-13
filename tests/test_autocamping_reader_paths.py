"""Regressions for public URL identity and camping reader destinations."""
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'kor/report/camp/오토캠핑.html'


class Links(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.canonical = ''
        self.og_url = ''
        self.destinations = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a.get('href')
        if tag == 'meta' and a.get('property') == 'og:url':
            self.og_url = a.get('content')
        if tag == 'a':
            self.destinations.append(a.get('href', ''))


class AutocampingReaderPathsTests(unittest.TestCase):
    def test_shared_url_resolves_to_the_same_exact_path_as_canonical(self):
        page = Links(SOURCE.read_text())
        self.assertEqual(unquote(urlsplit(page.og_url).path), unquote(urlsplit(page.canonical).path))

    def test_regional_destinations_exist_and_preserve_their_own_canonicals(self):
        page = Links(SOURCE.read_text())
        expected = {'/kor/report/camp/gyeonggi-best.html', '/kor/report/camp/pyeongtaek.html', '/kor/report/camp/suwon.html'}
        linked = {unquote(urlsplit(href).path) for href in page.destinations}
        self.assertTrue(expected.issubset(linked), expected - linked)
        for route in expected:
            target = ROOT / route.lstrip('/')
            self.assertTrue(target.is_file(), route)
            self.assertEqual(urlsplit(Links(target.read_text()).canonical).path, route)


if __name__ == '__main__':
    unittest.main()
