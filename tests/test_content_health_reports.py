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

from scripts.notion_article_template import TEMPLATE, render_article

ROOT = Path(__file__).resolve().parents[1]


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

    def test_yeongdeok_regional_links_target_the_published_gyeongbuk_guide(self):
        destination = "/kor/report/camp/gyeongbuk-camping-best.html"
        self.assertTrue((ROOT / destination.lstrip("/")).is_file())
        html = (ROOT / "kor/report/camp/yeongdeok.html").read_text(encoding="utf-8")
        self.assertEqual(html.count(f'href="{destination}"'), 2)
        self.assertNotIn('href="/kor/report/camp/gyeongbuk-best.html"', html)

    def test_notion_template_has_live_links_and_renders_the_category(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for path in (root / "index.html", root / "kor/report/index.html"):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('<a href="/missing.html">Real broken link</a>', encoding="utf-8")
            template = root / "scripts/templates/notion_article.html"
            template.parent.mkdir(parents=True)
            template.write_bytes(TEMPLATE.read_bytes())
            self.assertEqual(find_broken_internal_links(root), [
                {"source": "/", "target": "/missing.html"},
                {"source": "/kor/report/", "target": "/missing.html"},
            ])

        article = render_article(
            title="캠핑 준비", description="캠핑 준비 안내",
            url="https://emfls.github.io/kor/report/camp/test-article.html",
            category="camp",
            body="<h2>준비 사항</h2><p>방문 전 확인하세요.</p>",
            published_date="2026-11-06",
        )
        self.assertEqual(article.count('href="/kor/report/camp/"'), 3)
        self.assertNotIn("data-category-link", article)

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
