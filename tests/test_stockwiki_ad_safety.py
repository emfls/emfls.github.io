import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = [ROOT / "kor/stockwiki/index.html", *sorted((ROOT / "kor/stockwiki/stocks").glob("*/index.html"))]
SCRIPT = ROOT / "scripts/remove_stockwiki_placeholder_ads.py"


class StockWikiAdSafetyTest(unittest.TestCase):
    def test_exact_inventory_has_no_dead_or_fixed_ads(self):
        self.assertEqual(11, len(PAGES))
        forbidden = (
            "ca-pub-XXXXXXXXXXXXXXXX",
            "adsbygoogle",
            "ad-slot",
            "mobile-ad-fixed",
        )
        for page in PAGES:
            html = page.read_text(encoding="utf-8")
            with self.subTest(page=page.relative_to(ROOT)):
                for marker in forbidden:
                    self.assertNotIn(marker, html)
                self.assertIn('rel="canonical"', html)
                self.assertIn("본 사이트의 정보는 투자 권유가 아닙니다", html)

    def test_cleanup_is_idempotent(self):
        spec = importlib.util.spec_from_file_location("stockwiki_cleanup", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for page in PAGES:
            html = page.read_text(encoding="utf-8")
            with self.subTest(page=page.relative_to(ROOT)):
                self.assertEqual(html, module.clean_html(html))


if __name__ == "__main__":
    unittest.main()
