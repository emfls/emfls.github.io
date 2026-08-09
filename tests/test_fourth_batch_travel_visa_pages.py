import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
CASES = {
    "kor/report/visa/san-marino.html": ("산마리노", "한국 여권", "30일", "https://www.esteri.sm/"),
    "kor/report/travel/australia-cairns.html": ("케언스", "한국 여권", "ETA", "https://www.tropicalnorthqueensland.org.au/"),
    "kor/report/travel/australia-portmacquarie.html": ("포트맥쿼리", "한국 여권", "ETA", "https://www.portmacquarieinfo.com.au/"),
    "kor/report/visa/niger.html": ("니제르", "한국 여권", "여행금지", "https://diplomatie.gouv.ne/"),
    "kor/report/travel/austria-ansfelden.html": ("안스펠덴", "한국 여권", "90일", "https://www.ansfelden.at/"),
}

class FourthBatchTravelVisaPagesTest(unittest.TestCase):
    def test_contracts(self):
        for path, (place, passport, fact, official) in CASES.items():
            with self.subTest(path=path):
                html = (ROOT / path).read_text(encoding="utf-8")
                page = PageParser(); page.feed(html)
                self.assertIn(place, page.title + page.h1 + page.meta.get("description", ""))
                for phrase in (passport, fact, official, "공식", "최근 확인", "2026-08-09"):
                    self.assertIn(phrase, html)
                self.assertEqual({item.get("@type") for item in page.json_ld}, {"WebPage", "FAQPage"})
                for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", 'div[id^="aswift_"]'):
                    self.assertIn(phrase, html)

if __name__ == "__main__": unittest.main()
