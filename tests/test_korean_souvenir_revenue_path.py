import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "kor/report/travel/korean-souvenir-foreigners-2026.html"


class KoreanSouvenirRevenuePathTest(unittest.TestCase):
    def test_page_offers_fast_selection_and_next_steps(self):
        html = PAGE.read_text(encoding="utf-8")

        self.assertIn("30초 선택표", html)
        self.assertIn('class="quick-pick"', html)
        for criterion in ("여러 명에게 나눔", "가볍고 한국적", "식품 선물", "뷰티 선물"):
            self.assertIn(criterion, html)
        for anchor in ("#souvenir-list-title", "#shopping-checklist", "#related-travel"):
            self.assertIn(f'href="{anchor}"', html)

        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        page_schema = next(item for item in map(json.loads, schemas) if item.get("@type") == "WebPage")
        self.assertEqual("2026-08-25", page_schema["dateModified"])


if __name__ == "__main__":
    unittest.main()
