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
            {"id": "invalid-1", "properties": {"발행순서": {"number": 1}}}, {"id": "valid-2", "properties": {"발행순서": {"number": 2}}},
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
            {"id": "bad-1", "properties": {"발행순서": {"number": 1}}}, {"id": "bad-2", "properties": {"발행순서": {"number": 2}}},
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


    def test_ready_rows_reorders_across_notion_pages(self):
        def p(order):
            return {"id": "page-" + str(order),
                    "properties": {"발행순서": {"number": order}}}
        first = {"results": [p(79), p(77)], "has_more": True, "next_cursor": "cursor"}
        second = {"results": [p(80), p(78)], "has_more": False}
        with patch.object(publisher, "api", side_effect=[first, second]) as notion_api:
            result = publisher.ready_rows()
        self.assertEqual([x["properties"]["발행순서"]["number"] for x in result],
                         [77, 78, 79, 80])
        self.assertEqual(notion_api.call_count, 2)
        self.assertEqual(notion_api.call_args_list[0].args[2]["sorts"],
                         [{"property": "발행순서", "direction": "ascending"}])

    def test_missing_order_is_quarantined_not_published(self):
        with patch.object(publisher, "ready_rows", return_value=[
            {"id": "missing", "properties": {}},
            {"id": "valid", "properties": {"발행순서": {"number": 77}}},
        ]), patch.object(publisher, "article", return_value=self.draft("valid")), \
             patch.object(publisher, "api") as notion_api:
            result = publisher.stage()
        self.assertEqual(result["status"], "SOURCE_STAGED")
        self.assertEqual(result["page_id"], "valid")
        self.assertEqual(result["order"], 77)
        self.assertEqual(result["failed_count"], 1)
        self.assertIn("Invalid or missing 발행순서",
                      notion_api.call_args_list[0].args[2]["properties"]["오류"]["rich_text"][0]["text"]["content"])

    def test_finalize_checks_notion_server_readback(self):
        url = publisher.SITE + "/kor/report/it/valid.html"
        saved = {"properties": {
            "상태": {"select": {"name": "발행완료"}},
            "게시 URL": {"url": url},
            "발행일시": {"date": {"start": "2026-10-27T06:33:00Z"}},
            "발행순서": {"number": 77},
        }}
        with patch.object(publisher, "api", side_effect=[{}, saved]) as notion_api:
            result = publisher.finalize("page-77", url)
        self.assertEqual(result, {"status": "NOTION_COMPLETED", "url": url, "order": 77})
        self.assertEqual(notion_api.call_args_list[0].args[0], "PATCH")
        self.assertEqual(notion_api.call_args_list[1].args[:2], ("GET", "/pages/page-77"))

    def test_finalize_rejects_incorrect_notion_state(self):
        url = publisher.SITE + "/kor/report/it/valid.html"
        saved = {"properties": {
            "상태": {"select": {"name": "발행대기"}},
            "게시 URL": {"url": None},
            "발행일시": {"date": None},
        }}
        with patch.object(publisher, "api", side_effect=[{}, saved]):
            with self.assertRaisesRegex(RuntimeError, "NOTION_STATUS_READBACK_MISMATCH"):
                publisher.finalize("page-77", url)

    def test_system_failure_is_not_mislabeled_as_draft_failure(self):
        with patch.object(publisher, "ready_rows", return_value=[
            {"id": "next-1", "properties": {"발행순서": {"number": 1}}},
        ]), patch.object(publisher, "article",
                        side_effect=URLError("Notion temporarily unavailable")), \
             patch.object(publisher, "api") as notion_api:
            with self.assertRaises(URLError):
                publisher.stage()
        notion_api.assert_not_called()
        self.assertFalse(self.ledger.exists())

    def test_filesystem_failure_is_not_mislabeled_as_draft_failure(self):
        with patch.object(publisher, "ready_rows", return_value=[
            {"id": "next-1", "properties": {"발행순서": {"number": 1}}},
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
                 {"id": "bad-1", "properties": {"발행순서": {"number": 1}}}, {"id": "valid-2", "properties": {"발행순서": {"number": 2}}},
             ]), patch.object(publisher, "article",
                              side_effect=ValueError("invalid anchor")), \
             patch.object(publisher, "api") as notion_api:
            result = publisher.stage()
        self.assertEqual(result, {"status": "QUEUE_ALL_FAILED", "failed_count": 1})
        self.assertEqual(notion_api.call_count, 1)


if __name__ == "__main__":
    import unittest
    unittest.main()
