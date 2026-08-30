import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/busan.html"


class BusanCampingPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser(); cls.page.feed(cls.html)

    def test_answers_booking_intent(self):
        for phrase in ("부산 노지캠핑", "예약", "공식"):
            self.assertIn(phrase, self.page.title + self.page.h1 + self.page.meta["description"])
        for name in ("삼락", "화명", "부산항", "영도"):
            self.assertIn(name, self.html)

    def test_keeps_measurement_and_interactions(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/camp/busan.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterCamps", "function toggleFAQ"):
            self.assertIn(marker, self.html)

    def test_uses_current_official_sources(self):
        official = [a for a in self.page.links if "busan.go.kr" in a.get("href", "")]
        self.assertGreaterEqual(len(official), 6)
        self.assertIn("2026-08-13", self.html)

    def test_structured_data_and_mobile_ads_are_safe(self):
        self.assertEqual({x.get("@type") for x in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertEqual(sum(x.get("@type") == "WebPage" for x in self.page.json_ld), 1)
        self.assertIn('div[id^="aswift_"]', self.html)
        self.assertIn("max-width:100% !important", self.html)

    def test_links_to_geographically_relevant_camp_guides(self):
        hrefs = {a.get("href") for a in self.page.links}
        for href in ("ulsan.html", "gyeongnam-best.html", "yangsan.html", "gimhae.html"):
            self.assertIn(href, hrefs)

    def test_removes_unsupported_wild_camping_claims(self):
        for phrase in ("무료 노지 캠핑장", "오륙도 스카이워크 차박", "천성항 캠핑", "다대포 해수욕장 차박", "암남공원 캠핑"):
            self.assertNotIn(phrase, self.html)


if __name__ == "__main__": unittest.main()
