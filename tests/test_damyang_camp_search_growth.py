import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/damyang.html"
INDEX = ROOT / "kor/report/camp/index.html"


class DamyangCampSearchGrowthTest(unittest.TestCase):
    def test_page_has_local_revenue_navigation_and_safe_copy(self):
        html = PAGE.read_text(encoding="utf-8")
        for text in (
            "담양 캠핑·차박 가이드 2026",
            "대표 장소",
            "주차",
            "화장실",
            "취사",
            "요금·허용 여부",
            "최종 재검토",
            "/kor/report/camp/jeonnam-best.html",
            "/kor/report/camp/jangseong.html",
            "/kor/report/camp/hwasun.html",
            "damyang.go.kr",
            "gocamping.or.kr",
            "G-QP5Q67GE5B",
            "ca-pub-8830524482034754",
        ):
            self.assertIn(text, html)

        for stale in ("증암천교 아래 차박지", "다리 아래 자리 추천", "나무그늘 아래 텐트가 시원함"):
            self.assertNotIn(stale, html)

        blocks = re.findall(r'<script type="application/ld\+json">\s*(.*?)\s*</script>', html, re.S)
        self.assertTrue(any(json.loads(block).get("dateModified") == "2026-08-26" for block in blocks))

    def test_index_uses_revised_search_snippet(self):
        html = INDEX.read_text(encoding="utf-8")
        self.assertIn("담양 캠핑·차박 가이드 2026", html)
        self.assertIn("담양호·하천변 규정과 등록 캠핑장", html)


if __name__ == "__main__":
    unittest.main()
