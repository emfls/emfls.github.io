import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from scripts.collect_ga4_snapshot import build_snapshot, normalize_path, write_atomically


def row(path, values):
    return SimpleNamespace(
        dimension_values=[SimpleNamespace(value=path)],
        metric_values=[SimpleNamespace(value=str(value)) for value in values],
    )


class CollectGa4SnapshotTest(unittest.TestCase):
    def test_normalizes_ga4_page_path_without_merging_query_variants(self):
        self.assertEqual(normalize_path("https://emfls.github.io/kor/a.html?x=1"), "/kor/a.html")
        self.assertEqual(normalize_path("/"), "/")

    def test_builds_compatible_snapshot_with_explicit_api_source(self):
        snapshot = build_snapshot(
            [row("/kor/a.html", [10, 4, 20.5, 0.12])],
            period_start="2026-09-01",
            period_end="2026-09-28",
            collected_at="2026-09-29T02:17:00+00:00",
            property_id="226808916",
        )
        self.assertEqual(snapshot["schema_version"], 2)
        self.assertEqual(snapshot["site"]["ga4"]["source"], "GOOGLE_ANALYTICS_DATA_API")
        self.assertEqual(snapshot["site"]["ga4"]["status"], "VERIFIED")
        self.assertEqual(snapshot["pages"][0]["ga4"]["views"], 10)
        self.assertEqual(snapshot["collection"]["propertyId"], "226808916")

    def test_atomic_write_does_not_leave_partial_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.json"
            write_atomically(path, {"ok": True})
            self.assertEqual(json.loads(path.read_text()), {"ok": True})


if __name__ == "__main__":
    unittest.main()
