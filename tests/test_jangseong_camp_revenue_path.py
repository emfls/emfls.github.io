import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/jangseong.html"
HUB = ROOT / "kor/report/camp/index.html"


class JangseongCampRevenuePathTest(unittest.TestCase):
    def test_page_has_consistent_permission_first_content(self):
        html = PAGE.read_text(encoding="utf-8")
        self.assertIn("장성 캠핑·차박 가이드 2026", html)
        for text in ("야영·차박 허용 여부", "등록 캠핑장", "출발 당일"):
            self.assertIn(text, html)
        for official in ("gocamping.or.kr", "jangseong.go.kr"):
            self.assertIn(official, html)
        for href in ("jeonnam-best.html", "hwasun.html", "damyang.html"):
            self.assertIn(href, html)
        for stale in ("완전무료", "무료 차박 성지", "무료 캠핑의 모든 것"):
            self.assertNotIn(stale, html)
        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        parsed = [json.loads(item) for item in schemas]
        self.assertTrue(any(item.get("dateModified") == "2026-08-26" for item in parsed))
        self.assertIn("G-QP5Q67GE5B", html)
        self.assertIn("ca-pub-8830524482034754", html)

    def test_hub_uses_current_jangseong_snippet(self):
        html = HUB.read_text(encoding="utf-8")
        self.assertIn("장성 캠핑·차박 가이드 2026", html)
        self.assertIn("등록 캠핑장과 황룡강·저수지 야영 허용 여부", html)


if __name__ == "__main__":
    unittest.main()
