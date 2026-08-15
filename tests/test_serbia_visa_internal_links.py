from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
TARGET = "/kor/report/visa/serbia.html"


class SerbiaVisaInternalLinksTest(unittest.TestCase):
    def test_all_serbia_guides_link_once_to_visa_page(self):
        pages = sorted((ROOT / "kor/report/travel").glob("serbia-*.html"))
        self.assertEqual(32, len(pages))

        for page in pages:
            html = page.read_text(encoding="utf-8")
            self.assertEqual(1, html.count(f'href="{TARGET}"'), page.name)
            self.assertIn("세르비아 비자·입국 조건 안내", html, page.name)


if __name__ == "__main__":
    unittest.main()
