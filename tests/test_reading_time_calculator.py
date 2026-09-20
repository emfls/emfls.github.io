import json
import html
import re
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "util" / "reading-time" / "index.html"
EXPECTED_DATE = "2026-09-20"


class ReadingTimeCalculatorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.scripts = re.findall(r"<script(?: [^>]*)?>(.*?)</script>", cls.html, re.S)
        cls.inline_js = cls.scripts[-1].split("document.querySelectorAll")[0]

    def test_public_identity_and_scope(self):
        self.assertEqual(self.html.count('rel="canonical"'), 1)
        self.assertIn("https://emfls.github.io/util/reading-time/", self.html)
        self.assertEqual(len(re.findall(r"<h1\b", self.html)), 1)
        self.assertIn("Reading Time &amp; Speaking Time Calculator", self.html)
        for marker in ("word count", "target", "read-aloud", "speaking"):
            self.assertIn(marker, self.html.lower())
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertIn("ca-pub-8830524482034754", self.html)

    def test_structured_data_and_visible_faq_parity(self):
        blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', self.html, re.S)
        schemas = [json.loads(block) for block in blocks]
        self.assertEqual(sum(x.get("@type") == "WebApplication" for x in schemas), 1)
        self.assertEqual(sum(x.get("@type") == "FAQPage" for x in schemas), 1)
        self.assertTrue(all(x.get("dateModified") == EXPECTED_DATE for x in schemas))
        faq = next(x for x in schemas if x.get("@type") == "FAQPage")
        visible_pairs = []
        for question, answer in re.findall(r'<details><summary>(.*?)</summary><p>(.*?)</p></details>', self.html, re.S):
            visible_pairs.append((html.unescape(re.sub(r'\s+', ' ', question).strip()), html.unescape(re.sub(r'\s+', ' ', answer).strip())))
        schema_pairs = [(item["name"], item["acceptedAnswer"]["text"]) for item in faq["mainEntity"]]
        self.assertEqual(visible_pairs, schema_pairs)
        self.assertGreaterEqual(len(visible_pairs), 5)

    def test_word_count_and_speaking_contracts(self):
        self.assertIn("adjustable", self.html.lower())
        self.assertIn("183 WPM is an English adult oral-reading research reference", self.html)
        self.assertNotIn("/util/tts/", self.html)
        runner = self.inline_js + "\n" + r'''
console.log(JSON.stringify({
  empty: validateCountInput(''),
  zero: validateCountInput('0'),
  negative: validateCountInput('-1'),
  decimal: validateCountInput('1.5')
}));
'''
        result = subprocess.run(["node", "-e", runner], capture_output=True, text=True, check=True)
        values = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertFalse(values["empty"])
        self.assertTrue(values["zero"])
        self.assertFalse(values["negative"])
        self.assertFalse(values["decimal"])

    def test_calculation_contract_with_node(self):
        runner = self.inline_js + "\n" + r'''
const values = {
  count: countWords("one two three café John's well-known 123"),
  silent: formatDuration(calculateTime(1000, 238)),
  aloud: formatDuration(calculateTime(1000, 183)),
  reverse: calculateTargetWords(5, 183),
  zero: calculateTime(0, 238),
  invalidWpm: validateRate(0),
  invalidNegative: validateCount(-1),
  invalidDuration: validateDuration(-1)
};
console.log(JSON.stringify(values));
'''
        result = subprocess.run(["node", "-e", runner], capture_output=True, text=True, check=True)
        values = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertEqual(values["count"], 7)
        self.assertEqual(values["silent"], "4 min 12 sec")
        self.assertEqual(values["aloud"], "5 min 28 sec")
        self.assertEqual(values["reverse"], 915)
        self.assertEqual(values["zero"], 0)
        self.assertFalse(values["invalidWpm"])
        self.assertFalse(values["invalidNegative"])
        self.assertFalse(values["invalidDuration"])

    def test_privacy_and_propagation_contract(self):
        lowered = self.inline_js.lower()
        self.assertIn("processed in your browser", self.html)
        self.assertIn("analytics", self.html.lower())
        self.assertNotRegex(lowered, r"fetch\s*\(|xmlhttprequest|localstorage|sessionstorage")
        self.assertNotRegex(lowered, r"gtag\s*\([^)]*(text|textarea|word)")
        hub = (ROOT / "util" / "index.html").read_text(encoding="utf-8")
        self.assertIn("Reading &amp; Speaking Time Calculator", hub)
        sitemap = (ROOT / "util" / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn(f"<lastmod>{EXPECTED_DATE}</lastmod>", sitemap[sitemap.index("/util/reading-time/") : sitemap.index("/util/reading-time/") + 180])


if __name__ == "__main__":
    unittest.main()
