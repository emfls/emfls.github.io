import json
import tempfile
import unittest
from pathlib import Path

from scripts.seo_audit import audit_site, parse_html


class SeoAuditParserTests(unittest.TestCase):
    def test_extracts_quality_scoring_signals(self):
        html = """<!doctype html><html lang="en"><head>
        <title>Example Calculator</title><meta name="viewport" content="width=device-width">
        <meta name="author" content="emfls"><link rel="canonical" href="https://emfls.github.io/util/example/">
        </head><body><nav class="breadcrumb"><a href="/util/">Tools</a></nav>
        <main><h1>Example Calculator</h1><p>Immediate answer with 2026 data and a clear result for visitors.</p>
        <h2>Methodology</h2><h3>Formula</h3><p>Method and calculation formula.</p>
        <table class="responsive-table"><tr><td>1</td></tr></table>
        <form><input><button>Calculate</button></form><img src="x.jpg">
        <section class="related-posts"><a href="/about/">About methodology</a></section>
        <p>Limit: results may differ.</p></main></body></html>"""

        page = parse_html(html, Path("util/example/index.html"))

        self.assertEqual(page["h3_count"], 1)
        self.assertEqual(page["image_alt_missing"], 1)
        self.assertTrue(page["has_viewport"])
        self.assertTrue(page["has_table"])
        self.assertTrue(page["has_table_overflow"])
        self.assertTrue(page["has_form"])
        self.assertTrue(page["has_breadcrumb"])
        self.assertTrue(page["has_related_section"])
        self.assertTrue(page["has_author_signal"])
        self.assertTrue(page["has_method_signal"])
        self.assertTrue(page["has_limitation_signal"])
        self.assertTrue(page["has_about_methodology_link"])
        self.assertTrue(page["has_parent_hub_link"])
        self.assertEqual(page["interactive_controls"], 2)
        self.assertTrue(page["visible_text_prefix"].startswith("Tools Example Calculator Immediate answer"))

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

    def test_extracts_dates_from_json_ld_when_meta_dates_are_absent(self):
        html = """<html><head><title>X</title>
        <script type="application/ld+json">{
          "@type":"Article",
          "datePublished":"2025-03-04T10:00:00+09:00",
          "dateModified":"2026-07-08"
        }</script></head><body><h1>X</h1></body></html>"""
        page = parse_html(html, Path("dated.html"))
        self.assertEqual(page["published_date"], "2025-03-04")
        self.assertEqual(page["updated_date"], "2026-07-08")

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
