import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


PAGE = Path(__file__).resolve().parents[1] / "kor/report/visa/northmacedonia.html"
CANONICAL = "https://emfls.github.io/kor/report/visa/northmacedonia.html"


class VisaPageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.canonical = ""
        self.links = []
        self.json_ld = []
        self._in_title = False
        self._anchor_href = None
        self._anchor_text = []
        self._json_buffer = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href", "")
        elif tag == "a":
            self._anchor_href = values.get("href", "")
            self._anchor_text = []
        elif tag == "script" and values.get("type") == "application/ld+json":
            self._json_buffer = []

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._anchor_href is not None:
            self._anchor_text.append(data)
        if self._json_buffer is not None:
            self._json_buffer.append(data)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "a" and self._anchor_href is not None:
            self.links.append((self._anchor_href, " ".join(self._anchor_text).strip()))
            self._anchor_href = None
            self._anchor_text = []
        elif tag == "script" and self._json_buffer is not None:
            self.json_ld.append(json.loads("".join(self._json_buffer)))
            self._json_buffer = None


class NorthMacedoniaVisaPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", cls.html)).strip()
        cls.parser = VisaPageParser()
        cls.parser.feed(cls.html)

    def test_search_result_answers_korean_passport_intent(self):
        self.assertEqual(
            self.parser.title,
            "북마케도니아 비자: 한국 여권 90일 무비자·장기체류 안내",
        )
        self.assertEqual(self.parser.canonical, CANONICAL)
        self.assertIn("180일 내 최대 90일", self.text)

    def test_measurement_and_existing_interactions_remain(self):
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertIn("ca-pub-8830524482034754", self.html)
        self.assertIn('id="searchInput"', self.html)
        self.assertIn("function toggleFAQ(element)", self.html)

    def test_official_sources_and_freshness_are_present(self):
        self.assertIn("최근 확인: 2026-08-02", self.text)
        hrefs = {href for href, _ in self.parser.links}
        self.assertIn("https://0404.go.kr/ntnSafetyInfo/368/detail", hrefs)
        self.assertIn(
            "https://mfa.gov.mk/en-GB/konzularni-uslugi/vidovi-vizi-za-vlez-vo-rsm",
            hrefs,
        )
        self.assertIn(
            "https://mvr.gov.mk/en-GB/uslugi/upatstvo-i-postapka-za-oddelni-prava-baranja-na-strancite",
            hrefs,
        )

    def test_unsupported_or_misleading_claims_are_absent(self):
        for phrase in (
            "완벽 가이드",
            "1년 단위 최대 90일",
            "여행자보험 가입 필수",
            "단기 취업 (90일 이하)",
            "보통 15일 이내",
        ):
            with self.subTest(phrase=phrase):
                self.assertNotIn(phrase, self.text)
        self.assertFalse(
            any(document.get("@type") == "SearchAction" for document in self.parser.json_ld)
        )

    def test_json_ld_describes_the_published_page(self):
        page = next(
            document
            for document in self.parser.json_ld
            if document.get("@type") == "WebPage"
        )
        self.assertEqual(page["url"], CANONICAL)
        self.assertEqual(page["dateModified"], "2026-08-02")


if __name__ == "__main__":
    unittest.main()
