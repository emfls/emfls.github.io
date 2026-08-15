from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
TARGET = "/kor/report/visa/slovakia.html"


class SlovakiaVisaInternalLinksTest(unittest.TestCase):
    def test_all_slovakia_guides_link_once_to_visa_page(self):
        pages = sorted((ROOT / "kor/report/travel").glob("slovakia-*.html"))
        self.assertEqual(26, len(pages))

        for page in pages:
            html = page.read_text(encoding="utf-8")
            self.assertEqual(1, html.count(f'href="{TARGET}"'), page.name)
            self.assertIn("슬로바키아 비자·솅겐 체류일 안내", html, page.name)


if __name__ == "__main__":
    unittest.main()
