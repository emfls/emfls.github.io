import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/icheon.html"


class IcheonCampRevenuePathTest(unittest.TestCase):
    def test_page_prioritizes_current_permission_and_booking_checks(self):
        html = PAGE.read_text(encoding="utf-8")

        self.assertIn("이천 캠핑·차박 가이드 2026", html)
        self.assertIn('class="planning-summary"', html)
        for text in ("야영·차박 허용 여부", "최신 요금과 휴장일", "출발 당일"):
            self.assertIn(text, html)
        for href in ("gyeonggi-best.html", "yongin.html", "gwangju-g.html"):
            self.assertIn(f'href="{href}"', html)
        self.assertNotIn("완전무료", html)
        self.assertNotIn("35,000원~45,000원", html)

        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        parsed = [json.loads(item) for item in schemas]
        self.assertTrue(any(item.get("dateModified") == "2026-08-25" for item in parsed))


if __name__ == "__main__":
    unittest.main()
