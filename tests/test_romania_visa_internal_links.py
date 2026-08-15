from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
TARGET = "/kor/report/visa/romania.html"


class RomaniaVisaInternalLinksTest(unittest.TestCase):
    def test_all_romania_guides_link_once_to_visa_page(self):
        pages = sorted((ROOT / "kor/report/travel").glob("romania-*.html"))
        self.assertEqual(40, len(pages))

        for page in pages:
            html = page.read_text(encoding="utf-8")
            self.assertEqual(1, html.count(f'href="{TARGET}"'), page.name)
            self.assertIn("루마니아 비자·솅겐 체류일 안내", html, page.name)


if __name__ == "__main__":
    unittest.main()
