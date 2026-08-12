import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "kor/report/visa/slovenia.html": "https://emfls.github.io/kor/report/visa/slovenia.html",
    "kor/report/camp/gongju.html": "https://emfls.github.io/kor/report/camp/gongju.html",
    "kor/report/visa/nepal.html": "https://emfls.github.io/kor/report/visa/nepal.html",
    "kor/report/visa/southsudan.html": "https://emfls.github.io/kor/report/visa/southsudan.html",
    "kor/report/visa/uganda.html": "https://emfls.github.io/kor/report/visa/uganda.html",
}
OFFICIAL_DOMAINS = {
    "kor/report/visa/slovenia.html": ("gov.si", "travel-europe.europa.eu"),
    "kor/report/camp/gongju.html": ("gocamping.or.kr", "gongju.go.kr"),
    "kor/report/visa/nepal.html": ("immigration.gov.np",),
    "kor/report/visa/southsudan.html": ("evisa.gov.ss", "0404.go.kr"),
    "kor/report/visa/uganda.html": ("immigration.go.ug",),
}


def parse(relative_path):
    html = (ROOT / relative_path).read_text(encoding="utf-8")
    page = PageParser()
    page.feed(html)
    return html, page


class SearchOpportunityBatch04Test(unittest.TestCase):
    def test_pages_keep_identity_measurement_and_ads(self):
        for relative_path, canonical in PAGES.items():
            with self.subTest(page=relative_path):
                html, page = parse(relative_path)
                self.assertEqual(page.canonical, canonical)
                self.assertIn("G-QP5Q67GE5B", html)
                self.assertIn("ca-pub-8830524482034754", html)

    def test_pages_give_a_current_first_answer(self):
        for relative_path in PAGES:
            with self.subTest(page=relative_path):
                html, _ = parse(relative_path)
                self.assertIn("2026-08-12", html)
                self.assertTrue(
                    any(label in html for label in ("먼저 답", "빠른 답", "핵심 답변"))
                )

    def test_pages_expose_official_sources_and_a_contextual_next_step(self):
        for relative_path, domains in OFFICIAL_DOMAINS.items():
            with self.subTest(page=relative_path):
                _, page = parse(relative_path)
                hrefs = [link.get("href", "") for link in page.links]
                for domain in domains:
                    self.assertTrue(any(domain in href for href in hrefs), domain)
                self.assertTrue(
                    any(href.endswith(".html") or href.startswith("/kor/report/") for href in hrefs)
                )

    def test_current_entry_and_booking_decisions_are_visible(self):
        slovenia, _ = parse("kor/report/visa/slovenia.html")
        gongju, _ = parse("kor/report/camp/gongju.html")
        nepal, _ = parse("kor/report/visa/nepal.html")
        uganda, _ = parse("kor/report/visa/uganda.html")
        self.assertIn("현재 ETIAS 신청을 받지 않습니다", slovenia)
        self.assertNotIn("장기 비자 및 취업비자는 15~60일", slovenia)
        self.assertNotIn("장기 비자는 35~60유로", slovenia)
        self.assertIn("예약 화면에서 운영 여부", gongju)
        self.assertIn("15일·30일·90일", nepal)
        self.assertIn("승인 허가의 유효기간은 90일", uganda)

    def test_south_sudan_leads_with_the_travel_warning(self):
        south_sudan, _ = parse("kor/report/visa/southsudan.html")
        first_answer = south_sudan.index("먼저 답")
        self.assertIn("여행경보 3단계(출국권고)", south_sudan[first_answer:first_answer + 600])
        self.assertIn("eVisa 승인이 입국을 보장하지 않습니다", south_sudan)
        self.assertIn("<title>남수단 비자 2026: 여행경보 3단계", south_sudan)


if __name__ == "__main__":
    unittest.main()
