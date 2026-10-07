import copy
import hashlib
import json
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
        self._write(self.full_path, self.full)
        self._write(self.ga4_path, self.ga4)
        self._write(self.gsc_path, self.gsc)
        self._write(self.adsense_path, self.adsense)

    def tearDown(self):
        self.temp.cleanup()

    @staticmethod
    def _write(path, payload):
        path.write_text(json.dumps(payload, sort_keys=True), encoding="utf-8")

    def _build(self):
        return build_manifest(
            self.full_path,
            self.ga4_path,
            self.gsc_path,
            self.adsense_path,
            analysis_commit="a" * 40,
            workflow_run_id="12345",
            workflow_run_attempt="2",
        )

    def test_manifest_is_stable_and_records_required_metadata(self):
        manifest = self._build()
        first = serialize_manifest(manifest)
        second = serialize_manifest(self._build())
        self.assertEqual(first, second)
        self.assertTrue(first.endswith(b"\n"))
        self.assertEqual(manifest["schemaVersion"], 1)
        self.assertEqual(manifest["analysisCommit"], "a" * 40)
        self.assertEqual(manifest["workflowRunId"], "12345")
        self.assertEqual(manifest["workflowRunAttempt"], "2")
        self.assertEqual(manifest["asOf"], "2026-10-06")
        self.assertEqual(manifest["pageCount"], 1)
        self.assertEqual(manifest["ga4Period"], {"start": "2026-09-08", "end": "2026-10-05"})
        self.assertEqual(manifest["gscPeriod"], {"start": "2026-09-06", "end": "2026-10-03"})
        self.assertEqual(manifest["adsenseCurrentPeriod"], self.adsense["currentPeriod"])

    def test_full_output_hash_size_and_source_hashes_are_recorded(self):
        manifest = self._build()
        full_bytes = self.full_path.read_bytes()
        self.assertEqual(manifest["fullArtifact"]["sha256"], hashlib.sha256(full_bytes).hexdigest())
        self.assertEqual(manifest["fullArtifact"]["bytes"], len(full_bytes))
        expected = {
            "ga4": ("data/performance/ga4-latest.json", self.ga4_path),
            "gsc": ("data/performance/gsc-latest.json", self.gsc_path),
            "adsense": ("data/performance/adsense-latest.json", self.adsense_path),
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
                analysis_commit="a" * 40,
                workflow_run_id="12345",
                workflow_run_attempt="2",
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
                analysis_commit="a" * 40,
                workflow_run_id="12345",
                workflow_run_attempt="2",
            )


if __name__ == "__main__":
    unittest.main()
