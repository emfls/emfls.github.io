import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/travel/thailand-hatyai.html"
INDEX = ROOT / "kor/report/travel/index.html"


class HatyaiTravelRevenuePathTest(unittest.TestCase):
    def test_page_has_current_safe_planning_path(self):
        html = PAGE.read_text(encoding="utf-8")
        for text in (
            "핫야이 여행 가이드 2026",
            "출발 전 확인 순서",
            "여행경보 3단계",
            "출발 당일",
            "tourismthailand.org",
            "thaievisa.go.th",
            "0404.go.kr",
            "thailand-bangkok.html",
            "malaysia-penang.html",
            "G-QP5Q67GE5B",
            "ca-pub-8830524482034754",
        ):
            self.assertIn(text, html)

        for stale in (
            "30일 이하 무비자 입국 가능",
            "말레이시아 당일 여행",
            "30일 무비자 가능",
            "฿1,700-4,600",
            "฿150-200",
            "฿20-30",
        ):
            self.assertNotIn(stale, html)

        blocks = re.findall(r'<script type="application/ld\+json">\s*(.*?)\s*</script>', html, re.S)
        self.assertTrue(any(json.loads(block).get("dateModified") == "2026-08-26" for block in blocks))

    def test_index_uses_current_snippet(self):
        html = INDEX.read_text(encoding="utf-8")
        self.assertIn("핫야이 여행 가이드 2026", html)
        self.assertIn("송클라 여행경보·입국·교통 공식정보", html)


if __name__ == "__main__":
    unittest.main()
