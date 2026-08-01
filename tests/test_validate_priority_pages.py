import tempfile
import unittest
from pathlib import Path

from scripts.validate_priority_pages import validate_page


COMPLETE_HTML = """<!doctype html>
<html lang="ko">
<head>
  <title>검증 페이지</title>
  <link rel="canonical" href="https://emfls.github.io/example.html">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-QP5Q67GE5B"></script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8830524482034754"></script>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Article","dateModified":"2026-08-01"}
  </script>
</head>
<body>
  <main>
    <h1>검증 페이지</h1>
    <p>최근 확인: 2026-08-01</p>
    <a href="https://www.gov.kr/">공식 출처</a>
  </main>
</body>
</html>
"""


class ValidatePriorityPageTests(unittest.TestCase):
    def write_page(self, content: str) -> Path:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        page = Path(temp_dir.name) / "page.html"
        page.write_text(content, encoding="utf-8")
        return page

    def test_complete_page_passes(self):
        page = self.write_page(COMPLETE_HTML)

        self.assertEqual(validate_page(page), [])

    def test_missing_requirements_are_reported(self):
        page = self.write_page("<html><body><h1>제목</h1></body></html>")

        errors = validate_page(page)

        self.assertIn("missing canonical", errors)
        self.assertIn("missing GA4 measurement ID", errors)
        self.assertIn("missing AdSense publisher ID", errors)
        self.assertIn("missing main element", errors)
        self.assertIn("missing JSON-LD dateModified", errors)
        self.assertIn("missing HTTPS official source", errors)
        self.assertIn("missing recent verification date", errors)


if __name__ == "__main__":
    unittest.main()
