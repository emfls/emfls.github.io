import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "util/qrcode/index.html"


class QrCodeRevenuePathTest(unittest.TestCase):
    def test_page_explains_core_tasks_and_routes_to_related_tools(self):
        html = PAGE.read_text(encoding="utf-8")

        for text in (
            "How to create a QR code",
            "How to scan a QR code",
            "QR code privacy and safety",
            "Updated: August 25, 2026",
        ):
            self.assertIn(text, html)

        for href in ("../barcode/", "../url-encoder/", "../base64/"):
            self.assertIn(f'href="{href}"', html)

        self.assertIn('class="qr-guide"', html)
        self.assertLess(html.index('class="qr-guide"'), html.index('id="backBtn"'))


if __name__ == "__main__":
    unittest.main()
