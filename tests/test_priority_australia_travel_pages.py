import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
CASES = {
    "australia-newcastle.html": ("뉴캐슬", "https://visitnewcastle.com.au/", "2026-08-13"),
    "australia-adelaide.html": ("애들레이드", "https://southaustralia.com/", "2026-08-12"),
    "australia-perth.html": ("퍼스", "https://www.westernaustralia.com/", "2026-08-12"),
}

class PriorityAustraliaTravelPagesTest(unittest.TestCase):
    def test_page_contracts(self):
        for filename, (city, official_url, checked_on) in CASES.items():
            with self.subTest(filename=filename):
                html = (ROOT / "kor/report/travel" / filename).read_text(encoding="utf-8")
                page = PageParser(); page.feed(html)
                self.assertIn(city, page.title + page.h1 + page.meta["description"])
                for phrase in ("한국 여권", "ETA", "공식", "최근 확인", checked_on, official_url):
                    self.assertIn(phrase, html)
                self.assertEqual({item.get("@type") for item in page.json_ld}, {"WebPage", "FAQPage"})
                for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", 'div[id^="aswift_"]'):
                    self.assertIn(phrase, html)

if __name__ == "__main__": unittest.main()
