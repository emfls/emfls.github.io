import copy
import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.build_page_performance_manifest import (
    build_manifest,
    serialize_manifest,
    verify_manifest,
)


class PagePerformanceManifestTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.full_path = self.root / "page-performance-full.json"
        self.ga4_path = self.root / "ga4.json"
        self.gsc_path = self.root / "gsc.json"
        self.adsense_path = self.root / "adsense.json"
        self.naver_path = self.root / "data" / "naver" / "search-advisor-2026-09-17.json"
        self.naver_path.parent.mkdir(parents=True)
        self.full = {
            "schemaVersion": 1,
            "asOf": "2026-10-06",
            "summary": {"evaluatedIndexablePages": 1},
            "pages": [{"url": "https://example.test/page/"}],
        }
        self.ga4 = {
            "as_of": "2026-10-06",
            "periods": {"ga4": {"start": "2026-09-08", "end": "2026-10-05"}},
        }
        self.gsc = {
            "periodStart": "2026-09-06",
            "periodEnd": "2026-10-03",
            "periods": {"gsc": {"start": "2026-09-06", "end": "2026-10-03"}},
        }
        self.adsense = {
            "currentPeriod": {"days": 7, "start": "2026-09-29", "end": "2026-10-05", "inclusive": True}
        }
        self.naver = {
            "dataUpdatedAt": "2026-09-17",
            "period": {"start": "2026-08-19", "end": "2026-09-17"},
            "periodPreset": "RECENT_30_DAYS",
            "source": "NAVER_SEARCH_ADVISOR_UI_TOP_30",
        }
        self._write(self.full_path, self.full)
        self._write(self.ga4_path, self.ga4)
        self._write(self.gsc_path, self.gsc)
        self._write(self.adsense_path, self.adsense)
        self._write(self.naver_path, self.naver)

    def tearDown(self):
        self.temp.cleanup()

    @staticmethod
    def _write(path, payload):
        path.write_text(json.dumps(payload, sort_keys=True), encoding="utf-8")

    def _build(self, *, adsense_source_revision=None):
        return build_manifest(
            self.full_path,
            self.ga4_path,
            self.gsc_path,
            self.adsense_path,
            self.naver_path,
            analysis_commit="a" * 40,
            workflow_run_id="12345",
            workflow_run_attempt="2",
            repository_root=self.root,
            adsense_source_revision=adsense_source_revision,
        )

    def test_manifest_is_stable_and_records_required_metadata(self):
        manifest = self._build()
        first = serialize_manifest(manifest)
        second = serialize_manifest(self._build())
        self.assertEqual(first, second)
        self.assertTrue(first.endswith(b"\n"))
        self.assertEqual(manifest["schemaVersion"], 2)
        self.assertEqual(manifest["analysisCommit"], "a" * 40)
        self.assertEqual(manifest["workflowRunId"], "12345")
        self.assertEqual(manifest["workflowRunAttempt"], "2")
        self.assertEqual(manifest["asOf"], "2026-10-06")
        self.assertEqual(manifest["pageCount"], 1)
        self.assertEqual(manifest["ga4Period"], {"start": "2026-09-08", "end": "2026-10-05"})
        self.assertEqual(manifest["gscPeriod"], {"start": "2026-09-06", "end": "2026-10-03"})
        self.assertEqual(manifest["adsenseCurrentPeriod"], self.adsense["currentPeriod"])
        self.assertIsNone(manifest["pullRequestHeadSha"])
        self.assertIsNone(manifest["sourceSnapshots"]["adsense"]["revision"])

    def test_full_output_hash_size_and_source_hashes_are_recorded(self):
        manifest = self._build()
        full_bytes = self.full_path.read_bytes()
        self.assertEqual(manifest["fullArtifact"]["sha256"], hashlib.sha256(full_bytes).hexdigest())
        self.assertEqual(manifest["fullArtifact"]["bytes"], len(full_bytes))
        expected = {
            "ga4": ("data/performance/ga4-latest.json", self.ga4_path),
            "gsc": ("data/performance/gsc-latest.json", self.gsc_path),
            "adsense": ("data/performance/adsense-latest.json", self.adsense_path),
            "naver": ("data/naver/search-advisor-2026-09-17.json", self.naver_path),
        }
        for key, (logical_path, source_path) in expected.items():
            self.assertEqual(manifest["sourceSnapshots"][key]["path"], logical_path)
            self.assertEqual(
                manifest["sourceSnapshots"][key]["sha256"],
                hashlib.sha256(source_path.read_bytes()).hexdigest(),
            )
        encoded = serialize_manifest(manifest).decode("utf-8")
        self.assertNotIn(str(self.root), encoded)

    def test_verifier_rejects_changed_full_artifact_hash(self):
        manifest = self._build()
        tampered = copy.deepcopy(manifest)
        tampered["fullArtifact"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "manifest does not match current inputs"):
            verify_manifest(
                tampered,
                self.full_path,
                self.ga4_path,
                self.gsc_path,
                self.adsense_path,
                self.naver_path,
                analysis_commit="a" * 40,
                workflow_run_id="12345",
                workflow_run_attempt="2",
                repository_root=self.root,
            )

    def test_verifier_rejects_changed_source_hash_after_build(self):
        manifest = self._build()
        self._write(self.gsc_path, {**self.gsc, "generatedAt": "changed"})
        with self.assertRaisesRegex(ValueError, "manifest does not match current inputs"):
            verify_manifest(
                manifest,
                self.full_path,
                self.ga4_path,
                self.gsc_path,
                self.adsense_path,
                self.naver_path,
                analysis_commit="a" * 40,
                workflow_run_id="12345",
                workflow_run_attempt="2",
                repository_root=self.root,
            )

    def test_naver_source_path_hash_and_snapshot_metadata_are_bound(self):
        manifest = self._build()
        naver = manifest["sourceSnapshots"]["naver"]
        self.assertEqual(naver["path"], "data/naver/search-advisor-2026-09-17.json")
        self.assertEqual(naver["sha256"], hashlib.sha256(self.naver_path.read_bytes()).hexdigest())
        self.assertEqual(naver["dataUpdatedAt"], "2026-09-17")
        self.assertEqual(naver["periodPreset"], "RECENT_30_DAYS")
        self.assertEqual(naver["period"], self.naver["period"])

    def test_adsense_source_revision_is_bound_to_exact_repository_blob(self):
        source = self.root / "data" / "performance" / "adsense-latest.json"
        source.parent.mkdir(parents=True)
        source.write_bytes(self.adsense_path.read_bytes())
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        subprocess.run(["git", "-C", str(self.root), "add", "data/performance/adsense-latest.json"], check=True)
        subprocess.run(["git", "-C", str(self.root), "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "pin AdSense source"], check=True)
        revision = subprocess.run(
            ["git", "-C", str(self.root), "rev-parse", "HEAD"],
            text=True, capture_output=True, check=True,
        ).stdout.strip()

        manifest = self._build(adsense_source_revision=revision)
        self.assertEqual(manifest["sourceSnapshots"]["adsense"]["revision"], revision)
        self.assertEqual(
            manifest["sourceSnapshots"]["adsense"]["sha256"],
            hashlib.sha256(source.read_bytes()).hexdigest(),
        )

    def test_manifest_rejects_adsense_bytes_that_do_not_match_recorded_revision(self):
        source = self.root / "data" / "performance" / "adsense-latest.json"
        source.parent.mkdir(parents=True)
        source.write_bytes(self.adsense_path.read_bytes())
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        subprocess.run(["git", "-C", str(self.root), "add", "data/performance/adsense-latest.json"], check=True)
        subprocess.run(["git", "-C", str(self.root), "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "pin AdSense source"], check=True)
        revision = subprocess.run(
            ["git", "-C", str(self.root), "rev-parse", "HEAD"],
            text=True, capture_output=True, check=True,
        ).stdout.strip()
        self._write(self.adsense_path, {**self.adsense, "generatedAt": "different bytes"})

        with self.assertRaisesRegex(ValueError, "do not match recorded AdSense revision"):
            self._build(adsense_source_revision=revision)

    def test_verifier_rejects_replaced_naver_source_file(self):
        manifest = self._build()
        self._write(self.naver_path, {**self.naver, "dataUpdatedAt": "2026-09-18"})
        with self.assertRaisesRegex(ValueError, "manifest does not match current inputs"):
            verify_manifest(
                manifest,
                self.full_path,
                self.ga4_path,
                self.gsc_path,
                self.adsense_path,
                self.naver_path,
                analysis_commit="a" * 40,
                workflow_run_id="12345",
                workflow_run_attempt="2",
                repository_root=self.root,
            )

    def test_manifest_rejects_zero_actions_run_id_and_records_pr_head_separately(self):
        with self.assertRaisesRegex(ValueError, "workflow run ID"):
            build_manifest(
                self.full_path, self.ga4_path, self.gsc_path, self.adsense_path, self.naver_path,
                analysis_commit="a" * 40, workflow_run_id="0", workflow_run_attempt="1",
                repository_root=self.root,
            )
        manifest = build_manifest(
            self.full_path, self.ga4_path, self.gsc_path, self.adsense_path, self.naver_path,
            analysis_commit="b" * 40, workflow_run_id="98765", workflow_run_attempt="1",
            repository_root=self.root, pull_request_head_sha="c" * 40,
        )
        self.assertEqual(manifest["analysisCommit"], "b" * 40)
        self.assertEqual(manifest["pullRequestHeadSha"], "c" * 40)


if __name__ == "__main__":
    unittest.main()
