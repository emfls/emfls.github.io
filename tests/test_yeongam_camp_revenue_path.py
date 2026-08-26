import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/yeongam.html"
INDEX = ROOT / "kor/report/camp/index.html"


class YeongamCampRevenuePathTest(unittest.TestCase):
    def test_page_has_current_safe_planning_path(self):
        html = PAGE.read_text(encoding="utf-8")
        for text in (
            "영암 캠핑·차박 가이드 2026",
            "야영·차박 허용 여부",
            "등록 캠핑장",
            "출발 당일",
            "gocamping.or.kr",
            "yeongam.go.kr",
            "/kor/report/camp/jeonnam-best.html",
            "/kor/report/camp/mokpo.html",
            "/kor/report/camp/hwasun.html",
            "G-QP5Q67GE5B",
            "ca-pub-8830524482034754",
        ):
            self.assertIn(text, html)

        for stale in (
            "완전 가이드 2025",
            "노지 베스트",
            "노지 캠핑의 자유로움",
            "25,000원/4인기준",
            "061-470-2240",
        ):
            self.assertNotIn(stale, html)

        blocks = re.findall(r'<script type="application/ld\+json">\s*(.*?)\s*</script>', html, re.S)
        self.assertTrue(any(json.loads(block).get("dateModified") == "2026-08-26" for block in blocks))

    def test_index_uses_current_snippet(self):
        html = INDEX.read_text(encoding="utf-8")
        self.assertIn("영암 캠핑·차박 가이드 2026", html)
        self.assertIn("월출산·영암 국제자동차경주장 주변 등록 시설", html)


if __name__ == "__main__":
    unittest.main()
