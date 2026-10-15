"""Release integration checks; copied to the content branch after trusted intake."""
import json
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import unittest
from urllib.parse import urljoin
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
PATH = 'kor/report/it/kanana-space-pre-registration-guide.html'
URL = 'https://emfls.github.io/' + PATH
BASE = 'd4135f1bb890335a9d2143dbd2a1a0fcee23fc98'


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tags = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


def versioned_manifest():
    # This release-history assertion targets the immutable checked-in pre-migration baseline.
    return json.loads(subprocess.check_output(["git", "show", "HEAD:data/content-launch-manifest.json"], cwd=ROOT))


def history(record):
    yield record
    for child in record.get('preservedManifestRecords', []):
        yield from history(child)


class KananaPublication(unittest.TestCase):
    def test_public_article_is_indexable_with_approved_site_measurement(self):
        html = (ROOT / PATH).read_text(encoding='utf-8')
        tags = Document(html).tags
        canonical = [attrs['href'] for tag, attrs in tags if tag == 'link' and attrs.get('rel') == 'canonical']
        robots = [attrs['content'] for tag, attrs in tags if tag == 'meta' and attrs.get('name') == 'robots']
        scripts = [attrs.get('src', '') for tag, attrs in tags if tag == 'script']
        self.assertEqual(canonical, [URL])
        self.assertEqual(robots, ['index,follow'])
        self.assertEqual(sum(tag == 'h1' for tag, _ in tags), 1)
        self.assertIn('https://www.googletagmanager.com/gtag/js?id=G-QP5Q67GE5B', scripts)
        self.assertIn('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8830524482034754', scripts)
        self.assertNotIn('app.notion.com', html)
        self.assertNotIn('/private/tmp', html)

    def test_hub_leaf_and_root_sitemap_connect_the_article(self):
        hub = Document((ROOT / 'kor/report/it/index.html').read_text(encoding='utf-8'))
        links = [urljoin('https://emfls.github.io/kor/report/it/', attrs['href']) for tag, attrs in hub.tags if tag == 'a' and 'href' in attrs]
        self.assertIn(URL, links)
        ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        leaf = ElementTree.parse(ROOT / 'kor/report/it/sitemap.xml')
        self.assertEqual([node.text for node in leaf.findall('.//sm:loc', ns)].count(URL), 1)
        root = ElementTree.parse(ROOT / 'sitemap.xml')
        self.assertIn('https://emfls.github.io/kor/report/it/sitemap.xml', [node.text for node in root.findall('.//sm:loc', ns)])

    def test_release_keeps_the_complete_previous_manifest_and_cap(self):
        previous = json.loads(subprocess.check_output(['git', 'show', BASE + ':data/content-launch-manifest.json'], cwd=ROOT))
        manifest = versioned_manifest()
        records = list(history(manifest))
        self.assertIn(previous, records)
        release = [row for row in records if row.get('candidateIds') == ['EXT-20261014-KANANA-SPACE']]
        self.assertEqual(len(release), 1)
        self.assertEqual(release[0]['contentPaths'], [PATH])
        self.assertEqual(release[0]['dailyLimit'], 3)
        self.assertEqual(release[0]['demandStatus'], 'ESTIMATED')


if __name__ == '__main__':
    unittest.main()
