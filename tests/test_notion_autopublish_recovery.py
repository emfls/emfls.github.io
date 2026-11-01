"""Regression tests for 30-minute publisher recovery and fail-closed behavior."""
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import notion_autopublish as publisher


class ThirtyMinuteRecoveryTests(TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "data").mkdir(parents=True)
        (self.root / "kor/report/it").mkdir(parents=True)
        (self.root / "kor/report/it/sitemap.xml").write_text(
            '<?xml version="1.0"?><urlset></urlset>', encoding="utf-8"
        )
        self.ledger = self.root / "data/scheduled-publication-ledger.jsonl"
        for name, value in (("ROOT", self.root), ("LEDGER", self.ledger)):
            x = patch.object(publisher, name, value)
            x.start()
            self.addCleanup(x.stop)
        env = patch.dict(publisher.os.environ, {
            "NOTION_API_TOKEN": "test-token", "NOTION_INITIAL_PAGE_ID": "",
        })
        env.start()
        self.addCleanup(env.stop)

    def test_live_unfinished_notion_page_reconciles_and_next_article_uses_slot(self):
        prior_url = publisher.SITE + "/kor/report/it/already-live.html"
        prior = {"notionPageId": "old-page", "title": "이미 공개된 원고",
                 "url": prior_url,
                 "slotKst": (datetime.now(publisher.KST) - timedelta(hours=1)).isoformat()}
        self.ledger.write_text(json.dumps(prior, ensure_ascii=False) + "\n", encoding="utf-8")
        pending = [
            {"id": "old-page", "properties": {"발행순서": {"number": 211}}},
            {"id": "new-page", "properties": {"발행순서": {"number": 212}}},
        ]
        destination = "kor/report/it/new-article.html"
        new_url = publisher.SITE + "/" + destination
        draft = {"title": "다음 글", "destination": destination,
                 "html": "<html>test</html>", "sources": ["https://example.org"]}
        with patch.object(publisher, "previous_release_is_live", return_value=True), \
             patch.object(publisher, "ready_rows", return_value=pending), \
             patch.object(publisher, "live", return_value=True), \
             patch.object(publisher, "finalize") as finalize, \
             patch.object(publisher, "article", return_value=(draft, new_url)) as article:
            result = publisher.stage()
        self.assertEqual(result["status"], "SOURCE_STAGED")
        self.assertEqual(result["page_id"], "new-page")
        self.assertEqual(result["order"], 212)
        finalize.assert_called_once_with("old-page", prior_url)
        article.assert_called_once_with(pending[1])
        rows = [json.loads(x) for x in self.ledger.read_text(encoding="utf-8").splitlines()]
        self.assertEqual([x["notionPageId"] for x in rows], ["old-page", "new-page"])
        self.assertTrue((self.root / destination).exists())

    def test_previous_publication_retry_is_bounded_and_fail_closed(self):
        with patch.object(publisher, "previous_release_is_live", return_value=False) as live, \
             patch.object(publisher.time, "sleep") as sleep, \
             patch.object(publisher, "ready_rows") as ready:
            with self.assertRaisesRegex(RuntimeError, "not been confirmed live after 120s"):
                publisher.stage()
        self.assertEqual(live.call_count, 9)
        self.assertEqual(sleep.call_count, 8)
        ready.assert_not_called()
        self.assertFalse(self.ledger.exists())

    def test_transient_live_check_recovers_without_skipping_safety(self):
        with patch.object(publisher, "previous_release_is_live", side_effect=[False, False, True]) as live, \
             patch.object(publisher.time, "sleep") as sleep, \
             patch.object(publisher, "ready_rows", return_value=[]):
            result = publisher.stage()
        self.assertEqual(result["status"], "QUEUE_EMPTY")
        self.assertEqual(live.call_count, 3)
        self.assertEqual(sleep.call_count, 2)

    def test_30min_cooldown_still_prevents_duplicate_publication(self):
        previous = {"notionPageId": "recent-page", "title": "방금 발행",
                    "url": publisher.SITE + "/kor/report/it/recent.html",
                    "slotKst": (datetime.now(publisher.KST) - timedelta(minutes=10)).isoformat()}
        self.ledger.write_text(json.dumps(previous, ensure_ascii=False) + "\n", encoding="utf-8")
        with patch.object(publisher, "previous_release_is_live", return_value=True), \
             patch.object(publisher, "ready_rows", return_value=[
                 {"id": "next-page", "properties": {"발행순서": {"number": 213}}},
             ]), patch.object(publisher, "article") as article:
            result = publisher.stage()
        self.assertEqual(result["status"], "COOLDOWN")
        article.assert_not_called()


if __name__ == "__main__":
    import unittest
    unittest.main()
