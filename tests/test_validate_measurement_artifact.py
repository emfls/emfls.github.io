import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_measurement_artifact import validate


class ValidateMeasurementArtifactTest(unittest.TestCase):
    def test_accepts_current_generated_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "page-performance.json"
            path.write_text(json.dumps({"schemaVersion": 1, "asOf": "2026-09-17", "summary": {"evaluatedIndexablePages": 1}, "pages": [{"url": "/"}]}))
            self.assertEqual(validate(path), {"pages": 1, "asOf": "2026-09-17"})

    def test_rejects_stale_quality_audit_shape(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "page-performance.json"
            path.write_text(json.dumps({"schema_version": 1, "as_of": "2026-09-06", "pages": []}))
            with self.assertRaises(ValueError):
                validate(path)

    def test_rejects_ga4_verified_when_period_is_stale(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "page-performance.json"
            path.write_text(json.dumps({
                "schemaVersion": 1,
                "asOf": "2026-09-17",
                "summary": {"evaluatedIndexablePages": 1},
                "pages": [{
                    "url": "/example.html",
                    "ga4": {
                        "status": "VERIFIED",
                        "period": {"start": "2026-08-03", "end": "2026-08-30"},
                    },
                }],
            }))
            with self.assertRaisesRegex(ValueError, "use STALE_DATA"):
                validate(path)

    def test_accepts_explicit_ga4_stale_status_without_rewriting_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "page-performance.json"
            path.write_text(json.dumps({
                "schemaVersion": 1,
                "asOf": "2026-09-17",
                "summary": {"evaluatedIndexablePages": 1},
                "pages": [{
                    "url": "/example.html",
                    "ga4": {
                        "status": "STALE_DATA",
                        "views": 143,
                        "period": {"start": "2026-08-03", "end": "2026-08-30"},
                    },
                }],
            }))
            self.assertEqual(validate(path), {"pages": 1, "asOf": "2026-09-17"})


if __name__ == "__main__":
    unittest.main()
