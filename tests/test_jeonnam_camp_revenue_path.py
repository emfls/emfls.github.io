import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/jeonnam-best.html"
HUB = ROOT / "kor/report/camp/index.html"


class JeonnamCampRevenuePathTest(unittest.TestCase):
    def test_page_routes_visitors_to_reviewed_local_guides_safely(self):
        html = PAGE.read_text(encoding="utf-8")

        self.assertIn("전라남도 캠핑·차박 가이드 2026", html)
        self.assertIn('class="decision-links"', html)
        for text in ("등록 캠핑장", "야영·차박 허용 여부", "출발 당일"):
            self.assertIn(text, html)
        for href in ("gwangyang.html", "goheung.html", "haenam.html", "yeosu.html"):
            self.assertIn(href, html)
        self.assertIn("gocamping.or.kr", html)
        for stale in ("차박의 성지입니다", "전남 최고의 차박 성지", "인근 강변·해변 캠핑이 가능합니다"):
            self.assertNotIn(stale, html)

        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        parsed = [json.loads(item) for item in schemas]
        self.assertTrue(any(item.get("dateModified") == "2026-08-26" for item in parsed))
        self.assertIn("G-QP5Q67GE5B", html)
        self.assertIn("ca-pub-8830524482034754", html)

        hub = HUB.read_text(encoding="utf-8")
        self.assertIn("전라남도 캠핑·차박 가이드 2026", hub)
        self.assertIn("등록 캠핑장과 야영 허용 여부", hub)


if __name__ == "__main__":
    unittest.main()
