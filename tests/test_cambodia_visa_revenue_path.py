import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/visa/cambodia.html"


class CambodiaVisaRevenuePathTest(unittest.TestCase):
    def test_page_uses_current_official_confirmation_flow(self):
        html = PAGE.read_text(encoding="utf-8")

        self.assertIn("캄보디아 비자 2026", html)
        for text in ("여권 국적과 방문 목적", "e-Arrival", "입국 가능한 공항·국경 검문소"):
            self.assertIn(text, html)
        for href in (
            "https://www.evisa.gov.kh/",
            "https://www.evisa.gov.kh/information/visa_type/4",
            "https://immigration.gov.kh/",
            "/kor/report/visa/",
        ):
            self.assertIn(f'href="{href}"', html)
        for outdated in ("약 36달러", "미신청 시 출국 불가", "220개국 국민 신청 가능"):
            self.assertNotIn(outdated, html)
        self.assertIn("pagead2.googlesyndication.com", html)
        self.assertIn("googletagmanager.com/gtag/js", html)

        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        parsed = [json.loads(item) for item in schemas]
        self.assertTrue(any(item.get("dateModified") == "2026-08-26" for item in parsed))


if __name__ == "__main__":
    unittest.main()
