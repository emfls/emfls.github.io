import json
import tempfile
import unittest
from pathlib import Path

from scripts.seo_audit import audit_site, parse_html


class SeoAuditParserTests(unittest.TestCase):
    def test_extracts_required_page_fields(self):
        html = """<!doctype html><html lang="ko"><head>
        <title>테스트 페이지</title>
        <meta name="description" content="설명입니다">
        <meta name="robots" content="index,follow">
        <meta property="article:published_time" content="2026-01-01">
        <meta property="article:modified_time" content="2026-02-02">
        <link rel="canonical" href="https://emfls.github.io/kor/report/test.html">
        <script type="application/ld+json">{"@type":"Article"}</script>
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST"></script>
        </head><body><h1>제목</h1><h2>소제목</h2><p>하나 둘 셋 넷</p>
        <img src="x.webp" alt="x"><a href="/kor/">내부</a><a href="https://example.com">외부</a>
        </body></html>"""

        page = parse_html(html, Path("kor/report/test.html"))

        self.assertEqual(page["url"], "/kor/report/test.html")
        self.assertEqual(page["title"], "테스트 페이지")
        self.assertEqual(page["description"], "설명입니다")
        self.assertEqual(page["language"], "ko")
        self.assertEqual(page["category"], "report")
        self.assertEqual(page["h1_count"], 1)
        self.assertEqual(page["h2_count"], 1)
        self.assertEqual(page["internal_links"], 1)
        self.assertEqual(page["external_links"], 1)
        self.assertEqual(page["images"], 1)
        self.assertEqual(page["structured_data_types"], ["Article"])
        self.assertEqual(page["canonical"], "https://emfls.github.io/kor/report/test.html")
        self.assertTrue(page["indexable"])
        self.assertTrue(page["adsense"])
        self.assertTrue(page["ga4"])
        self.assertEqual(page["published_date"], "2026-01-01")
        self.assertEqual(page["updated_date"], "2026-02-02")

    def test_noindex_page_is_not_indexable_and_malformed_jsonld_is_recorded(self):
        html = """<html><head><title>X</title><meta name="robots" content="noindex">
        <script type="application/ld+json">{broken</script></head><body><h1>X</h1></body></html>"""
        page = parse_html(html, Path("private.html"))
        self.assertFalse(page["indexable"])
        self.assertEqual(page["parse_warnings"], ["invalid_json_ld"])

    def test_meta_without_name_or_property_is_ignored(self):
        html = '<html><head><meta charset="utf-8"><title>X</title></head><body><h1>X</h1></body></html>'
        page = parse_html(html, Path("charset.html"))
        self.assertEqual(page["title"], "X")

    def test_audit_is_deterministic_and_does_not_modify_html(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            first = root / "b.html"
            second = root / "a.html"
            first.write_text("<html><head><title>B</title></head><body>B</body></html>", encoding="utf-8")
            second.write_text("<html><head><title>A</title></head><body>A</body></html>", encoding="utf-8")
            before = {path: path.read_bytes() for path in (first, second)}

            one = audit_site(root)
            two = audit_site(root)

            self.assertEqual(one, two)
            self.assertEqual([page["path"] for page in one["pages"]], ["a.html", "b.html"])
            self.assertEqual(before, {path: path.read_bytes() for path in (first, second)})
            json.dumps(one, ensure_ascii=False)


if __name__ == "__main__":
    unittest.main()
