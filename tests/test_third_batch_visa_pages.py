import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
CASES = {
    "singapore.html": ("싱가포르", "90일", "https://www.ica.gov.sg/"),
    "russia.html": ("러시아", "60일", "https://www.kdmid.ru/"),
    "uae.html": ("UAE", "90일", "https://u.ae/"),
    "philippines.html": ("필리핀", "30일", "https://etravel.gov.ph/"),
    "saudiarabia.html": ("사우디아라비아", "eVisa", "https://visa.visitsaudi.com/"),
}


class ThirdBatchVisaPagesTest(unittest.TestCase):
    def test_page_contracts(self):
        for filename, (country, key_fact, official_url) in CASES.items():
            with self.subTest(filename=filename):
                html = (ROOT / "kor/report/visa" / filename).read_text(encoding="utf-8")
                page = PageParser(); page.feed(html)
                self.assertIn(country.lower(), (page.title + page.h1 + page.meta["description"]).lower())
                for phrase in ("한국 여권", key_fact, "공식", "최근 확인", "2026-08-09", official_url):
                    self.assertIn(phrase, html)
                self.assertEqual({item.get("@type") for item in page.json_ld}, {"WebPage", "FAQPage"})
                for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", 'div[id^="aswift_"]'):
                    self.assertIn(phrase, html)


if __name__ == "__main__": unittest.main()
