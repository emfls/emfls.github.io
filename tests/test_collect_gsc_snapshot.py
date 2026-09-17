import base64
import json
import tempfile
import unittest
from pathlib import Path

from scripts.collect_gsc_snapshot import (
    build_snapshot,
    decode_service_account,
    normalize_url,
    paginate_query,
    write_atomically,
)


class CollectGscSnapshotTest(unittest.TestCase):
    def test_decodes_runtime_service_account_without_exposing_secret(self):
        encoded = base64.b64encode(json.dumps({"type": "service_account", "client_email": "reader@example.com"}).encode()).decode()
        self.assertEqual(decode_service_account(encoded)["client_email"], "reader@example.com")

    def test_normalizes_property_urls_without_query_or_fragment(self):
        self.assertEqual(normalize_url("https://emfls.github.io/kor/a.html?x=1#top"), "/kor/a.html")
        self.assertEqual(normalize_url("https://emfls.github.io/kor/a.html/"), "/kor/a.html/")

    def test_paginates_until_short_page(self):
        calls = []
        responses = [[{"page": "https://emfls.github.io/a", "clicks": 1}, {"page": "https://emfls.github.io/b", "clicks": 2}], []]

        def fetch(start_row, row_limit):
            calls.append(start_row)
            return responses[len(calls) - 1]

        rows = paginate_query(fetch, row_limit=2)
        self.assertEqual(len(rows), 2)
        self.assertEqual(calls, [0, 2])

    def test_build_snapshot_aggregates_duplicate_urls_and_recomputes_ctr(self):
        snapshot = build_snapshot(
            [
                {"page": "https://emfls.github.io/a?x=1", "clicks": 2, "impressions": 10, "ctr": 0.2, "position": 5},
                {"page": "https://emfls.github.io/a?x=2", "clicks": 1, "impressions": 5, "ctr": 0.2, "position": 7},
            ],
            period_start="2026-08-20", period_end="2026-09-10",
            generated_at="2026-09-17T00:00:00+00:00", property_url="https://emfls.github.io/",
        )
        self.assertEqual(len(snapshot["pages"]), 1)
        page = snapshot["pages"][0]["google"]
        self.assertEqual(page["clicks"], 3)
        self.assertEqual(page["impressions"], 15)
        self.assertEqual(page["ctr"], 0.2)
        self.assertEqual(page["position"], 5.67)
        self.assertEqual(snapshot["status"], "VERIFIED")

    def test_atomic_write_preserves_existing_file_on_empty_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "gsc-latest.json"
            path.write_text('{"old": true}\n', encoding="utf-8")
            with self.assertRaises(ValueError):
                write_atomically(path, {"pages": []})
            self.assertEqual(json.loads(path.read_text()), {"old": True})


if __name__ == "__main__":
    unittest.main()
