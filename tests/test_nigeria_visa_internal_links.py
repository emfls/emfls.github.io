from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
TARGET = "/kor/report/visa/nigeria.html"


class NigeriaVisaInternalLinksTest(unittest.TestCase):
    def test_all_nigeria_guides_link_once_to_visa_page(self):
        pages = sorted((ROOT / "kor/report/travel").glob("nigeria-*.html"))
        self.assertEqual(39, len(pages))

        for page in pages:
            html = page.read_text(encoding="utf-8")
            self.assertEqual(1, html.count(f'href="{TARGET}"'), page.name)
            self.assertIn("나이지리아 비자·e-Visa 신청 안내", html, page.name)


if __name__ == "__main__":
    unittest.main()
