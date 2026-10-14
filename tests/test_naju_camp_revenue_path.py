import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/naju.html"


class NajuCampRevenuePathTest(unittest.TestCase):
    def test_page_prioritizes_current_permission_checks_and_related_routes(self):
        html = PAGE.read_text(encoding="utf-8")

        # c3fa79b82a5925473d997a5a646566e42b9c3f71 softened the page and
        # replaced its older generic title with this page-specific title.
        current_title = "나주 차박·캠핑 후보는? 영산강 주변 허용 여부 확인 2026"
        self.assertIn(f"<title>{current_title}</title>", html)
        self.assertIn(f"<h1>{current_title}</h1>", html)
        self.assertIn('class="planning-summary"', html)
        for text in ("야영·취사 허용 여부", "하천 수위와 기상특보", "출발 당일"):
            self.assertIn(text, html)
        for href in ("jeonnam-best.html", "hwasun.html", "gwangyang.html"):
            self.assertIn(f'href="{href}"', html)
        self.assertNotIn("완전무료", html)

        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        parsed = [json.loads(item) for item in schemas]
        self.assertTrue(any(item.get("dateModified") == "2026-08-25" for item in parsed))
        self.assertTrue(
            any(
                item.get("@type") == "WebPage" and item.get("dateModified") == "2026-10-15"
                for item in parsed
            )
        )


if __name__ == "__main__":
    unittest.main()
