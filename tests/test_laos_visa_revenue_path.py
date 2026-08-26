import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/laos.html"
HUB = ROOT / "kor/report/visa/index.html"


class LaosVisaRevenuePathTest(unittest.TestCase):
    def test_page_uses_official_status_first_flow(self):
        html = PAGE.read_text(encoding="utf-8")
        self.assertIn("라오스 비자·입국 가이드 2026", html)
        for text in ("여권과 방문 목적", "공식 비자 상태 확인", "출발 직전 재확인"):
            self.assertIn(text, html)
        for official in ("laoevisa.gov.la", "immigration.gov.la", "overseas.mofa.go.kr"):
            self.assertIn(official, html)
        for href in ("thailand.html", "vietnam.html", "cambodia.html"):
            self.assertIn(f'href="{href}"', html)
        for stale in (
            "대한민국 국민은 라오스 입국 시 반드시 비자가 필요합니다",
            "150,000원",
            "30-35달러",
            "취업비자를 받고 실제로 일하지 않는 것은 문제없지만",
        ):
            self.assertNotIn(stale, html)

        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        parsed = [json.loads(item) for item in schemas]
        self.assertTrue(any(item.get("dateModified") == "2026-08-26" for item in parsed))
        self.assertIn("G-QP5Q67GE5B", html)
        self.assertIn("ca-pub-8830524482034754", html)

    def test_visa_hub_uses_current_laos_snippet(self):
        html = HUB.read_text(encoding="utf-8")
        self.assertIn("라오스 비자·입국 가이드 2026", html)
        self.assertIn("공식 eVisa·이민국", html)


if __name__ == "__main__":
    unittest.main()
