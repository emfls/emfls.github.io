import json
import re
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOOLS = {
    "discount-calculator": ("Discount Calculator", "calculateDiscount"),
    "profit-margin-calculator": ("Profit Margin Calculator", "calculateMargin"),
    "unit-price-calculator": ("Unit Price Calculator", "compareUnitPrices"),
    "fuel-cost-calculator": ("Fuel Cost Calculator", "calculateFuelCost"),
    "tip-calculator": ("Tip Calculator", "calculateTip"),
    "split-bill-calculator": ("Split Bill Calculator", "calculateSplitBill"),
    "sales-tax-calculator": ("Sales Tax Calculator", "calculateSalesTax"),
    "gpa-calculator": ("GPA Calculator", "calculateGpa"),
    "running-pace-calculator": ("Running Pace Calculator", "calculatePace"),
    "data-storage-converter": ("Data Storage Converter", "convertStorage"),
}


def run_pure(slug, expression):
    html = (ROOT / "util" / slug / "index.html").read_text(encoding="utf-8")
    match = re.search(r"<!-- PURE_START -->(.*?)<!-- PURE_END -->", html, re.S)
    if not match:
        raise AssertionError(f"missing pure calculation block in {slug}")
    script = match.group(1) + f"\nconsole.log(JSON.stringify({expression}));"
    result = subprocess.run(["node", "-e", script], text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


class TenNewRevenueToolsTest(unittest.TestCase):
    def test_each_tool_meets_publication_contract(self):
        for slug, (intent, marker) in TOOLS.items():
            with self.subTest(tool=slug):
                path = ROOT / "util" / slug / "index.html"
                self.assertTrue(path.exists(), f"missing {path}")
                html = path.read_text(encoding="utf-8")
                compact = "".join(html.split())
                self.assertIn('<html lang="en">', html)
                self.assertIn(f'href="https://emfls.github.io/util/{slug}/"', html)
                self.assertRegex(html, rf"<title>[^<]*{re.escape(intent)}")
                self.assertRegex(html, rf"<h1[^>]*>[^<]*{re.escape(intent)}")
                self.assertIn(marker, html)
                self.assertIn("G-QP5Q67GE5B", html)
                self.assertIn("ca-pub-8830524482034754", html)
                self.assertIn('href="../new-tools.css"', html)
                self.assertIn("Reviewed: 2026-08-10", html)
                self.assertIn("processed in your browser", html)
                self.assertNotRegex(html, r"\.innerHTML\s*=")
                schemas = [json.loads(x) for x in re.findall(
                    r'<script type="application/ld\+json">(.*?)</script>', html, re.S
                )]
                self.assertEqual({"WebApplication", "FAQPage"}, {x.get("@type") for x in schemas})
                self.assertTrue(all(x.get("dateModified") == "2026-08-10" for x in schemas))

    def test_hub_and_sitemap_discover_each_tool(self):
        hub = (ROOT / "util" / "index.html").read_text(encoding="utf-8")
        sitemap = (ROOT / "util" / "sitemap.xml").read_text(encoding="utf-8")
        for slug in TOOLS:
            with self.subTest(tool=slug):
                self.assertIn(f'href="/util/{slug}/"', hub)
                self.assertIn(f"https://emfls.github.io/util/{slug}/", sitemap)

    def test_money_and_shopping_calculations(self):
        self.assertEqual({"savings": 20, "finalPrice": 80}, run_pure(
            "discount-calculator", "calculateDiscount(100,20)"
        ))
        margin = run_pure("profit-margin-calculator", "calculateMargin(60,100)")
        self.assertAlmostEqual(40, margin["profit"])
        self.assertAlmostEqual(40, margin["margin"])
        self.assertAlmostEqual(66.6666666667, margin["markup"], places=6)
        units = run_pure("unit-price-calculator", "compareUnitPrices(6,2,10,5)")
        self.assertEqual({"unitA": 3, "unitB": 2, "better": "B"}, units)
        self.assertEqual({"tip": 20, "total": 120, "tipPerPerson": 5, "totalPerPerson": 30}, run_pure(
            "tip-calculator", "calculateTip(100,20,4)"
        ))
        self.assertEqual({"tax": 10, "tip": 20, "total": 130, "perPerson": 26}, run_pure(
            "split-bill-calculator", "calculateSplitBill(100,10,20,5)"
        ))
        extracted = run_pure("sales-tax-calculator", "calculateSalesTax(110,10,'extract')")
        self.assertAlmostEqual(100, extracted["base"])
        self.assertAlmostEqual(10, extracted["tax"])
        self.assertEqual(110, extracted["total"])

    def test_travel_study_fitness_and_storage_calculations(self):
        self.assertEqual({"fuel": 50, "cost": 100, "perPerson": 50}, run_pure(
            "fuel-cost-calculator", "calculateFuelCost(500,10,2,2)"
        ))
        self.assertEqual({"credits": 4, "qualityPoints": 14, "gpa": 3.5}, run_pure(
            "gpa-calculator", "calculateGpa([{credits:3,points:4},{credits:1,points:2}])"
        ))
        pace = run_pure("running-pace-calculator", "calculatePace(5,1500)")
        self.assertEqual(300, pace["secondsPerKm"])
        self.assertAlmostEqual(12, pace["speedKmh"])
        storage = run_pure("data-storage-converter", "convertStorage(1,'GiB','GB')")
        self.assertEqual(1073741824, storage["bytes"])
        self.assertAlmostEqual(1.073741824, storage["value"])

    def test_boundary_errors_are_explicit(self):
        self.assertIn("error", run_pure("profit-margin-calculator", "calculateMargin(0,0)"))
        self.assertIn("error", run_pure("unit-price-calculator", "compareUnitPrices(1,0,2,1)"))
        self.assertIn("error", run_pure("running-pace-calculator", "calculatePace(0,100)"))
        self.assertEqual({"savings": 0, "finalPrice": 100}, run_pure(
            "discount-calculator", "calculateDiscount(100,0)"
        ))
        self.assertEqual({"tip": 0, "total": 100, "tipPerPerson": 0, "totalPerPerson": 25}, run_pure(
            "tip-calculator", "calculateTip(100,0,4)"
        ))


if __name__ == "__main__":
    unittest.main()
