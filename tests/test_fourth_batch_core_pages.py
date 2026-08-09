import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]

class FourthBatchCorePagesTest(unittest.TestCase):
    def check_page(self, path, phrases, canonical, types):
        html = (ROOT / path).read_text(encoding="utf-8")
        page = PageParser(); page.feed(html)
        combined = page.title + page.h1 + page.meta.get("description", "")
        for phrase in phrases[:3]: self.assertIn(phrase.lower(), combined.lower())
        for phrase in phrases[3:]: self.assertIn(phrase, html)
        self.assertEqual(page.canonical, canonical)
        self.assertEqual({item.get("@type") for item in page.json_ld}, set(types))
        for phrase in ("G-QP5Q67GE5B", "ca-pub-8830524482034754", 'div[id^="aswift_"]'):
            self.assertIn(phrase, html)

    def test_homepage(self):
        self.check_page("index.html", ("무료", "게임", "도구", "2026-08-09", "비자", "여행"),
                        "https://emfls.github.io/", ("WebSite", "FAQPage"))

    def test_obbb(self):
        self.check_page("kor/report/obbb/index.html", ("OBBB", "Public Law 119-21", "2025", "2026-08-09", "2025년 7월 4일", "https://www.congress.gov/", "https://www.cbo.gov/"),
                        "https://emfls.github.io/kor/report/obbb/", ("WebPage", "FAQPage"))
        html = (ROOT / "kor/report/obbb/index.html").read_text(encoding="utf-8")
        self.assertNotIn("가상의 OBBB", html)
        self.assertNotIn("content=\"도널드 트럼프 전 대통령이 제안하는 가상의", html)

if __name__ == "__main__": unittest.main()
