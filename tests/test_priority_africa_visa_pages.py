import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
CASES = {
    "southsudan.html": ("남수단", "eVisa", "https://www.evisa.gov.ss/", "2026-08-12"),
    "tanzania.html": ("탄자니아", "US$50", "https://visa.immigration.go.tz/", "2026-08-12"),
    "togo.html": ("토고", "최소 5일 전", "https://voyage.gouv.tg/", "2026-08-12"),
}


class PriorityAfricaVisaPagesTest(unittest.TestCase):
    def test_pages(self):
        for filename, (country, key_fact, official_url, checked_on) in CASES.items():
            with self.subTest(filename=filename):
                html = (ROOT / "kor/report/visa" / filename).read_text(encoding="utf-8")
                page = PageParser(); page.feed(html)
                self.assertIn(country, page.title + page.h1 + page.meta["description"])
                for phrase in ("한국 여권", key_fact, "공식", "최근 확인", checked_on, official_url):
                    self.assertIn(phrase, html)
                self.assertEqual({item.get("@type") for item in page.json_ld}, {"WebPage", "FAQPage"})
                for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", 'div[id^="aswift_"]'):
                    self.assertIn(phrase, html)


if __name__ == "__main__": unittest.main()
