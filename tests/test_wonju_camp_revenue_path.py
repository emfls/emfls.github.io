import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/wonju.html"
HUB = ROOT / "kor/report/camp/index.html"


class WonjuCampRevenuePathTest(unittest.TestCase):
    def test_page_prioritizes_current_permission_and_registered_sites(self):
        html = PAGE.read_text(encoding="utf-8")
        self.assertIn("원주 캠핑·차박 가이드 2026", html)
        self.assertIn('class="planning-summary"', html)
        for text in ("야영·차박 허용 여부", "등록 캠핑장", "출발 당일", "재이용은 어려운 실정"):
            self.assertIn(text, html)
        for official in ("gocamping.or.kr", "council.wonju.go.kr"):
            self.assertIn(official, html)
        for href in ("gangwon-best.html", "hoengseong.html", "pyeongchang.html"):
            self.assertIn(f'href="{href}"', html)
        for stale in ("완전무료", "55,000원~65,000원", "50,000원", "010-9025-4323", "010-2073-2069"):
            self.assertNotIn(stale, html)

        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        parsed = [json.loads(item) for item in schemas]
        self.assertTrue(any(item.get("dateModified") == "2026-08-26" for item in parsed))
        self.assertIn("G-QP5Q67GE5B", html)
        self.assertIn("ca-pub-8830524482034754", html)

    def test_camp_hub_uses_current_wonju_snippet(self):
        html = HUB.read_text(encoding="utf-8")
        self.assertIn("원주 캠핑·차박 가이드 2026", html)
        self.assertIn("등록 캠핑장과 하천·공원 야영 허용 여부", html)
        self.assertNotIn("원주 무료 캠핑의 모든 것", html)


if __name__ == "__main__":
    unittest.main()
