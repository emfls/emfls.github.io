import json
import re
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PILLAR = ROOT / "kor/column/overseas-stock-tax-2026.html"
CALCULATOR = ROOT / "kor/util/overseas-stock-tax-calculator/index.html"
RELATED = (
    ROOT / "kor/column/dividend-etf-tax-guide-2026.html",
    ROOT / "kor/column/financial-income-tax-2000-2026.html",
    ROOT / "kor/column/isa-account-tax-free-2026.html",
)


class OverseasStockTaxClusterTests(unittest.TestCase):
    def test_pillar_removes_unverified_claims_and_shows_official_basis(self):
        html = PILLAR.read_text(encoding="utf-8")
        self.assertNotIn("3년마다 재계산", html)
        self.assertNotIn("양도세 사실상 0", html)
        self.assertNotIn("2025년 이후 이월과세", html)
        self.assertNotIn("서민형 기준 최대", html)
        self.assertIn("2026-08-21", html)
        self.assertIn("https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=8800", html)
        self.assertIn("https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&amp;lsJoLnkSeq=1014705955", html)
        self.assertIn("일반 정보", html)

    def test_calculator_computes_taxable_gain_and_total_estimate(self):
        html = CALCULATOR.read_text(encoding="utf-8")
        scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, re.S)
        calculation_script = next(script for script in scripts if "estimateOverseasStockTax" in script)
        command = (
            calculation_script
            + "\nconsole.log(JSON.stringify(["
            + "estimateOverseasStockTax(10000000),"
            + "estimateOverseasStockTax(2500000)]));"
        )
        result = subprocess.run(
            ["node", "-e", command],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        estimates = json.loads(result.stdout)
        self.assertEqual(estimates[0]["taxableGain"], 7_500_000)
        self.assertEqual(estimates[0]["nationalTax"], 1_500_000)
        self.assertEqual(estimates[0]["localTax"], 150_000)
        self.assertEqual(estimates[0]["totalTax"], 1_650_000)
        self.assertEqual(estimates[1]["totalTax"], 0)

    def test_calculator_is_browser_only_and_discloses_scope(self):
        html = CALCULATOR.read_text(encoding="utf-8")
        self.assertIn('rel="canonical" href="https://emfls.github.io/kor/util/overseas-stock-tax-calculator/"', html)
        self.assertIn("입력값은 서버로 전송되지 않습니다", html)
        self.assertIn("신고 세액을 보장하지 않습니다", html)
        self.assertIn("국내·국외 과세대상 주식의 손익통산", html)
        self.assertNotIn("<ins class=\"adsbygoogle\"", html)

    def test_cluster_pages_link_to_pillar_and_calculator(self):
        pillar_path = "/kor/column/overseas-stock-tax-2026.html"
        calculator_path = "/kor/util/overseas-stock-tax-calculator/"
        for page in (PILLAR, *RELATED):
            with self.subTest(page=page.name):
                html = page.read_text(encoding="utf-8")
                self.assertIn(calculator_path, html)
                if page != PILLAR:
                    self.assertIn(pillar_path, html)

    def test_cluster_metadata_has_current_verification_and_sources(self):
        entries = {
            item["url"]: item
            for item in json.loads((ROOT / "data/content-metadata.json").read_text(encoding="utf-8"))
        }
        urls = (
            "/kor/column/overseas-stock-tax-2026.html",
            "/kor/util/overseas-stock-tax-calculator/",
        )
        for url in urls:
            with self.subTest(url=url):
                metadata = entries[url]
                self.assertEqual(metadata["last_verified"], "2026-08-21")
                self.assertLessEqual(metadata["review_interval"], 90)
                self.assertTrue(metadata["ymyl"])
                self.assertGreaterEqual(len(metadata["sources"]), 2)


if __name__ == "__main__":
    unittest.main()
