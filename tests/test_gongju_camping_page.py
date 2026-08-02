import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/gongju.html"


class GongjuCampingPageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_answers_registered_campground_intent(self):
        combined = self.page.title + self.page.h1 + self.page.meta["description"]
        for phrase in ("공주 캠핑장", "예약", "등록 야영장"):
            self.assertIn(phrase, combined)
        self.assertIn("공주산림휴양마을", self.html)

    def test_contract(self):
        self.assertEqual(self.page.canonical, "https://emfls.github.io/kor/report/camp/gongju.html")
        for marker in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", "function filterCamps", "function toggleFAQ", "2026-08-02"):
            self.assertIn(marker, self.html)
        self.assertEqual({item.get("@type") for item in self.page.json_ld}, {"WebPage", "FAQPage"})
        self.assertIn('div[id^="aswift_"]', self.html)

    def test_uses_official_live_sources(self):
        official = [a for a in self.page.links if any(domain in a.get("href", "") for domain in ("foresttrip.go.kr", "gocamping.or.kr", "gongju.go.kr"))]
        self.assertGreaterEqual(len(official), 6)

    def test_removes_unsupported_wild_camping_claims(self):
        for phrase in (
            "완전무료",
            "차박최적",
            "공주 대표 무료 노지 캠핑장",
            "백제큰다리 차박 포인트",
            "공산성 주차장 (역사 체험)",
            "무령왕릉 주변 노지",
        ):
            self.assertNotIn(phrase, self.html)


if __name__ == "__main__":
    unittest.main()
