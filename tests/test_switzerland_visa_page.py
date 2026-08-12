import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


PAGE = Path(__file__).resolve().parents[1] / "kor/report/visa/switzerland.html"
CANONICAL = "https://emfls.github.io/kor/report/visa/switzerland.html"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.canonical = ""
        self.links = []
        self.json_ld = []
        self._in_title = False
        self._href = None
        self._anchor = []
        self._json = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href", "")
        elif tag == "a":
            self._href = values.get("href", "")
            self._anchor = []
        elif tag == "script" and values.get("type") == "application/ld+json":
            self._json = []

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._href is not None:
            self._anchor.append(data)
        if self._json is not None:
            self._json.append(data)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "a" and self._href is not None:
            self.links.append((self._href, " ".join(self._anchor).strip()))
            self._href = None
            self._anchor = []
        elif tag == "script" and self._json is not None:
            self.json_ld.append(json.loads("".join(self._json)))
            self._json = None


class SwitzerlandVisaPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", cls.html)).strip()
        cls.parser = PageParser()
        cls.parser.feed(cls.html)

    def test_search_result_answers_korean_passport_intent(self):
        self.assertEqual(
            self.parser.title,
            "스위스 비자: 한국 여권 90일 무비자·ETIAS·취업 안내",
        )
        self.assertEqual(self.parser.canonical, CANONICAL)
        self.assertIn("180일 내 최대 90일", self.text)

    def test_etias_status_is_current_and_bounded(self):
        self.assertIn("2026년 4분기 운영 예정", self.text)
        self.assertIn("현재 신청할 필요가 없습니다", self.text)
        self.assertIn("구체적인 시행일은 발표되지 않았습니다", self.text)

    def test_measurement_and_interactions_remain(self):
        for marker in (
            "G-QP5Q67GE5B",
            "ca-pub-8830524482034754",
            'id="searchInput"',
            "function toggleFAQ(element)",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.html)

    def test_official_sources_and_freshness_are_present(self):
        self.assertIn("최근 확인: 2026-08-12", self.text)
        hrefs = {href for href, _ in self.parser.links}
        for href in (
            "https://www.schweiz-republikkorea.eda.admin.ch/en/do-i-need-a-schengen-visa",
            "https://travel-europe.europa.eu/en/etias",
            "https://www.sem.admin.ch/sem/en/home/overview-arbeit.html",
            "https://www.sem.admin.ch/sem/en/home/themen/arbeit/nicht-eu_efta-angehoerige.html",
        ):
            with self.subTest(href=href):
                self.assertIn(href, hrefs)

    def test_misleading_claims_are_absent(self):
        for phrase in (
            "완벽 가이드",
            "2025년부터 ETIAS",
            "보통 10-15일",
            "1-2개월",
            "스위스에서 10년 이상",
        ):
            with self.subTest(phrase=phrase):
                self.assertNotIn(phrase, self.text)
        self.assertFalse(
            any(item.get("@type") == "SearchAction" for item in self.parser.json_ld)
        )

    def test_json_ld_describes_this_page(self):
        page = next(
            item for item in self.parser.json_ld if item.get("@type") == "WebPage"
        )
        self.assertEqual(page["url"], CANONICAL)
        self.assertEqual(page["dateModified"], "2026-08-12")


if __name__ == "__main__":
    unittest.main()
