import tempfile
import unittest
from datetime import date
from pathlib import Path

from scripts.content_health_reports import (
    analyze_duplicates,
    analyze_stale,
    find_broken_internal_links,
    normalize_search_intent,
)


class ContentHealthReportTests(unittest.TestCase):
    def test_duplicate_groups_ignore_blank_values(self):
        pages = [
            {"url": "/a", "title": "Same", "description": "D", "canonical": "https://x/a"},
            {"url": "/b", "title": "Same", "description": "D", "canonical": "https://x/a"},
            {"url": "/c", "title": "", "description": "", "canonical": ""},
        ]
        result = analyze_duplicates(pages)
        self.assertEqual(result["titles"][0]["urls"], ["/a", "/b"])
        self.assertEqual(result["descriptions"][0]["urls"], ["/a", "/b"])
        self.assertEqual(result["canonicals"][0]["urls"], ["/a", "/b"])
        self.assertEqual(len(result["titles"]), 1)

    def test_internal_link_resolution_handles_directories_files_and_fragments(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "index.html").write_text(
                '<a href="/exists/">ok</a><a href="/page.html#part">ok2</a>'
                '<a href="/">home</a><a href="/exists/index.html">explicit index</a>'
                '<a href="/page">extensionless</a><a href="/feed.xml">non-html file</a>'
                '<a href="missing.html">bad</a><a href="https://example.com">external</a>',
                encoding="utf-8",
            )
            (root / "exists").mkdir()
            (root / "exists/index.html").write_text("ok", encoding="utf-8")
            (root / "page.html").write_text("ok", encoding="utf-8")
            (root / "feed.xml").write_text("ok", encoding="utf-8")

            broken = find_broken_internal_links(root)

        self.assertEqual(broken, [{"source": "/", "target": "/missing.html"}])

    def test_noindex_source_template_is_not_an_indexable_link_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / "scripts" / "templates"
            folder.mkdir(parents=True)
            source = folder / "notion_article.html"
            source.write_text(
                '<meta name="robots" content="noindex,nofollow">'
                '<a href="{{CATEGORY_HREF}}">raw placeholder</a>'
                '<a href="/broken-static-nav.html">broken static link</a>',
                encoding="utf-8",
            )
            (root / "index.html").write_text(
                '<a href="/missing-article.html">broken public article</a>',
                encoding="utf-8",
            )
            self.assertEqual(
                find_broken_internal_links(root),
                [
                    {"source": "/", "target": "/missing-article.html"},
                    {"source": "/scripts/templates/notion_article.html", "target": "/broken-static-nav.html"},
                ],
            )

            # Without noindex, the raw template remains a public HTML route:
            # don't silently hide its unresolved public link.
            source.write_text(
                '<meta name="robots" content="index,follow">'
                '<a href="{{CATEGORY_HREF}}">raw placeholder</a>',
                encoding="utf-8",
            )
            broken = find_broken_internal_links(root)
            self.assertIn(
                {"source": "/", "target": "/missing-article.html"},
                broken,
            )
            self.assertIn(
                {
                    "source": "/scripts/templates/notion_article.html",
                    "target": "/scripts/templates/{{CATEGORY_HREF}}",
                },
                broken,
            )

    def test_stale_requires_a_known_date_and_keeps_unknown_separate(self):
        pages = [
            {"url": "/old", "updated_date": "2025-01-01", "published_date": "", "category": "report"},
            {"url": "/fresh", "updated_date": "2026-08-01", "published_date": "", "category": "report"},
            {"url": "/unknown", "updated_date": "", "published_date": "", "category": "report"},
        ]
        result = analyze_stale(pages, as_of=date(2026, 8, 20), default_interval=365)
        self.assertEqual([item["url"] for item in result["stale"]], ["/old"])
        self.assertEqual(result["unknown_freshness"], ["/unknown"])

    def test_search_intent_normalization_removes_year_and_brand_noise(self):
        self.assertEqual(
            normalize_search_intent("미국주식 세금 총정리 2026 | emfls.github.io"),
            "미국주식 세금 총정리",
        )


if __name__ == "__main__":
    unittest.main()
