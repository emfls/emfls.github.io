import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "kor/report/camp/busan.html": "https://emfls.github.io/kor/report/camp/busan.html",
    "kor/report/camp/andong.html": "https://emfls.github.io/kor/report/camp/andong.html",
    "kor/report/visa/norway.html": "https://emfls.github.io/kor/report/visa/norway.html",
    "kor/report/visa/qatar.html": "https://emfls.github.io/kor/report/visa/qatar.html",
    "kor/report/visa/sweden.html": "https://emfls.github.io/kor/report/visa/sweden.html",
}
OFFICIAL_DOMAINS = {
    "kor/report/camp/busan.html": ("busan.go.kr",),
    "kor/report/camp/andong.html": ("gocamping.or.kr", "andong.go.kr"),
    "kor/report/visa/norway.html": ("udi.no", "travel-europe.europa.eu"),
    "kor/report/visa/qatar.html": ("visitqatar.com",),
    "kor/report/visa/sweden.html": ("migrationsverket.se", "travel-europe.europa.eu"),
}


def parse(relative_path):
    html = (ROOT / relative_path).read_text(encoding="utf-8")
    page = PageParser()
    page.feed(html)
    return html, page


class SearchOpportunityBatchTest(unittest.TestCase):
    def test_pages_keep_identity_measurement_and_ads(self):
        for relative_path, canonical in PAGES.items():
            with self.subTest(page=relative_path):
                html, page = parse(relative_path)
                self.assertEqual(page.canonical, canonical)
                self.assertIn("G-QP5Q67GE5B", html)
                self.assertIn("ca-pub-8830524482034754", html)

    def test_pages_offer_a_current_answer_and_contextual_next_step(self):
        for relative_path in PAGES:
            with self.subTest(page=relative_path):
                html, page = parse(relative_path)
                expected_date = "2026-08-13" if relative_path == "kor/report/camp/busan.html" else "2026-08-12"
                self.assertIn(expected_date, html)
                self.assertTrue(
                    any(label in html for label in ("먼저 답", "빠른 답", "핵심 답변"))
                )
                internal_links = [
                    link.get("href", "")
                    for link in page.links
                    if link.get("href", "").startswith(("../", "../../", "/kor/report/"))
                    or link.get("href", "").endswith(".html")
                ]
                self.assertTrue(internal_links)

    def test_pages_expose_the_official_sources_used_for_decisions(self):
        for relative_path, domains in OFFICIAL_DOMAINS.items():
            with self.subTest(page=relative_path):
                _, page = parse(relative_path)
                hrefs = [link.get("href", "") for link in page.links]
                for domain in domains:
                    self.assertTrue(any(domain in href for href in hrefs), domain)

    def test_stale_volatile_claims_are_not_presented_as_current(self):
        combined = "".join(parse(relative_path)[0] for relative_path in PAGES)
        for stale_claim in (
            "2025년부터 도입",
            "신청 수수료 €7",
            "여행 8일 전 신청",
            "무료 대중교통 이용",
            "도하 메트로 무료 이용",
            "즉시 발급",
        ):
            self.assertNotIn(stale_claim, combined)

    def test_andong_marks_danho_status_for_booking_decisions(self):
        html, _ = parse("kor/report/camp/andong.html")
        self.assertIn("단호샌드파크", html)
        self.assertIn("단호샌드파크는 현재 휴업 중", html)


if __name__ == "__main__":
    unittest.main()
