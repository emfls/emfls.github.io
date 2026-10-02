import json
import re
import subprocess
import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/travel/october-korea-travel-2026.html"
URL = "https://emfls.github.io/kor/report/travel/october-korea-travel-2026.html"


def committed_launch_manifest():
    result = subprocess.run(
        ["git", "show", "HEAD:data/content-launch-manifest.json"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


class DocumentParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = []
        self.h1 = []
        self.meta = {}
        self.canonical = []
        self.links = []
        self.json_ld = []
        self._capture = None
        self._json = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self._capture = "title"
        elif tag == "h1":
            self._capture = "h1"
        elif tag == "meta":
            name = attrs.get("name") or attrs.get("property")
            if name:
                self.meta[name] = attrs.get("content", "")
        elif tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs.get("href", ""))
        elif tag == "a":
            self.links.append(attrs.get("href", ""))
        elif tag == "script" and attrs.get("type") == "application/ld+json":
            self._json = True
            self._capture = "json"

    def handle_endtag(self, tag):
        if tag in {"title", "h1"}:
            self._capture = None
        elif tag == "script" and self._json:
            self._json = False
            self._capture = None

    def handle_data(self, data):
        if self._capture == "title":
            self.title.append(data)
        elif self._capture == "h1":
            self.h1.append(data)
        elif self._capture == "json":
            self.json_ld.append(data)


class OctoberKoreaTravelLaunchTest(unittest.TestCase):
    def test_page_is_public_indexable_and_source_backed(self):
        self.assertTrue(PAGE.is_file(), "October travel launch page is missing")
        html = PAGE.read_text(encoding="utf-8")
        parser = DocumentParser()
        parser.feed(html)

        self.assertEqual("".join(parser.title), "2026년 10월 국내 여행지 추천: 축제 일정과 단풍 시기 고르는 법")
        self.assertEqual("".join(parser.h1), "2026년 10월 국내 여행지 추천: 축제 일정과 단풍 시기 고르는 법")
        self.assertIn("10월 여행 날짜", parser.meta.get("description", ""))
        self.assertEqual(parser.canonical, [URL])
        self.assertEqual(parser.meta.get("robots"), "index,follow")
        self.assertNotIn("PREP ONLY", html)
        self.assertNotIn("noindex", html)
        self.assertIn("G-QP5Q67GE5B", html)
        self.assertIn("ca-pub-8830524482034754", html)

        structured_data = [json.loads(value) for value in parser.json_ld]
        self.assertEqual(len(structured_data), 1)
        self.assertEqual(structured_data[0]["@type"], "Article")
        self.assertEqual(structured_data[0]["mainEntityOfPage"], URL)
        self.assertEqual(structured_data[0]["dateModified"], "2026-10-02")

        self.assertIn("자료 확인일: 2026년 10월 2일", html)
        self.assertNotIn("2026년 10월 1일", html)
        self.assertIn("10월 1~5일", html)
        self.assertIn("10월 3~11일", html)
        self.assertIn("10월 7~11일", html)
        self.assertIn("10월 9~11일", html)
        self.assertIn("10월 15~18일", html)
        self.assertIn("주요 수종의 단풍이 50% 이상", html)
        self.assertEqual(html.count("korean.visitkorea.or.kr/kfes/detail/"), 5)
        self.assertIn("2026 단풍 지도와 관측 기준 보기", html)
        self.assertIn("변동될 수 있다고 안내", html)

        internal_links = [href for href in parser.links if href.startswith("/")]
        self.assertGreaterEqual(len(internal_links), 2)
        for href in internal_links:
            target = ROOT / href.lstrip("/")
            if href.endswith("/"):
                target = target / "index.html"
            self.assertTrue(target.is_file(), f"Broken internal link: {href}")

        self.assertIn('name="viewport"', html)
        self.assertRegex(html, re.compile(r"@media\s*\(max-width:\s*640px\)"))

    def test_publication_wiring_and_launch_manifest_are_exact(self):
        relative_url = "/kor/report/travel/october-korea-travel-2026.html"
        canonical = "https://emfls.github.io" + relative_url
        hub = (ROOT / "kor/report/travel/index.html").read_text(encoding="utf-8")
        self.assertEqual(hub.count(f'href="{relative_url}"'), 1)

        travel_sitemap = (ROOT / "kor/report/travel/sitemap.xml").read_text(encoding="utf-8")
        kor_sitemap = (ROOT / "kor/sitemap.xml").read_text(encoding="utf-8")
        sitemap_index = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertEqual(travel_sitemap.count(canonical), 1)
        self.assertEqual(kor_sitemap.count(canonical), 1)
        self.assertEqual(sitemap_index.count("https://emfls.github.io/kor/report/travel/sitemap.xml"), 1)
        self.assertEqual(sitemap_index.count("https://emfls.github.io/kor/sitemap.xml"), 1)

        search_index = json.loads((ROOT / "data/content-index-ko.json").read_text(encoding="utf-8"))
        matching_index = [row for row in search_index if row["url"] == relative_url]
        self.assertEqual(len(matching_index), 1)
        self.assertEqual(matching_index[0]["category"], "여행")
        home_feed = json.loads((ROOT / "data/home-feed-ko.json").read_text(encoding="utf-8"))
        self.assertEqual(home_feed["latest"][0]["url"], relative_url)

        manifest = committed_launch_manifest()
        self.assertEqual(manifest["candidateIds"], ["keyword:10월여행지추천"])
        self.assertEqual(manifest["contentPaths"], ["kor/report/travel/october-korea-travel-2026.html"])
        self.assertEqual(manifest["hubPaths"], ["kor/report/travel/index.html"])
        self.assertEqual(manifest["sitemapPaths"], ["kor/report/travel/sitemap.xml", "kor/sitemap.xml"])
        self.assertEqual(manifest["urls"], [relative_url])
        self.assertEqual(manifest["status"], "PUBLISHED")
        self.assertEqual(manifest["publishedToday"], 1)
        self.assertEqual(manifest["dailyLimit"], 1)
        self.assertEqual(manifest["remainingCapacity"], 0)
        self.assertRegex(manifest["runAt"], r"^2026-10-02T\d{2}:\d{2}:\d{2}\+09:00$")
        self.assertEqual(manifest["runId"], "P0-20261002-OCTOBER-KOREA-TRAVEL")


if __name__ == "__main__":
    unittest.main()
