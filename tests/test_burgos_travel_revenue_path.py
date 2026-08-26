import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/travel/spain-burgos.html"
INDEX = ROOT / "kor/report/travel/index.html"


class BurgosTravelRevenuePathTest(unittest.TestCase):
    def test_page_has_current_official_planning_path(self):
        html = PAGE.read_text(encoding="utf-8")
        for text in (
            "부르고스 여행 가이드 2026",
            "출발 전 확인 순서",
            "운영시간·예약",
            "출발 당일",
            "turismoburgos.org",
            "renfe.com",
            "exteriores.gob.es",
            "0404.go.kr",
            "spain-madrid.html",
            "spain-santiago.html",
            "G-QP5Q67GE5B",
            "ca-pub-8830524482034754",
        ):
            self.assertIn(text, html)

        for stale in (
            "매우 낮음 -",
            "기차로 2시간 30분",
            "오후 2-5시경 많은 상점과 박물관이 문을 닫으므로",
            "1,000,000-1,800,000원",
            "1,325,000-2,470,000원",
        ):
            self.assertNotIn(stale, html)

        blocks = re.findall(r'<script type="application/ld\+json">\s*(.*?)\s*</script>', html, re.S)
        self.assertTrue(any(json.loads(block).get("dateModified") == "2026-08-26" for block in blocks))

    def test_index_uses_current_snippet(self):
        html = INDEX.read_text(encoding="utf-8")
        self.assertIn("부르고스 여행 가이드 2026", html)
        self.assertIn("대성당·아타푸에르카·마드리드 교통 공식정보", html)


if __name__ == "__main__":
    unittest.main()
