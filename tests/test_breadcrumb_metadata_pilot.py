import json
import re
import unittest

from scripts.apply_breadcrumb_metadata import inject_metadata


class BreadcrumbMetadataPilotTests(unittest.TestCase):
    def test_content_page_adds_matching_visible_breadcrumb_and_jsonld(self):
        html = '<html><head><title>Visa Guide</title></head><body><main><h1>Visa Guide</h1></main></body></html>'
        crumbs = [("Home", "/"), ("Visa", "/kor/report/visa/"), ("Visa Guide", "/kor/report/visa/a.html")]
        result = inject_metadata(html, crumbs, "Article", "2025-06-11", "2026-08-13", "ko")
        self.assertIn('data-seo-breadcrumb="pilot"', result)
        self.assertIn('data-article-meta="pilot"', result)
        blocks = re.findall(r'<script type="application/ld\+json" data-seo-schema="pilot">(.*?)</script>', result, re.S)
        types = {json.loads(block)["@type"] for block in blocks}
        self.assertEqual(types, {"BreadcrumbList", "Article"})
        self.assertIn("작성일 2025-06-11", result)
        self.assertIn("최종 업데이트 2026-08-13", result)

    def test_game_page_gets_breadcrumb_without_fake_article(self):
        html = '<html><head><title>Game</title></head><body><h1>Game</h1></body></html>'
        result = inject_metadata(html, [("Home", "/"), ("Game", "/game/a/")], None, "", "2026-08-11", "en")
        self.assertIn('"@type": "BreadcrumbList"', result)
        self.assertNotIn('"@type": "Article"', result)
        self.assertNotIn('data-article-meta="pilot"', result)

    def test_injection_is_idempotent(self):
        html = '<html><head><title>X</title></head><body><h1>X</h1></body></html>'
        crumbs = [("Home", "/"), ("X", "/x")]
        once = inject_metadata(html, crumbs, "Article", "2025-01-01", "2026-01-01", "en")
        self.assertEqual(inject_metadata(once, crumbs, "Article", "2025-01-01", "2026-01-01", "en"), once)


if __name__ == "__main__":
    unittest.main()
