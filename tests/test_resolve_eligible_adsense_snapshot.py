import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.resolve_eligible_adsense_snapshot import resolve_eligible_adsense_snapshot
from tests.test_validate_measurement_sources import snapshots


class ResolveEligibleAdsenseSnapshotTests(unittest.TestCase):
    def test_chooses_latest_historic_snapshot_that_meets_existing_source_windows(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Test"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.email", "test@example.invalid"], check=True)

            ga4, gsc, eligible_adsense = snapshots()
            ga4_path = root / "data/performance/ga4-latest.json"
            gsc_path = root / "data/performance/gsc-latest.json"
            source_path = root / "data/performance/adsense-latest.json"
            output_path = root / "runner-temp/adsense-eligible.json"
            for path, payload in ((ga4_path, ga4), (gsc_path, gsc), (source_path, eligible_adsense)):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(payload), encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "data"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "eligible source snapshots"], check=True)
            eligible_revision = subprocess.run(
                ["git", "-C", str(root), "rev-parse", "HEAD"],
                text=True, capture_output=True, check=True,
            ).stdout.strip()

            ineligible_adsense = json.loads(json.dumps(eligible_adsense))
            ineligible_adsense["currentPeriod"].update(start="2026-09-30", end="2026-10-06")
            ineligible_adsense["priorPeriod"].update(start="2026-09-23", end="2026-09-29")
            source_path.write_text(json.dumps(ineligible_adsense), encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "data/performance/adsense-latest.json"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "too-new AdSense source"], check=True)

            result = resolve_eligible_adsense_snapshot(
                ga4_path=ga4_path,
                gsc_path=gsc_path,
                as_of="2026-10-06",
                revision="HEAD",
                output_path=output_path,
                repository_root=root,
            )

            self.assertEqual(result["revision"], eligible_revision)
            self.assertEqual(result["status"], "PARTIAL")
            self.assertEqual(result["asOf"], "2026-10-06")
            self.assertEqual(json.loads(output_path.read_text(encoding="utf-8")), eligible_adsense)

    def test_fails_without_an_eligible_historic_snapshot(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Test"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.email", "test@example.invalid"], check=True)
            ga4, gsc, adsense = snapshots()
            ga4_path = root / "ga4.json"
            gsc_path = root / "gsc.json"
            source_path = root / "data/performance/adsense-latest.json"
            for path, payload in ((ga4_path, ga4), (gsc_path, gsc), (source_path, adsense)):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(payload), encoding="utf-8")
            adsense["currentPeriod"].update(start="2026-09-30", end="2026-10-06")
            adsense["priorPeriod"].update(start="2026-09-23", end="2026-09-29")
            source_path.write_text(json.dumps(adsense), encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "."], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "no eligible source"], check=True)

            with self.assertRaisesRegex(ValueError, "no eligible AdSense source"):
                resolve_eligible_adsense_snapshot(
                    ga4_path=ga4_path,
                    gsc_path=gsc_path,
                    as_of="2026-10-06",
                    revision="HEAD",
                    output_path=root / "out/adsense.json",
                    repository_root=root,
                )


if __name__ == "__main__":
    unittest.main()
