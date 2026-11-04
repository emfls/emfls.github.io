"""Regression tests for Notion publication discovery links and RSS updates."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from pathlib import Path
import importlib.util
import json
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "refresh_notion_discovery.py"
spec = importlib.util.spec_from_file_location("notion_discovery", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        mod.ROOT = self.root
        mod.LEDGER = self.root / "data/scheduled-publication-ledger.jsonl"
        (self.root / "data").mkdir()
        (self.root / "kor/report/it").mkdir(parents=True)
        self.new = "kor/report/it/new-article.html"
        self.old = "kor/report/it/old-article.html"
        for rel, title in [(self.new, "새 기사 본문 안내"), (self.old, "기존 기사 본문 안내")]:
            (self.root / rel).write_text(
                '<html lang="ko"><head><title>' + title + '</title></head><body>'
                '<main><section class="info-bottom">정보 출처</section></main></body></html>',
                encoding="utf-8",
            )
        (self.root / "index.html").write_text(
            '<main>\n    <section class="section"><h2>최신 콘텐츠</h2></section>\n</main>',
            encoding="utf-8",
        )
        (self.root / "kor/report/it/index.html").write_text(
            '<main><div class="grid">예전 목록</div></main>', encoding="utf-8",
        )
        (self.root / "feed.xml").write_text(
            '<?xml version="1.0"?><rss version="2.0"><channel>'
            '<title>emfls</title><link>https://emfls.github.io/</link>'
            '<lastBuildDate>Mon, 02 Nov 2026 00:00:00 +0000</lastBuildDate>'
            '</channel></rss>', encoding="utf-8",
        )
        items = []
        for name, rel, hour in [("old", self.old, 11), ("new", self.new, 12)]:
            items.append({
                "notionPageId": name, "url": "https://emfls.github.io/" + rel,
                "title": name, "slotKst": datetime(2026, 11, 4, hour,
                                                    tzinfo=timezone(timedelta(hours=9))).isoformat()
            })
        mod.LEDGER.write_text("\n".join(json.dumps(x) for x in items) + "\n", encoding="utf-8")

    def test_static_home_category_related_archive_and_rss_are_idempotent(self):
        rows = mod.get_entries()
        self.assertEqual([r["relative"] for r in rows], [self.new, self.old])
        current = rows[0]
        for _ in range(2):
            mod.update_home(rows)
            mod.update_category(rows, "it")
            mod.update_article(rows, current)
            mod.archive(rows)
            mod.update_rss(current)
        home = (self.root / "index.html").read_text(encoding="utf-8")
        hub = (self.root / "kor/report/it/index.html").read_text(encoding="utf-8")
        article = (self.root / self.new).read_text(encoding="utf-8")
        archive = (self.root / "kor/report/recent/index.html").read_text(encoding="utf-8")
        rss = (self.root / "feed.xml").read_text(encoding="utf-8")
        self.assertEqual(home.count(mod.BEGIN), 1)
        self.assertEqual(hub.count(mod.BEGIN), 1)
        self.assertEqual(article.count(mod.BEGIN), 1)
        self.assertIn('/kor/report/it/new-article.html', home)
        self.assertIn('/kor/report/it/new-article.html', hub)
        self.assertIn('/kor/report/it/old-article.html', article)
        self.assertIn('/kor/report/it/old-article.html', archive)
        self.assertEqual(rss.count('https://emfls.github.io/' + self.new), 2)

    def test_travel_hub_custom_layout_is_supported(self):
        travel = self.root / "kor/report/travel/index.html"
        travel.parent.mkdir(parents=True)
        travel.write_text('<main><aside class="guide-note">팁</aside></main>', encoding="utf-8")
        path = self.root / "kor/report/travel/new-trip.html"
        path.write_text('<title>새 여행 안내</title><section class="info-bottom"></section>', encoding="utf-8")
        row = {"relative": "kor/report/travel/new-trip.html",
               "url": "/kor/report/travel/new-trip.html", "category": "travel",
               "title": "새 여행 안내", "published": datetime.now(timezone.utc)}
        mod.update_category([row], "travel")
        output = travel.read_text(encoding="utf-8")
        self.assertLess(output.index(mod.BEGIN), output.index('<aside class="guide-note"'))
        self.assertIn("새 여행 안내", output)


if __name__ == "__main__":
    unittest.main()
