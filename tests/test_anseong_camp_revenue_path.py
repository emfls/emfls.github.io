import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/anseong.html"
HUB = ROOT / "kor/report/camp/index.html"


class AnseongCampRevenuePathTest(unittest.TestCase):
    def test_page_prioritizes_current_permission_and_booking_checks(self):
        html = PAGE.read_text(encoding="utf-8")

        self.assertIn("안성 캠핑·차박 가이드 2026", html)
        self.assertIn('class="planning-summary"', html)
        for text in ("야영·차박 허용 여부", "등록 캠핑장", "출발 당일"):
            self.assertIn(text, html)
        for href in ("gyeonggi-best.html", "yongin.html", "pyeongtaek.html"):
            self.assertIn(f'href="{href}"', html)
        for official in ("anseong.go.kr", "gocamping.or.kr"):
            self.assertIn(official, html)
        for stale_claim in ("완전무료", "당일10,000원", "20,000원"):
            self.assertNotIn(stale_claim, html)

        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        parsed = [json.loads(item) for item in schemas]
        self.assertTrue(any(item.get("dateModified") == "2026-08-26" for item in parsed))

        self.assertIn("G-QP5Q67GE5B", html)
        self.assertIn("ca-pub-8830524482034754", html)

    def test_camp_hub_uses_the_current_anseong_snippet(self):
        html = HUB.read_text(encoding="utf-8")

        self.assertIn("안성 캠핑·차박 가이드 2026", html)
        self.assertIn("등록 캠핑장과 야영 허용 여부", html)
        self.assertNotIn("양성산림욕장 무료 캠핑", html)


if __name__ == "__main__":
    unittest.main()
