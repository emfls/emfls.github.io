import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "validate_gsc_query_evidence.py"
PROPERTY = "https://emfls.github.io/"
SOURCE = "GOOGLE_SEARCH_CONSOLE_API"


def page_snapshot(start="2026-09-01", end="2026-09-28", *, complete=True):
    period = {"start": start, "end": end}
    result = {
        "status": "VERIFIED", "source": SOURCE, "property": PROPERTY,
        "periodStart": start, "periodEnd": end,
        "periods": {"gsc": period}, "generatedAt": "2026-10-01T00:00:00Z",
        "timeZone": "America/Los_Angeles", "searchType": "web",
        "aggregationType": "auto", "dimensions": ["page"],
        "completenessGuaranteed": complete,
        "pages": [
            {"url": "/a.html", "google": {"status": "VERIFIED", "source": SOURCE, "property": PROPERTY, "period": period}},
            {"url": "/b.html", "google": {"status": "VERIFIED", "source": SOURCE, "property": PROPERTY, "period": period}},
        ],
    }
    return result


def query_snapshot(start="2026-09-01", end="2026-09-28", *, complete=True):
    return {
        "status": "VERIFIED", "source": SOURCE, "property": PROPERTY,
        "periodStart": start, "periodEnd": end,
        "generatedAt": "2026-10-01T00:00:00Z",
        "timeZone": "America/Los_Angeles", "searchType": "web",
        "aggregationType": "auto", "dimensions": ["page", "query"],
        "completenessGuaranteed": complete,
        "pages": [
            {"url": "https://emfls.github.io/a.html", "queries": [{"query": "redacted-fixture"}]},
            {"url": "/b.html", "queries": [{"query": "redacted-fixture-2"}]},
        ],
    }


def write_json(path, value):
    path.write_text(json.dumps(value), encoding="utf-8")


def run_validator(page_path, query_path=None, *extra):
    command = [sys.executable, str(SCRIPT), "--page-snapshot", str(page_path)]
    if query_path is not None:
        command.extend(["--query-snapshot", str(query_path)])
    command.extend(extra)
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode:
        raise AssertionError(result.stderr)
    return json.loads(result.stdout)


class GscEvidenceValidatorContractTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.page_path = self.root / "page.json"
        self.query_path = self.root / "query.json"
        write_json(self.page_path, page_snapshot())
        write_json(self.query_path, query_snapshot())
        self.page_before = self.page_path.read_bytes()
        self.query_before = self.query_path.read_bytes()

    def tearDown(self):
        self.temporary.cleanup()

    def test_different_native_periods_are_held_instead_of_joined(self):
        write_json(self.query_path, query_snapshot("2026-09-02", "2026-09-29"))
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "WINDOW_MISMATCH_HOLD")
        self.assertEqual(report["compatibility"]["period"], "MISMATCH")
        self.assertEqual(report["sources"]["pageOnly"]["metadata"]["period"], {"start": "2026-09-01", "end": "2026-09-28"})
        self.assertEqual(report["sources"]["pageQuery"]["metadata"]["period"], {"start": "2026-09-02", "end": "2026-09-29"})
        self.assertFalse(report["metricJoinPerformed"])

    def test_exact_window_and_complete_metadata_do_not_prove_query_completeness(self):
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "PERIOD_ALIGNED")
        self.assertEqual(report["compatibility"]["period"], "SAME")
        self.assertEqual(report["compatibility"]["metadata"], "COMPLETE")
        self.assertEqual(report["coverage"]["queryCoverageStatus"], "UNKNOWN")
        self.assertEqual(report["coverage"]["queryMissingness"], "UNKNOWN_NOT_ZERO")
        self.assertEqual(report["coverage"]["queryRows"], 2)
        self.assertFalse(report["metricJoinPerformed"])
        self.assertTrue(report["sources"]["pageQuery"]["fingerprint"]["sha256"])
        page_bytes = self.page_path.read_bytes()
        expected_git_blob = hashlib.sha1(b"blob " + str(len(page_bytes)).encode() + bytes([0]) + page_bytes).hexdigest()
        self.assertEqual(report["sources"]["pageOnly"]["fingerprint"]["gitBlobSha1"], expected_git_blob)

    def test_missing_query_snapshot_requires_a_new_normal_snapshot(self):
        report = run_validator(self.page_path)
        self.assertEqual(report["status"], "NEEDS_NEW_NORMAL_SCHEDULED_SNAPSHOT")
        self.assertEqual(report["coverage"]["queryMissingness"], "UNKNOWN_NOT_ZERO")
        self.assertEqual(report["coverage"]["queryCoverageStatus"], "UNKNOWN")

    def test_completeness_flag_does_not_claim_complete_query_coverage(self):
        write_json(self.query_path, query_snapshot(complete=False))
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "PERIOD_ALIGNED")
        self.assertEqual(report["coverage"]["queryCoverageStatus"], "UNKNOWN")
        self.assertEqual(report["coverage"]["queryMissingness"], "UNKNOWN_NOT_ZERO")

    def test_generation_timestamps_can_differ_for_the_same_native_window(self):
        snapshot = query_snapshot()
        snapshot["generatedAt"] = "2026-10-02T00:00:00Z"
        write_json(self.query_path, snapshot)
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "PERIOD_ALIGNED")
        self.assertEqual(report["compatibility"]["metadata"], "COMPLETE")
        self.assertEqual(report["sources"]["pageOnly"]["metadata"]["generatedAt"], "2026-10-01T00:00:00Z")
        self.assertEqual(report["sources"]["pageQuery"]["metadata"]["generatedAt"], "2026-10-02T00:00:00Z")

    def test_same_dates_with_different_aggregation_are_held(self):
        snapshot = query_snapshot()
        snapshot["aggregationType"] = "byPage"
        write_json(self.query_path, snapshot)
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "METADATA_MISMATCH_HOLD")
        self.assertEqual(report["compatibility"]["period"], "SAME")
        self.assertEqual(report["compatibility"]["metadata"], "MISMATCH")
        self.assertEqual(report["coverage"]["queryCoverageStatus"], "UNKNOWN")

    def test_missing_metadata_is_reported_as_unknown(self):
        page = page_snapshot()
        query = query_snapshot()
        for snapshot in (page, query):
            for key in ("timeZone", "searchType", "aggregationType", "dimensions"):
                snapshot.pop(key)
        write_json(self.page_path, page)
        write_json(self.query_path, query)
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["compatibility"]["period"], "SAME")
        self.assertEqual(report["compatibility"]["metadata"], "UNKNOWN")
        self.assertEqual(report["coverage"]["queryCoverageStatus"], "UNKNOWN")
        metadata = report["sources"]["pageQuery"]["metadata"]
        for key in ("timeZone", "searchType", "aggregationType", "dimensions"):
            self.assertEqual(metadata[key], "UNKNOWN")
        self.assertEqual(metadata["dimensionsStatus"], "UNKNOWN")

    def test_missing_property_metadata_does_not_allow_cross_source_coverage(self):
        page = page_snapshot()
        query = query_snapshot()
        page.pop("property")
        query.pop("property")
        query["pages"][0]["url"] = "/a.html"
        write_json(self.page_path, page)
        write_json(self.query_path, query)
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "SOURCE_METADATA_UNKNOWN_HOLD")
        self.assertEqual(report["compatibility"]["period"], "SAME")
        self.assertEqual(report["compatibility"]["property"], "UNKNOWN")
        self.assertEqual(report["coverage"]["queryCoverageStatus"], "UNKNOWN")
        self.assertEqual(report["coverage"]["pageOnlyUrlsMissingFromQuerySnapshot"], "UNKNOWN")
        self.assertEqual(report["sources"]["pageOnly"]["metadata"]["property"], "UNKNOWN")

    def test_partial_rows_and_absent_pages_are_not_zero(self):
        snapshot = query_snapshot()
        snapshot["pages"] = [snapshot["pages"][0], {"url": "/b.html", "queries": [], "status": "NO_QUERY_ROWS_RETURNED"}]
        write_json(self.query_path, snapshot)
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "PERIOD_ALIGNED")
        self.assertEqual(report["coverage"]["queryCoverageStatus"], "PARTIAL")
        self.assertEqual(report["coverage"]["queryUrlsWithoutRows"], 1)
        self.assertEqual(report["coverage"]["pageOnlyUrlsMissingFromQuerySnapshot"], 0)
        self.assertEqual(report["coverage"]["queryMissingness"], "UNKNOWN_NOT_ZERO")

    def test_period_mismatch_does_not_compare_cross_window_url_coverage(self):
        snapshot = query_snapshot("2026-09-02", "2026-09-29")
        snapshot["pages"] = [snapshot["pages"][0]]
        write_json(self.query_path, snapshot)
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "WINDOW_MISMATCH_HOLD")
        self.assertEqual(report["coverage"]["queryCoverageStatus"], "UNKNOWN")
        self.assertEqual(report["coverage"]["pageOnlyUrlsMissingFromQuerySnapshot"], "UNKNOWN")
        self.assertEqual(report["coverage"]["queryUrlsOutsidePageSnapshot"], "UNKNOWN")
        self.assertFalse(report["metricJoinPerformed"])

    def test_flat_page_query_rows_group_repeated_page_keys(self):
        snapshot = query_snapshot()
        snapshot.pop("pages")
        snapshot["rows"] = [
            {"page": "/a.html", "query": "redacted-one"},
            {"page": "https://emfls.github.io/a.html", "query": "redacted-two"},
        ]
        write_json(self.query_path, snapshot)
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "PERIOD_ALIGNED")
        self.assertEqual(report["coverage"]["queryCoverageStatus"], "PARTIAL")
        self.assertEqual(report["coverage"]["queryUrls"], 1)
        self.assertEqual(report["coverage"]["queryUrlsWithRows"], 1)
        self.assertEqual(report["coverage"]["queryRows"], 2)

    def test_duplicate_flat_page_query_pairs_are_rejected(self):
        snapshot = query_snapshot()
        snapshot.pop("pages")
        snapshot["rows"] = [
            {"page": "/a.html", "query": "duplicate-fixture"},
            {"page": "https://emfls.github.io/a.html?source=duplicate", "query": "duplicate-fixture"},
        ]
        write_json(self.query_path, snapshot)
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "SOURCE_UNREADABLE")

    def test_malformed_or_wrong_source_is_unreadable(self):
        self.query_path.write_text("{bad json", encoding="utf-8")
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "SOURCE_UNREADABLE")
        write_json(self.query_path, query_snapshot())
        bad_page = page_snapshot()
        bad_page["source"] = "OTHER"
        write_json(self.page_path, bad_page)
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "SOURCE_UNREADABLE")

    def test_duplicate_normalized_urls_are_rejected(self):
        snapshot = query_snapshot()
        snapshot["pages"].append({"url": "https://emfls.github.io/a.html?utm_source=x", "queries": []})
        write_json(self.query_path, snapshot)
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "SOURCE_UNREADABLE")

    def test_query_rows_from_wrong_property_are_rejected(self):
        snapshot = query_snapshot()
        snapshot["property"] = "https://other.example/"
        write_json(self.query_path, snapshot)
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(report["status"], "SOURCE_UNREADABLE")

    def test_inputs_remain_unchanged_and_no_revenue_or_query_text_is_emitted(self):
        report = run_validator(self.page_path, self.query_path)
        self.assertEqual(self.page_path.read_bytes(), self.page_before)
        self.assertEqual(self.query_path.read_bytes(), self.query_before)
        serialized = json.dumps(report)
        self.assertNotIn("redacted-fixture", serialized)
        self.assertNotIn("revenue", serialized.lower())
        self.assertNotIn("revenueDataIncluded", report)

    def test_output_cannot_overwrite_a_source_file(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--page-snapshot", str(self.page_path),
             "--query-snapshot", str(self.query_path), "--output", str(self.page_path)],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.page_path.read_bytes(), self.page_before)


if __name__ == "__main__":
    unittest.main()
