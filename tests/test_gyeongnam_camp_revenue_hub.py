import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/gyeongnam-best.html"
INDEX = ROOT / "kor/report/camp/index.html"


class GyeongnamCampRevenueHubTest(unittest.TestCase):
    def test_page_has_safe_current_trip_planning_signals(self):
        html = PAGE.read_text(encoding="utf-8")

        for text in (
            "경남 캠핑·차박 가이드 2026",
            "야영·차박 허용 여부",
            "등록 캠핑장",
            "출발 당일",
            "gocamping.or.kr",
            "gyeongnam.go.kr",
            "hadong.html",
            "jinju.html",
            "gimhae.html",
            "G-QP5Q67GE5B",
            "ca-pub-8830524482034754",
        ):
            self.assertIn(text, html)

        for unsafe in ("차박 성지", "차박이 가능합니다", "차박하기 최고", "무료 노지캠핑"):
            self.assertNotIn(unsafe, html)

        json_ld = re.findall(
            r'<script type="application/ld\+json">\s*(.*?)\s*</script>', html, re.S
        )
        self.assertTrue(any(json.loads(item).get("dateModified") == "2026-08-26" for item in json_ld))

    def test_camp_index_uses_revised_search_snippet(self):
        html = INDEX.read_text(encoding="utf-8")
        self.assertIn("경남 캠핑·차박 가이드 2026", html)
        self.assertIn("등록 캠핑장과 해변·강·산 야영 허용 여부", html)


if __name__ == "__main__":
    unittest.main()
