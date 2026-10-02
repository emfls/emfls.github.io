import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.seo_audit import (
    MAX_AUDIT_FILE_BYTES,
    audit_site,
    compact_audit,
    main,
    parse_html,
    serialize_audit,
    serialize_compact_audit,
)


BASE_COMMITTED_PAGE_FIELDS = (
    "path", "url", "title", "description", "language", "category", "published_date",
    "updated_date", "word_count", "h1_count", "h2_count", "internal_links",
    "external_links", "images", "structured_data_types", "canonical", "indexable",
    "adsense", "ga4", "parse_warnings",
)


class SeoAuditParserTests(unittest.TestCase):
    def test_site_audit_artifact_stays_below_git_host_blob_limit(self):
        path = Path(__file__).resolve().parents[1] / "data/site-audit.json"
        self.assertLess(path.stat().st_size, MAX_AUDIT_FILE_BYTES)

    def test_committed_site_audit_stays_below_25_mb_target(self):
        path = Path(__file__).resolve().parents[1] / "data/site-audit.json"
        self.assertLess(path.stat().st_size, 25 * 1024 * 1024)

    def test_site_audit_serializer_rejects_oversized_output(self):
        with self.assertRaisesRegex(ValueError, "site audit is"):
            serialize_audit({"payload": "x" * 20}, max_bytes=10)

    def test_compact_audit_keeps_the_legacy_contract_and_drops_scoring_payloads(self):
        legacy_page = {field: f"legacy-{field}" for field in BASE_COMMITTED_PAGE_FIELDS}
        full_page = {
            **legacy_page,
            "h3_count": 4,
            "internal_link_targets": ["/kor/"],
            "has_author_signal": True,
            "visible_text_prefix": "private long excerpt " * 1000,
        }
        full_audit = {"summary": {"total_pages": 1}, "parser_errors": [], "pages": [full_page]}

        compact = compact_audit(full_audit)
        compact_page = compact["pages"][0]

        self.assertEqual(tuple(compact_page), BASE_COMMITTED_PAGE_FIELDS)
        self.assertEqual(compact["summary"], full_audit["summary"])
        self.assertEqual(compact["parser_errors"], full_audit["parser_errors"])
        self.assertNotIn("visible_text_prefix", compact_page)
        self.assertNotIn("internal_link_targets", compact_page)
        self.assertNotIn("private long excerpt", serialize_compact_audit(full_audit).decode("utf-8"))
        self.assertIn("visible_text_prefix", json.loads(serialize_audit(full_audit))["pages"][0])

    def test_cli_writes_compact_committed_and_full_transient_outputs(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "site"
            root.mkdir()
            (root / "index.html").write_text(
                "<html><body><main>Transient scoring excerpt.</main></body></html>", encoding="utf-8"
            )
            compact_path = Path(temporary) / "site-audit.json"
            full_path = Path(temporary) / "site-audit-full.json"
            markdown_path = Path(temporary) / "seo-audit.md"
            argv = [
                "seo_audit.py", str(root), "--compact-json", str(compact_path),
                "--json", str(full_path), "--markdown", str(markdown_path),
            ]

            with patch.object(sys, "argv", argv):
                main()

            compact_page = json.loads(compact_path.read_text(encoding="utf-8"))["pages"][0]
            full_page = json.loads(full_path.read_text(encoding="utf-8"))["pages"][0]
            self.assertNotIn("visible_text_prefix", compact_page)
            self.assertIn("visible_text_prefix", full_page)
            self.assertTrue(markdown_path.exists())

    def test_cli_defaults_to_the_compact_committed_inventory(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "site"
            root.mkdir()
            (root / "index.html").write_text(
                "<html><body><main>Transient scoring excerpt.</main></body></html>", encoding="utf-8"
            )
            previous_cwd = Path.cwd()
            try:
                os.chdir(temporary)
                with patch.object(sys, "argv", ["seo_audit.py", str(root)]):
                    main()
            finally:
                os.chdir(previous_cwd)

            compact_page = json.loads(
                (Path(temporary) / "data/site-audit.json").read_text(encoding="utf-8")
            )["pages"][0]
            self.assertNotIn("visible_text_prefix", compact_page)

    def test_visible_text_prefix_is_bounded_to_250_words(self):
        body = " ".join(f"word{index}" for index in range(500))
        page = parse_html(f"<html><body><main>{body}</main></body></html>", Path("long.html"))

        self.assertEqual(len(page["visible_text_prefix"].split()), 250)

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
        self.assertEqual(page["internal_link_targets"], ["/kor/"])
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

    def test_audit_excludes_private_local_quality_dashboard(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "index.html").write_text("<html><title>Home</title></html>", encoding="utf-8")
            reports = root / "reports"
            reports.mkdir()
            (reports / "site-quality-dashboard.html").write_text("<html><title>Private</title></html>", encoding="utf-8")

            audit = audit_site(root)

            self.assertEqual([page["path"] for page in audit["pages"]], ["index.html"])


if __name__ == "__main__":
    unittest.main()
