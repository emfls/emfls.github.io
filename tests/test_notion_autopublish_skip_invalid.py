"""Keep the hourly Notion publisher moving past invalid drafts without unsafe skips."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import call, patch
from urllib.error import URLError
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import notion_autopublish as publisher


class SkipInvalidDraftTests(TestCase):
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
        for name, replacement in [
            ("ROOT", self.root),
            ("LEDGER", self.ledger),
        ]:
            patcher = patch.object(publisher, name, replacement)
            patcher.start()
            self.addCleanup(patcher.stop)
        env = patch.dict(publisher.os.environ, {
            "NOTION_API_TOKEN": "test-token", "NOTION_INITIAL_PAGE_ID": "",
        })
        env.start()
        self.addCleanup(env.stop)
        self.patches = [
            patch.object(publisher, "previous_release_is_live", return_value=True),
            patch.object(publisher, "ledger_rows", return_value=[]),
        ]
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)

    @staticmethod
    def draft(name):
        destination = "kor/report/it/" + name + ".html"
        return (
            {"title": "유효한 발행 후보", "destination": destination,
             "html": "<html>valid</html>", "sources": ["https://example.com/"]},
            publisher.SITE + "/" + destination,
        )

    def test_invalid_first_draft_is_recorded_then_second_is_staged(self):
        with patch.object(publisher, "ready_rows", return_value=[
            {"id": "invalid-1"}, {"id": "valid-2"},
        ]), patch.object(publisher, "article", side_effect=[
            ValueError("Unsupported block: embed"), self.draft("valid-2"),
        ]), patch.object(publisher, "api") as notion_api:
            result = publisher.stage()

        self.assertEqual(result["status"], "SOURCE_STAGED")
        self.assertEqual(result["page_id"], "valid-2")
        self.assertEqual(result["failed_count"], 1)
        self.assertTrue((self.root / result["destination"]).exists())
        self.assertEqual(len(self.ledger.read_text(encoding="utf-8").splitlines()), 1)
        patch_payload = notion_api.call_args_list[0].args[2]["properties"]
        self.assertEqual(notion_api.call_args_list[0].args[:2],
                         ("PATCH", "/pages/invalid-1"))
        self.assertEqual(patch_payload["상태"]["select"]["name"], "발행실패")
        self.assertIn("Unsupported block: embed",
                      patch_payload["오류"]["rich_text"][0]["text"]["content"])
        self.assertNotIn("invalid-1", self.ledger.read_text(encoding="utf-8"))

    def test_all_bad_drafts_are_quarantined_without_consume_slot(self):
        with patch.object(publisher, "ready_rows", return_value=[
            {"id": "bad-1"}, {"id": "bad-2"},
        ]), patch.object(publisher, "article", side_effect=[
            ValueError("thin article"), ValueError("missing citation"),
        ]), patch.object(publisher, "api") as notion_api:
            result = publisher.stage()

        self.assertEqual(result, {"status": "QUEUE_ALL_FAILED", "failed_count": 2})
        self.assertEqual(notion_api.call_count, 2)
        self.assertFalse(self.ledger.exists())
        for request in notion_api.call_args_list:
            self.assertEqual(request.args[2]["properties"]["상태"]["select"]["name"],
                             "발행실패")

    def test_system_failure_is_not_mislabeled_as_draft_failure(self):
        with patch.object(publisher, "ready_rows", return_value=[
            {"id": "next-1"},
        ]), patch.object(publisher, "article",
                        side_effect=URLError("Notion temporarily unavailable")), \
             patch.object(publisher, "api") as notion_api:
            with self.assertRaises(URLError):
                publisher.stage()
        notion_api.assert_not_called()
        self.assertFalse(self.ledger.exists())

    def test_filesystem_failure_is_not_mislabeled_as_draft_failure(self):
        with patch.object(publisher, "ready_rows", return_value=[
            {"id": "next-1"},
        ]), patch.object(publisher, "article", return_value=self.draft("next-1")), \
             patch.object(publisher, "candidate_sitemap",
                          side_effect=PermissionError("disk read failed")), \
             patch.object(publisher, "api") as notion_api:
            with self.assertRaises(PermissionError):
                publisher.stage()
        notion_api.assert_not_called()

    def test_only_manually_requeued_items_reenter_ready_query(self):
        with patch.object(publisher, "api", return_value={
            "results": [{"id": "retried"}], "has_more": False,
        }) as notion_api:
            self.assertEqual(publisher.ready_rows(), [{"id": "retried"}])
        self.assertEqual(
            notion_api.call_args.args[2]["filter"]["select"]["equals"], "발행대기"
        )

    def test_initial_page_override_never_skips_to_other_draft(self):
        with patch.dict(publisher.os.environ, {"NOTION_INITIAL_PAGE_ID": "bad-1"}), \
             patch.object(publisher, "ready_rows", return_value=[
                 {"id": "bad-1"}, {"id": "valid-2"},
             ]), patch.object(publisher, "article",
                              side_effect=ValueError("invalid anchor")), \
             patch.object(publisher, "api") as notion_api:
            result = publisher.stage()
        self.assertEqual(result, {"status": "QUEUE_ALL_FAILED", "failed_count": 1})
        self.assertEqual(notion_api.call_count, 1)


if __name__ == "__main__":
    import unittest
    unittest.main()
