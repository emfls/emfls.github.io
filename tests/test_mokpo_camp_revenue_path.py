import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/mokpo.html"
HUB = ROOT / "kor/report/camp/index.html"


class MokpoCampRevenuePathTest(unittest.TestCase):
    def test_page_uses_registered_site_and_permission_first_flow(self):
        html = PAGE.read_text(encoding="utf-8")
        self.assertIn("목포 캠핑·차박 가이드 2026", html)
        self.assertIn('class="planning-summary"', html)
        for text in ("야영·차박 허용 여부", "등록 캠핑장", "출발 당일"):
            self.assertIn(text, html)
        for official in ("gocamping.or.kr", "mokpo.go.kr"):
            self.assertIn(official, html)
        for href in ("jeonnam-best.html", "haenam.html", "sinan.html"):
            self.assertIn(f'href="{href}"', html)
        for stale in ("완전무료", "취사가능", "노지캠핑가능", "1시간무료후30분1000원", "하루종일3000원"):
            self.assertNotIn(stale, html)

        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        parsed = [json.loads(item) for item in schemas]
        self.assertTrue(any(item.get("dateModified") == "2026-08-26" for item in parsed))
        self.assertIn("G-QP5Q67GE5B", html)
        self.assertIn("ca-pub-8830524482034754", html)

    def test_camp_hub_uses_current_mokpo_snippet(self):
        html = HUB.read_text(encoding="utf-8")
        self.assertIn("목포 캠핑·차박 가이드 2026", html)
        self.assertIn("등록 캠핑장과 해안·주차장 야영 허용 여부", html)


if __name__ == "__main__":
    unittest.main()
