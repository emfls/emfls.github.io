import hashlib
import json
import subprocess
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

from scripts.resolve_eligible_ga4_snapshot import resolve_eligible_ga4_snapshot


GA4_PATH = "data/performance/ga4-latest.json"


def _git(root, *args):
    return subprocess.run(["git", "-C", str(root), *args], check=True, text=True, capture_output=True).stdout.strip()


def _ga4(as_of, period_end):
    period = {"start": "2026-09-09", "end": period_end}
    return {
        "as_of": as_of,
        "collection": {"source": "GOOGLE_ANALYTICS_DATA_API", "collectedAt": "2026-10-08T00:00:00Z"},
        "site": {"ga4": {"source": "GOOGLE_ANALYTICS_DATA_API", "status": "VERIFIED", "revenueMetric": "totalAdRevenue", "period": period}},
        "periods": {"ga4": period},
        "pages": [{"url": "https://example.test/", "ga4": {"source": "GOOGLE_ANALYTICS_DATA_API", "status": "VERIFIED", "period": period}}],
    }


def _gsc(period_end="2026-10-04"):
    period_start = (date.fromisoformat(period_end) - timedelta(days=27)).isoformat()
    return {
        "status": "VERIFIED",
        "source": "GOOGLE_SEARCH_CONSOLE_API",
        "property": "https://emfls.github.io/",
        "periodStart": period_start,
        "periodEnd": period_end,
        "periods": {"gsc": {"start": period_start, "end": period_end}},
        "generatedAt": "2026-10-08T00:00:00Z",
        "pages": [{"url": "https://example.test/", "google": {"source": "GOOGLE_SEARCH_CONSOLE_API", "property": "https://emfls.github.io/", "status": "VERIFIED", "period": {"start": period_start, "end": period_end}}}],
    }


class ResolveEligibleGa4SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.ga4_source = self.root / GA4_PATH
        self.ga4_source.parent.mkdir(parents=True)
        self.output = self.root / "runner-temp" / "ga4-eligible.json"
        self.gsc_path = self.root / "gsc.json"
        self.gsc_path.write_text(json.dumps(_gsc()), encoding="utf-8")
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        _git(self.root, "config", "user.name", "Resolver Test")
        _git(self.root, "config", "user.email", "resolver@example.invalid")

    def tearDown(self):
        self.temp.cleanup()

    def _commit_ga4(self, snapshot, message):
        content = json.dumps(snapshot, sort_keys=True).encode("utf-8")
        self.ga4_source.write_bytes(content)
        _git(self.root, "add", GA4_PATH)
        _git(self.root, "commit", "-qm", message)
        return _git(self.root, "rev-parse", "HEAD"), content

    def test_selects_newest_historical_ga4_blob_valid_for_gsc_as_of(self):
        eligible_revision, eligible_bytes = self._commit_ga4(_ga4("2026-10-07", "2026-10-06"), "eligible snapshot")
        self._commit_ga4(_ga4("2026-10-08", "2026-10-07"), "future snapshot")
        github_env = self.root / "GITHUB_ENV"

        result = resolve_eligible_ga4_snapshot(
            gsc_path=self.gsc_path,
            revision="HEAD",
            output_path=self.output,
            repository_root=self.root,
            github_env=github_env,
        )

        self.assertEqual(result["asOf"], "2026-10-07")
        self.assertEqual(result["revision"], eligible_revision)
        self.assertEqual(result["sha256"], hashlib.sha256(eligible_bytes).hexdigest())
        self.assertEqual(self.output.read_bytes(), eligible_bytes)
        self.assertIn(f"GA4_SNAPSHOT={self.output.resolve()}", github_env.read_text(encoding="utf-8"))
        self.assertIn(f"GA4_SOURCE_REVISION={eligible_revision}", github_env.read_text(encoding="utf-8"))
        self.assertIn("MEASUREMENT_AS_OF=2026-10-07", github_env.read_text(encoding="utf-8"))

    def test_fails_closed_when_no_ga4_blob_is_eligible(self):
        self._commit_ga4(_ga4("2026-10-08", "2026-10-07"), "future only")
        with self.assertRaisesRegex(ValueError, "no eligible GA4 source snapshot"):
            resolve_eligible_ga4_snapshot(
                gsc_path=self.gsc_path,
                revision="HEAD",
                output_path=self.output,
                repository_root=self.root,
            )
        self.assertFalse(self.output.exists())

    def test_rejects_inconsistent_gsc_metadata_without_weakening_its_contract(self):
        stale = _gsc()
        stale["periods"]["gsc"]["end"] = "2026-10-03"
        self.gsc_path.write_text(json.dumps(stale), encoding="utf-8")
        self._commit_ga4(_ga4("2026-10-07", "2026-10-06"), "eligible GA4")
        with self.assertRaisesRegex(ValueError, "GSC period metadata is inconsistent"):
            resolve_eligible_ga4_snapshot(
                gsc_path=self.gsc_path,
                revision="HEAD",
                output_path=self.output,
                repository_root=self.root,
            )


if __name__ == "__main__":
    unittest.main()
