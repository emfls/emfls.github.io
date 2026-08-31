import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "report/travel/turkey-bursa.html": ("Bursa", "Adana"),
    "kor/report/travel/turkey-bursa.html": ("부르사", "아다나"),
    "jp/report/travel/turkey-bursa.html": ("ブルサ", "アダナ"),
    "report/travel/india-surat.html": ("Surat", "Pune"),
    "jp/report/travel/india-surat.html": ("スラト", "プネー"),
}


class NaverDuplicateTravelDocumentsTest(unittest.TestCase):
    def test_each_url_contains_only_its_own_complete_html_document(self):
        for relative_path, (expected_city, leaked_city) in PAGES.items():
            with self.subTest(path=relative_path):
                html = (ROOT / relative_path).read_text(encoding="utf-8")
                lowered = html.lower()

                self.assertEqual(lowered.count("<!doctype html>"), 1)
                self.assertEqual(lowered.count("<html"), 1)
                self.assertEqual(lowered.count("<title"), 1)
                self.assertEqual(lowered.count("<h1"), 1)
                self.assertEqual(lowered.count("</html>"), 1)
                self.assertIn(expected_city, html)
                self.assertNotIn(leaked_city, html)
                self.assertTrue(lowered.rstrip().endswith("</html>"))


if __name__ == "__main__":
    unittest.main()
