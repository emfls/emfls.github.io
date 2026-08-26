import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/travel/sweden-malmo.html"
INDEX = ROOT / "kor/report/travel/index.html"


class MalmoTravelRevenuePathTest(unittest.TestCase):
    def test_page_has_current_official_planning_path(self):
        html = PAGE.read_text(encoding="utf-8")
        for text in (
            "말뫼 여행 가이드 2026",
            "출발 전 확인 순서",
            "운영시간·요금",
            "출발 당일",
            "malmo.se",
            "skanetrafiken.se",
            "0404.go.kr",
            "sweden-lund.html",
            "denmark-copenhagen.html",
            "G-QP5Q67GE5B",
            "ca-pub-8830524482034754",
        ):
            self.assertIn(text, html)

        for stale in (
            "왕복 약 270크로나",
            "말뫼하우스 40~70크로나",
            "레스토랑 10%",
            "말뫼 카드:",
            "800,000원~1,800,000원",
            "840~2,720크로나",
        ):
            self.assertNotIn(stale, html)

        blocks = re.findall(r'<script type="application/ld\+json">\s*(.*?)\s*</script>', html, re.S)
        self.assertTrue(any(json.loads(block).get("dateModified") == "2026-08-26" for block in blocks))

    def test_index_uses_current_snippet(self):
        html = INDEX.read_text(encoding="utf-8")
        self.assertIn("말뫼 여행 가이드 2026", html)
        self.assertIn("코펜하겐 이동·공식 교통·명소 운영정보", html)


if __name__ == "__main__":
    unittest.main()
