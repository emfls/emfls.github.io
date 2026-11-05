"""Homepage metadata and navigation invariants for the Next-T SEO remediation."""
from html.parser import HTMLParser
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


class HeadParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.links = []
        self.title_count = 0
        self.in_title = False
        self.titles = []
        self.h1_count = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self.title_count += 1
            self.in_title = True
        elif tag == "meta":
            key = a.get("property") or a.get("name")
            if key:
                self.meta.setdefault(key, []).append(a.get("content", ""))
        elif tag == "link":
            self.links.append(a)
        elif tag == "h1":
            self.h1_count += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.titles.append(data)


class HomepageSeoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = HTML.read_text(encoding="utf-8")
        cls.head = HeadParser()
        cls.head.feed(cls.source)

    def test_one_title_one_h1_and_keyword_scope(self):
        self.assertEqual(self.head.title_count, 1)
        self.assertEqual(self.head.h1_count, 1)
        self.assertIn("IT", "".join(self.head.titles))
        self.assertIn("캠핑", "".join(self.head.titles))
        self.assertIn("자동차", "".join(self.head.titles))

    def test_og_tags_match_site_metadata_and_real_image(self):
        m = self.head.meta
        required = ("og:type", "og:locale", "og:site_name", "og:url",
                    "og:title", "og:description", "og:image", "og:image:alt")
        for key in required:
            self.assertEqual(len(m.get(key, [])), 1, key)
            self.assertTrue(m[key][0].strip(), key)
        self.assertEqual(m["og:type"][0], "website")
        self.assertEqual(m["og:url"][0], "https://emfls.github.io/")
        self.assertEqual(m["og:title"][0], "".join(self.head.titles))
        self.assertIn("IT", m["og:description"][0])
        image = m["og:image"][0]
        self.assertTrue(image.startswith("https://emfls.github.io/"))
        self.assertTrue((ROOT / image.removeprefix("https://emfls.github.io/")).is_file())
        self.assertEqual(m["twitter:image"][0], image)

    def test_preconnect_only_to_referenced_external_origin(self):
        preconnect = [
            link["href"] for link in self.head.links
            if "preconnect" in link.get("rel", "").split()
        ]
        self.assertEqual(preconnect, ["https://www.googletagmanager.com"])
        self.assertIn('src="https://www.googletagmanager.com/gtag/js?', self.source)

    def test_static_notions_and_analytics_preserved(self):
        self.assertEqual(self.source.count("<!-- notion-discovery:start -->"), 1)
        self.assertEqual(self.source.count("<!-- notion-discovery:end -->"), 1)
        self.assertIn("G-QP5Q67GE5B", self.source)
        self.assertIn("ca-pub-8830524482034754", self.source)
        self.assertIn('<link rel="canonical" href="https://emfls.github.io/"', self.source)
        self.assertIn("google-site-verification", self.source)
        self.assertIn("naver-site-verification", self.source)
        for route in ("/kor/report/camp/", "/kor/report/travel/",
                      "/kor/report/it/", "/kor/report/car/", "/kor/report/gov/"):
            self.assertIn(route, self.source)

    def test_home_feed_failure_does_not_erase_static_links(self):
        self.assertNotIn('document.querySelectorAll(".feed-grid").forEach(node=>node.innerHTML=', self.source)
        self.assertIn('["latest-feed","feed-camping"', self.source)


if __name__ == "__main__":
    unittest.main()
