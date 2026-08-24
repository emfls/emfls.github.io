from html.parser import HTMLParser
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/uzbekistan.html"


class VisaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.checks = 0
        self.links = []
        self.in_json_ld = False
        self.json_ld = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li" and "data-entry-check" in attrs:
            self.checks += 1
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json_ld = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json_ld = False

    def handle_data(self, data):
        if self.in_json_ld and data.strip():
            self.json_ld.append(json.loads(data))


class UzbekistanVisaRevenuePageTest(unittest.TestCase):
    def setUp(self):
        self.html = PAGE.read_text(encoding="utf-8")
        self.parser = VisaParser()
        self.parser.feed(self.html)

    def test_prioritizes_current_korean_traveler_decision_and_checks(self):
        self.assertIn("대한민국 일반여권", self.html)
        self.assertIn("30일 무비자", self.html)
        self.assertIn("근무일 기준 3일", self.html)
        self.assertGreaterEqual(self.parser.checks, 6)
        for stale_claim in ("101개국", "고속 프로세싱", "초고속 프로세싱"):
            self.assertNotIn(stale_claim, self.html)

    def test_links_primary_sources_and_preserves_site_contracts(self):
        for link in (
            "https://overseas.mofa.go.kr/uz-ko/brd/m_8580/view.do?page=1&seq=1333713",
            "https://gov.uz/en/mfa/pages/o-zbekiston-respublikasi-vizasi",
            "https://e-visa.gov.uz/",
            "/kor/report/visa/",
        ):
            self.assertIn(link, self.parser.links)
        self.assertTrue(
            any(
                item.get("@type") == "WebPage"
                and item.get("dateModified") == "2026-08-24"
                for item in self.parser.json_ld
            )
        )
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertIn("ca-pub-8830524482034754", self.html)


if __name__ == "__main__":
    unittest.main()
