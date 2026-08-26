import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/yeonggwang.html"
HUB = ROOT / "kor/report/camp/index.html"


class YeonggwangCampRevenuePathTest(unittest.TestCase):
    def test_page_uses_permission_first_planning_flow(self):
        html = PAGE.read_text(encoding="utf-8")
        self.assertIn("영광 캠핑·차박 가이드 2026", html)
        self.assertIn('class="planning-summary"', html)
        for text in ("야영·차박 허용 여부", "등록 캠핑장", "출발 당일"):
            self.assertIn(text, html)
        for official in ("gocamping.or.kr", "yeonggwang.go.kr"):
            self.assertIn(official, html)
        for href in ("jeonnam-best.html", "jangseong.html", "gwangyang.html"):
            self.assertIn(f'href="{href}"', html)
        for stale in ("완전무료", "차박가능", "무료 차박지", "여러 차박 지점"):
            self.assertNotIn(stale, html)

        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        parsed = [json.loads(item) for item in schemas]
        self.assertTrue(any(item.get("dateModified") == "2026-08-26" for item in parsed))
        self.assertIn("G-QP5Q67GE5B", html)
        self.assertIn("ca-pub-8830524482034754", html)

    def test_camp_hub_uses_current_yeonggwang_snippet(self):
        html = HUB.read_text(encoding="utf-8")
        self.assertIn("영광 캠핑·차박 가이드 2026", html)
        self.assertIn("등록 캠핑장과 해변·관광지 야영 허용 여부", html)


if __name__ == "__main__":
    unittest.main()
