import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/cheondong-auto-camping.html"
CANONICAL = "https://emfls.github.io/kor/report/camp/cheondong-auto-camping.html"


class CheondongAutoCampingPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_answers_booking_intent_with_current_official_facts(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        self.assertIn("천동오토캠핑장", combined)
        for fact in ("인터넷 예약", "35,000원", "14시", "익일 11시", "5인", "1차량"):
            self.assertIn(fact, self.html)

    def test_uses_official_operator_and_booking_sources(self):
        for url in ("https://www.dytc.or.kr/main/44", "https://camp.dytc.or.kr/"):
            self.assertIn(url, self.html)
        for safeguard in ("실시간 예약 화면", "예약 가능 여부를 보장하지 않습니다", "2026-08-13"):
            self.assertIn(safeguard, self.html)

    def test_keeps_search_measurement_and_ad_contract(self):
        self.assertEqual(self.page.canonical, CANONICAL)
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertIn("ca-pub-8830524482034754", self.html)
        self.assertIn('data-ad-format="auto"', self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"WebPage", "FAQPage"})

    def test_relevant_hubs_link_to_the_page(self):
        for relative in ("kor/report/camp/index.html", "kor/report/camp/danyang.html"):
            source = (ROOT / relative).read_text(encoding="utf-8")
            self.assertIn("cheondong-auto-camping.html", source)

    def test_discovery_feeds_include_the_page(self):
        for relative in ("kor/report/camp/sitemap.xml", "feed.xml"):
            source = (ROOT / relative).read_text(encoding="utf-8")
            self.assertIn(CANONICAL, source)


if __name__ == "__main__":
    unittest.main()
