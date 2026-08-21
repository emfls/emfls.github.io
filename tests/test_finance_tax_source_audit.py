import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "/kor/column/dividend-etf-tax-guide-2026.html": ROOT / "kor/column/dividend-etf-tax-guide-2026.html",
    "/kor/column/financial-income-tax-2000-2026.html": ROOT / "kor/column/financial-income-tax-2000-2026.html",
    "/kor/column/isa-account-tax-free-2026.html": ROOT / "kor/column/isa-account-tax-free-2026.html",
}


class FinanceTaxSourceAuditTests(unittest.TestCase):
    def test_pages_remove_unverified_tax_and_sales_claims(self):
        banned = (
            "세금 35% 증발",
            "실제 통장에 찍히는 돈은 8,000만 원 미만",
            "약 55만 원 추가",
            "약 150만 원 추가",
            "약 1,000만 원 이상 추가",
            "활용하지 않으면 손해",
            "지금 바로 개설",
            "세금 폭탄",
        )
        for path in PAGES.values():
            html = path.read_text(encoding="utf-8")
            with self.subTest(page=path.name):
                for claim in banned:
                    self.assertNotIn(claim, html)

    def test_pages_show_review_date_scope_and_official_sources(self):
        for path in PAGES.values():
            html = path.read_text(encoding="utf-8")
            with self.subTest(page=path.name):
                self.assertIn("2026-08-21", html)
                self.assertIn("일반 정보", html)
                self.assertIn("https://www.nts.go.kr/", html)
                self.assertIn("https://www.law.go.kr/", html)
                self.assertIn("googletagmanager.com/gtag/js", html)
                self.assertIn("pagead2.googlesyndication.com", html)

    def test_metadata_marks_only_audited_pages_as_verified(self):
        entries = {
            item["url"]: item
            for item in json.loads((ROOT / "data/content-metadata.json").read_text(encoding="utf-8"))
        }
        for url in PAGES:
            with self.subTest(url=url):
                metadata = entries[url]
                self.assertEqual(metadata["last_verified"], "2026-08-21")
                self.assertEqual(metadata["review_interval"], 90)
                self.assertTrue(metadata["ymyl"])
                self.assertGreaterEqual(len(metadata["sources"]), 2)


if __name__ == "__main__":
    unittest.main()
