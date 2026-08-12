import re
import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/andong.html"


class AndongCampingPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_answers_booking_intent(self):
        for phrase in ("안동 캠핑장", "단호샌드파크", "예약"):
            self.assertIn(phrase, cls_value := self.page.title)
        self.assertIn("안동 캠핑장", self.page.h1)
        self.assertIn("공식", self.page.meta["description"])

    def test_keeps_seo_and_measurement_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/camp/andong.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "2026-08-12"):
            self.assertIn(marker, self.html)

    def test_uses_official_sources_and_current_status(self):
        official = [a for a in self.page.links if "gocamping.or.kr" in a.get("href", "") or "andong.go.kr" in a.get("href", "")]
        self.assertGreaterEqual(len(official), 5)
        self.assertIn("현재 휴업 중", self.html)

    def test_structured_data_and_mobile_contract(self):
        types = {block.get("@type") for block in self.page.json_ld}
        self.assertIn("WebPage", types)
        self.assertIn("FAQPage", types)
        self.assertRegex(self.html, re.compile(r"minmax\(min\(100%,\s*280px\),\s*1fr\)"))
        self.assertIn('div[id^="aswift_"]', self.html)
        self.assertIn("max-width:100% !important", self.html)
        self.assertNotIn("position: fixed", self.html)

    def test_removes_unsupported_wild_camping_claims(self):
        for phrase in ("완전무료", "무료 베스트", "차박성지", "무료 이용 가능", "차박하기 좋은 환경"):
            self.assertNotIn(phrase, self.html)


if __name__ == "__main__":
    unittest.main()
