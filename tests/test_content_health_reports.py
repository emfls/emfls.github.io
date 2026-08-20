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
                '<a href="missing.html">bad</a><a href="https://example.com">external</a>',
                encoding="utf-8",
            )
            (root / "exists").mkdir()
            (root / "exists/index.html").write_text("ok", encoding="utf-8")
            (root / "page.html").write_text("ok", encoding="utf-8")

            broken = find_broken_internal_links(root)

        self.assertEqual(broken, [{"source": "/", "target": "/missing.html"}])

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
