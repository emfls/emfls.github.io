import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = [ROOT / "kor/stockwiki/index.html", *sorted((ROOT / "kor/stockwiki/stocks").glob("*/index.html"))]
SCRIPT = ROOT / "scripts/remove_stockwiki_placeholder_ads.py"
SOURCE = ROOT / "kor/stockwiki/src"
LAYOUT = SOURCE / "layouts/StockLayout.astro"
BUILD = ROOT / "kor/stockwiki/dist"
AD_MARKERS = (
    "ca-pub-",
    "adsbygoogle",
    "ad-slot",
    "AdSlot",
    "mobile-ad-fixed",
    "ads-partners.coupang.com",
    "AF_XXXXXXXX",
    "XXXXXXXX",
)


class StockWikiAdSafetyTest(unittest.TestCase):
    def test_source_cannot_regenerate_placeholder_or_production_ads(self):
        source_files = sorted(path for path in SOURCE.rglob("*") if path.is_file())
        self.assertTrue(source_files)
        for source_file in source_files:
            content = source_file.read_text(encoding="utf-8")
            for marker in AD_MARKERS:
                self.assertFalse(
                    marker in content,
                    f"{source_file.relative_to(ROOT)} contains {marker!r}",
                )

    def test_layout_has_no_fixed_bottom_ad_or_ad_only_spacing(self):
        layout = LAYOUT.read_text(encoding="utf-8")
        for marker in ("mobile-ad-fixed", "position: fixed", "bottom: 0", "padding-bottom: 80px"):
            self.assertFalse(marker in layout, f"StockLayout.astro contains {marker!r}")

    def test_exact_inventory_has_no_dead_or_fixed_ads(self):
        self.assertEqual(11, len(PAGES))
        for page in PAGES:
            html = page.read_text(encoding="utf-8")
            with self.subTest(page=page.relative_to(ROOT)):
                for marker in AD_MARKERS:
                    self.assertNotIn(marker, html)
                self.assertIn('rel="canonical"', html)
                self.assertIn("본 사이트의 정보는 투자 권유가 아닙니다", html)

    def test_served_pages_keep_stock_navigation_and_content(self):
        home = (ROOT / "kor/stockwiki/index.html").read_text(encoding="utf-8")
        detail = (ROOT / "kor/stockwiki/stocks/005930/index.html").read_text(encoding="utf-8")
        self.assertIn('id="market-tabs"', home)
        self.assertIn('class="stock-grid"', home)
        self.assertIn("005930", home)
        self.assertIn("navbar-links", home)
        self.assertIn("핵심 투자지표", detail)
        self.assertIn("사업 개요", detail)
        self.assertIn('href="/kor/stockwiki/"', detail)

    @unittest.skipUnless(BUILD.exists(), "run the fresh Astro build before checking dist")
    def test_fresh_build_cannot_emit_advertising_markup(self):
        build_pages = [BUILD / "index.html", *sorted((BUILD / "stocks").glob("*/index.html"))]
        self.assertEqual(11, len(build_pages))
        for output_file in (path for path in BUILD.rglob("*") if path.is_file()):
            output = output_file.read_bytes()
            for marker in AD_MARKERS:
                self.assertFalse(
                    marker.encode() in output,
                    f"{output_file.relative_to(ROOT)} contains {marker!r}",
                )
        for page in build_pages:
            html = page.read_text(encoding="utf-8")
            with self.subTest(page=page.relative_to(ROOT)):
                for marker in AD_MARKERS:
                    self.assertNotIn(marker, html)
                self.assertIn('rel="canonical"', html)
                self.assertIn("본 사이트의 정보는 투자 권유가 아닙니다", html)
        self.assertIn('class="navbar-links"', build_pages[0].read_text(encoding="utf-8"))

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
