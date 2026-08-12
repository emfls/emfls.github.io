import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "kor/report/visa/switzerland.html": "https://emfls.github.io/kor/report/visa/switzerland.html",
    "kor/report/visa/rwanda.html": "https://emfls.github.io/kor/report/visa/rwanda.html",
    "kor/report/visa/togo.html": "https://emfls.github.io/kor/report/visa/togo.html",
    "kor/report/visa/tanzania.html": "https://emfls.github.io/kor/report/visa/tanzania.html",
    "kor/report/travel/australia-adelaide.html": "https://emfls.github.io/kor/report/travel/australia-adelaide.html",
}
OFFICIAL_DOMAINS = {
    "kor/report/visa/switzerland.html": ("sem.admin.ch", "travel-europe.europa.eu"),
    "kor/report/visa/rwanda.html": ("migration.gov.rw", "rbc.gov.rw"),
    "kor/report/visa/togo.html": ("voyage.gouv.tg",),
    "kor/report/visa/tanzania.html": ("immigration.go.tz",),
    "kor/report/travel/australia-adelaide.html": (
        "adelaidemetro.com.au",
        "adelaidecentralmarket.com.au",
        "immi.homeaffairs.gov.au",
    ),
}


def parse(relative_path):
    html = (ROOT / relative_path).read_text(encoding="utf-8")
    page = PageParser()
    page.feed(html)
    return html, page


class SearchOpportunityBatch03Test(unittest.TestCase):
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

    def test_current_entry_decisions_are_visible(self):
        switzerland, _ = parse("kor/report/visa/switzerland.html")
        rwanda, _ = parse("kor/report/visa/rwanda.html")
        togo, _ = parse("kor/report/visa/togo.html")
        tanzania, _ = parse("kor/report/visa/tanzania.html")
        self.assertIn("현재 ETIAS 신청을 받지 않습니다", switzerland)
        self.assertIn("여권 유효기간이 6개월 이상", rwanda)
        self.assertIn("최소 5일 전", togo)
        self.assertIn("귀국 또는 제3국행 항공권", tanzania)

    def test_adelaide_plan_accounts_for_transport_market_and_eta(self):
        adelaide, _ = parse("kor/report/travel/australia-adelaide.html")
        self.assertIn("J1·J2", adelaide)
        self.assertIn("일요일과 월요일은 휴장", adelaide)
        self.assertIn("Australian ETA 앱", adelaide)
        self.assertIn("승인 전에는 항공권을 확정하지 않는 편이 안전", adelaide)


if __name__ == "__main__":
    unittest.main()
