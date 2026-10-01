import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_measurement_artifact import validate


def _write_json(path, payload):
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _write_page_scores(directory, urls, as_of="2026-10-01"):
    return _write_json(
        directory / "page-scores.json",
        {
            "as_of": as_of,
            "summary": {"evaluated_indexable_pages": len(urls)},
            "pages": [{"url": url} for url in urls],
        },
    )


def _write_coverage_fixtures(directory, artifact_pages, inventory_urls, *, artifact_as_of="2026-10-01", inventory_as_of="2026-10-01"):
    artifact = _write_json(
        directory / "page-performance.json",
        {
            "schemaVersion": 1,
            "asOf": artifact_as_of,
            "summary": {"evaluatedIndexablePages": len(artifact_pages)},
            "pages": artifact_pages,
        },
    )
    page_scores = _write_page_scores(directory, inventory_urls, inventory_as_of)
    return artifact, page_scores


class ValidateMeasurementArtifactTest(unittest.TestCase):
    def test_accepts_current_generated_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "page-performance.json"
            path.write_text(json.dumps({"schemaVersion": 1, "asOf": "2026-09-17", "summary": {"evaluatedIndexablePages": 1}, "pages": [{"url": "/"}]}))
            page_scores = _write_page_scores(Path(directory), ["/"], "2026-09-17")
            self.assertEqual(validate(path, page_scores_path=page_scores), {"pages": 1, "asOf": "2026-09-17"})

    def test_rejects_stale_quality_audit_shape(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "page-performance.json"
            path.write_text(json.dumps({"schema_version": 1, "as_of": "2026-09-06", "pages": []}))
            page_scores = _write_page_scores(Path(directory), ["/"])
            with self.assertRaises(ValueError):
                validate(path, page_scores_path=page_scores)

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
            page_scores = _write_page_scores(Path(directory), ["/example.html"], "2026-09-17")
            with self.assertRaisesRegex(ValueError, "use STALE_DATA"):
                validate(path, page_scores_path=page_scores)

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
            page_scores = _write_page_scores(Path(directory), ["/example.html"], "2026-09-17")
            self.assertEqual(validate(path, page_scores_path=page_scores), {"pages": 1, "asOf": "2026-09-17"})

    def test_rejects_missing_current_indexable_url(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact, page_scores = _write_coverage_fixtures(
                root,
                [{"url": "/"}],
                ["/", "/new-guide/"],
            )
            with self.assertRaisesRegex(ValueError, "missing current indexable URL"):
                validate(artifact, page_scores_path=page_scores)

    def test_rejects_unexpected_extra_url(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact, page_scores = _write_coverage_fixtures(
                root,
                [{"url": "/"}, {"url": "/stale-page/"}],
                ["/"],
            )
            with self.assertRaisesRegex(ValueError, "unexpected page-performance URL"):
                validate(artifact, page_scores_path=page_scores)

    def test_matches_route_and_index_html_aliases_after_normalization(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact, page_scores = _write_coverage_fixtures(
                root,
                [{"url": "/route/index.html"}],
                ["/route/"],
            )
            self.assertEqual(
                validate(artifact, page_scores_path=page_scores),
                {"pages": 1, "asOf": "2026-10-01"},
            )

    def test_rejects_duplicate_normalized_urls_in_page_performance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact, page_scores = _write_coverage_fixtures(
                root,
                [{"url": "/route/"}, {"url": "/route/index.html"}],
                ["/route/"],
            )
            with self.assertRaisesRegex(ValueError, "duplicate normalized URL"):
                validate(artifact, page_scores_path=page_scores)

    def test_requires_inventory_even_when_new_page_has_no_channel_data(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            no_evidence = {
                "ga4": {"status": "NOT_CONNECTED", "views": None, "users": None, "engagementSeconds": None, "revenue": None},
                "google": {"status": "NOT_CONNECTED", "clicks": None, "impressions": None, "ctr": None, "position": None},
                "adsense": {"status": "NOT_CONNECTED", "revenue": None, "rpm": None},
            }
            artifact, page_scores = _write_coverage_fixtures(
                root,
                [{"url": "/new-guide/", **no_evidence}],
                ["/new-guide/"],
            )
            self.assertEqual(
                validate(artifact, page_scores_path=page_scores),
                {"pages": 1, "asOf": "2026-10-01"},
            )

    def test_rejects_zero_metrics_on_unconnected_channels(self):
        disconnected_metrics = (
            ("ga4", "views"),
            ("google", "clicks"),
            ("adsense", "revenue"),
        )
        for channel_name, metric_name in disconnected_metrics:
            with self.subTest(channel=channel_name, metric=metric_name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                channel = {"status": "NOT_CONNECTED", metric_name: 0}
                artifact, page_scores = _write_coverage_fixtures(
                    root,
                    [{"url": "/new-guide/", channel_name: channel}],
                    ["/new-guide/"],
                )
                with self.assertRaisesRegex(ValueError, "NOT_CONNECTED.*null"):
                    validate(artifact, page_scores_path=page_scores)

    def test_rejects_page_score_inventory_from_a_different_as_of_date(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact, page_scores = _write_coverage_fixtures(
                root,
                [{"url": "/"}],
                ["/"],
                inventory_as_of="2026-09-06",
            )
            with self.assertRaisesRegex(ValueError, "page-score inventory asOf"):
                validate(artifact, page_scores_path=page_scores)


if __name__ == "__main__":
    unittest.main()
