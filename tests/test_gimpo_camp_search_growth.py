import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/camp/gimpo.html"
INDEX = ROOT / "kor/report/camp/index.html"


class GimpoCampSearchGrowthTest(unittest.TestCase):
    def test_page_has_local_planning_path(self):
        html = PAGE.read_text(encoding="utf-8")
        for text in (
            "김포 캠핑·차박 가이드 2026",
            "대표 장소", "주차", "화장실", "취사", "요금·허용 여부", "최종 재검토",
            "/kor/report/camp/gyeonggi-best.html",
            "/kor/report/camp/goyang.html",
            "/kor/report/camp/incheon.html",
            "gimpo.go.kr", "gocamping.or.kr",
            "G-QP5Q67GE5B", "ca-pub-8830524482034754",
        ):
            self.assertIn(text, html)
        for stale in ("김포 무료 캠핑", "김포 차박지", "김포 차크닉 명소"):
            self.assertNotIn(stale, html)
        blocks = re.findall(r'<script type="application/ld\+json">\s*(.*?)\s*</script>', html, re.S)
        self.assertTrue(any(json.loads(block).get("dateModified") == "2026-08-26" for block in blocks))

    def test_index_uses_current_snippet(self):
        html = INDEX.read_text(encoding="utf-8")
        self.assertIn("김포 캠핑·차박 가이드 2026", html)
        self.assertIn("전류리포구·한강 주변 규정과 등록 캠핑장", html)


if __name__ == "__main__":
    unittest.main()
