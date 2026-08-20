import json
import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class _PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonical = ""
        self.robots = ""
        self.h1_count = 0

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "link" and "canonical" in values.get("rel", ""):
            self.canonical = values.get("href", "")
        if tag == "meta" and values.get("name") == "robots":
            self.robots = values.get("content", "")
        if tag == "h1":
            self.h1_count += 1


class FinanceDuplicateConsolidationTests(unittest.TestCase):
    PAIRS = (
        ("etf-recommendations-2025.html", "etf-recommendations-2026.html"),
        ("dividend-stocks-2025.html", "dividend-stocks-2026.html"),
    )

    def test_archived_2025_urls_point_to_indexable_2026_representatives(self):
        for archived, representative in self.PAIRS:
            with self.subTest(archived=archived):
                html = (ROOT / "kor/report/finance" / archived).read_text(encoding="utf-8")
                parser = _PageParser()
                parser.feed(html)
                expected = f"https://emfls.github.io/kor/report/finance/{representative}"
                self.assertEqual(parser.canonical, expected)
                self.assertEqual(parser.robots, "noindex,follow")
                self.assertIn(f'href="/{"kor/report/finance/" + representative}"', html)

    def test_representatives_use_current_review_date_and_official_sources(self):
        metadata = {
            item["url"]: item
            for item in json.loads((ROOT / "data/content-metadata.json").read_text(encoding="utf-8"))
        }
        for _, representative in self.PAIRS:
            with self.subTest(representative=representative):
                path = ROOT / "kor/report/finance" / representative
                html = path.read_text(encoding="utf-8")
                parser = _PageParser()
                parser.feed(html)
                url = f"/kor/report/finance/{representative}"
                self.assertEqual(parser.h1_count, 1)
                self.assertIn("2026-08-21", html)
                self.assertIn("https://www.investor.gov/", html)
                self.assertIn("https://dart.fss.or.kr/", html)
                self.assertIn("https://kind.krx.co.kr/", html)
                self.assertIn("googletagmanager.com/gtag/js", html)
                self.assertIn("pagead2.googlesyndication.com", html)
                self.assertEqual(metadata[url]["last_verified"], "2026-08-21")
                self.assertGreaterEqual(len(metadata[url]["sources"]), 2)

    def test_representatives_remove_unverified_live_rates_and_yields(self):
        etf = (ROOT / "kor/report/finance/etf-recommendations-2026.html").read_text(encoding="utf-8")
        dividend = (ROOT / "kor/report/finance/dividend-stocks-2026.html").read_text(encoding="utf-8")
        self.assertNotIn("연간 보수: 0.", etf)
        self.assertNotIn("배당수익률: 약", dividend)
        self.assertNotIn("62년 연속", dividend)
        self.assertNotIn("월 배당 리츠", dividend)


if __name__ == "__main__":
    unittest.main()
