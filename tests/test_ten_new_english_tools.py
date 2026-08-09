import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOOLS = {
    "base64": ("Base64", "runBase64"),
    "url-encoder": ("URL Encoder", "runUrlCodec"),
    "uuid-generator": ("UUID Generator", "generateUuids"),
    "unix-timestamp": ("Unix Timestamp", "convertTimestamp"),
    "regex-tester": ("Regex Tester", "testRegex"),
    "aspect-ratio": ("Aspect Ratio", "calculateRatio"),
    "percentage-calculator": ("Percentage Calculator", "calculatePercentage"),
    "date-difference": ("Date Difference", "calculateDateDifference"),
    "reading-time": ("Reading Time", "calculateReadingTime"),
    "loan-payment-calculator": ("Loan Payment", "calculateLoanPayment"),
}


class TenNewEnglishToolsTest(unittest.TestCase):
    def test_each_tool_meets_publication_contract(self):
        for slug, (intent, marker) in TOOLS.items():
            with self.subTest(tool=slug):
                path = ROOT / "util" / slug / "index.html"
                self.assertTrue(path.exists(), f"missing {path}")
                html = path.read_text(encoding="utf-8")
                canonical = f"https://emfls.github.io/util/{slug}/"
                self.assertIn(f'href="{canonical}"', html)
                self.assertRegex(html, rf"<title>[^<]*{re.escape(intent)}")
                self.assertRegex(html, rf"<h1[^>]*>[^<]*{re.escape(intent)}")
                self.assertIn(marker, html)
                self.assertIn("G-QP5Q67GE5B", html)
                self.assertIn("ca-pub-8830524482034754", html)
                self.assertIn('href="../new-tools.css"', html)
                self.assertIn("Reviewed: 2026-08-09", html)
                self.assertIn("processed in your browser", html)
                self.assertNotRegex(html, r"\.innerHTML\s*=")
                blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
                schemas = [json.loads(block) for block in blocks]
                self.assertIn("WebApplication", {x.get("@type") for x in schemas})
                self.assertIn("FAQPage", {x.get("@type") for x in schemas})
                self.assertTrue(all(x.get("dateModified") == "2026-08-09" for x in schemas))

    def test_hub_and_sitemap_link_every_tool(self):
        hub = (ROOT / "util" / "index.html").read_text(encoding="utf-8")
        sitemap = (ROOT / "util" / "sitemap.xml").read_text(encoding="utf-8")
        for slug in TOOLS:
            with self.subTest(tool=slug):
                self.assertIn(f'href="/util/{slug}/"', hub)
                self.assertIn(f"https://emfls.github.io/util/{slug}/", sitemap)

    def test_shared_styles_constrain_mobile_ads(self):
        css = (ROOT / "util" / "new-tools.css").read_text(encoding="utf-8")
        self.assertIn('div[id^="aswift_"]', css)
        self.assertIn("max-width:100%!important", css)


if __name__ == "__main__":
    unittest.main()
