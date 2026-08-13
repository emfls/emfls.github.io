import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "kor/report/visa/russia.html": "https://emfls.github.io/kor/report/visa/russia.html",
    "kor/report/visa/ukraine.html": "https://emfls.github.io/kor/report/visa/ukraine.html",
    "kor/report/visa/uae.html": "https://emfls.github.io/kor/report/visa/uae.html",
    "kor/report/visa/saudiarabia.html": "https://emfls.github.io/kor/report/visa/saudiarabia.html",
    "kor/report/camp/gapyeong.html": "https://emfls.github.io/kor/report/camp/gapyeong.html",
}
OFFICIAL_DOMAINS = {
    "kor/report/visa/russia.html": ("kdmid.ru", "0404.go.kr"),
    "kor/report/visa/ukraine.html": ("mfa.gov.ua", "0404.go.kr"),
    "kor/report/visa/uae.html": ("u.ae",),
    "kor/report/visa/saudiarabia.html": ("visa.visitsaudi.com",),
    "kor/report/camp/gapyeong.html": ("gocamping.or.kr",),
}


def parse(relative_path):
    html = (ROOT / relative_path).read_text(encoding="utf-8")
    page = PageParser()
    page.feed(html)
    return html, page


class SearchOpportunityBatch02Test(unittest.TestCase):
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
                expected_date = "2026-08-13" if relative_path in {"kor/report/camp/gapyeong.html", "kor/report/visa/uae.html"} else "2026-08-12"
                self.assertIn(expected_date, html)
                self.assertTrue(any(label in html for label in ("먼저 답", "빠른 답", "핵심 답변")))

    def test_pages_expose_official_sources_and_a_contextual_next_step(self):
        for relative_path, domains in OFFICIAL_DOMAINS.items():
            with self.subTest(page=relative_path):
                _, page = parse(relative_path)
                hrefs = [link.get("href", "") for link in page.links]
                for domain in domains:
                    self.assertTrue(any(domain in href for href in hrefs), domain)
                self.assertTrue(any(href.endswith(".html") or href.startswith("/kor/report/") for href in hrefs))

    def test_high_risk_pages_lead_with_the_safety_decision(self):
        russia, _ = parse("kor/report/visa/russia.html")
        ukraine, _ = parse("kor/report/visa/ukraine.html")
        self.assertIn("러시아 일부 지역은 여행금지", russia)
        self.assertIn("우크라이나 전역은 여행금지", ukraine)
        self.assertIn("2027-01-31", russia)
        self.assertIn("2027-01-31", ukraine)

    def test_entry_and_booking_claims_keep_the_official_qualification(self):
        uae, _ = parse("kor/report/visa/uae.html")
        saudi, _ = parse("kor/report/visa/saudiarabia.html")
        gapyeong, _ = parse("kor/report/camp/gapyeong.html")
        self.assertIn("여권은 입국일 기준 최소 6개월", uae)
        self.assertIn("결제는 승인을 보장하지 않습니다", saudi)
        self.assertIn("자라섬 캠핑장", gapyeong)
        self.assertIn("온라인실시간예약", gapyeong)


if __name__ == "__main__":
    unittest.main()
