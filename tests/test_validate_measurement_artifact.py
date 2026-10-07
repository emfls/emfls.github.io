import json
import tempfile
import unittest
from pathlib import Path

from scripts.validate_measurement_artifact import validate


CHANNEL_METRICS = {
    "ga4": ("views", "users", "engagementSeconds", "revenue", "revenueMetric"),
    "google": ("clicks", "impressions", "ctr", "position"),
    "naver": ("clicks", "impressions", "ctr", "position"),
    "adsense": ("revenue", "rpm", "revenueMetric", "coverageStatus"),
}


def _default_channels():
    channels = {}
    for name, metrics in CHANNEL_METRICS.items():
        channels[name] = {
            "status": "NOT_CONNECTED",
            "period": None,
            "source": None,
            **{metric: None for metric in metrics},
        }
    return channels


def _valid_page(url, classification=None, **overrides):
    page = {"url": url, "classification": classification, **_default_channels()}
    for name, value in overrides.items():
        if name in CHANNEL_METRICS and isinstance(value, dict):
            page[name] = page[name] | value
        else:
            page[name] = value
    return page


def _complete_page_fixture(page):
    if not isinstance(page, dict):
        return page
    complete = _valid_page(page.get("url"), classification=page.get("classification"))
    for name, value in page.items():
        if name in CHANNEL_METRICS and isinstance(value, dict):
            complete[name] = complete[name] | value
        elif name not in {"url", "classification"}:
            complete[name] = value
    return complete


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
            "pages": [_complete_page_fixture(page) for page in artifact_pages],
        },
    )
    page_scores = _write_page_scores(directory, inventory_urls, inventory_as_of)
    return artifact, page_scores


class ValidateMeasurementArtifactTest(unittest.TestCase):
    def test_accepts_current_generated_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "page-performance.json"
            path.write_text(json.dumps({"schemaVersion": 1, "asOf": "2026-09-17", "summary": {"evaluatedIndexablePages": 1}, "pages": [_valid_page("/")]}))
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
                "pages": [_valid_page(
                    "/example.html",
                    ga4={
                        "status": "VERIFIED",
                        "period": {"start": "2026-08-03", "end": "2026-08-30"},
                    },
                )],
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
                "pages": [_valid_page(
                    "/example.html",
                    ga4={
                        "status": "STALE_DATA",
                        "views": 143,
                        "period": {"start": "2026-08-03", "end": "2026-08-30"},
                    },
                )],
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

    def test_rejects_non_object_page_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact, page_scores = _write_coverage_fixtures(Path(directory), ["not-a-page"], ["/"])
            with self.assertRaisesRegex(ValueError, "page rows must be objects"):
                validate(artifact, page_scores_path=page_scores)

    def test_rejects_missing_classification_key(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact, page_scores = _write_coverage_fixtures(root, [_valid_page("/")], ["/"])
            payload = json.loads(artifact.read_text(encoding="utf-8"))
            payload["pages"][0].pop("classification")
            _write_json(artifact, payload)
            with self.assertRaisesRegex(ValueError, "classification"):
                validate(artifact, page_scores_path=page_scores)

    def test_rejects_unknown_classification_value(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact, page_scores = _write_coverage_fixtures(
                Path(directory), [_valid_page("/", classification="SURPRISE")], ["/"]
            )
            with self.assertRaisesRegex(ValueError, "classification"):
                validate(artifact, page_scores_path=page_scores)

    def test_accepts_null_and_supported_pipeline_classifications(self):
        for classification in (None, "WINNER", "OPPORTUNITY", "EXPERIMENT", "DEAD_CANDIDATE"):
            with self.subTest(classification=classification), tempfile.TemporaryDirectory() as directory:
                artifact, page_scores = _write_coverage_fixtures(
                    Path(directory), [_valid_page("/", classification=classification)], ["/"]
                )
                self.assertEqual(validate(artifact, page_scores_path=page_scores)["pages"], 1)

    def test_rejects_missing_channel_objects(self):
        for channel_name in CHANNEL_METRICS:
            with self.subTest(channel=channel_name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                artifact, page_scores = _write_coverage_fixtures(root, [_valid_page("/")], ["/"])
                payload = json.loads(artifact.read_text(encoding="utf-8"))
                payload["pages"][0].pop(channel_name)
                _write_json(artifact, payload)
                with self.assertRaisesRegex(ValueError, channel_name):
                    validate(artifact, page_scores_path=page_scores)

    def test_rejects_channel_that_is_not_an_object(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact, page_scores = _write_coverage_fixtures(root, [_valid_page("/")], ["/"])
            payload = json.loads(artifact.read_text(encoding="utf-8"))
            payload["pages"][0]["google"] = "VERIFIED"
            _write_json(artifact, payload)
            with self.assertRaisesRegex(ValueError, "google"):
                validate(artifact, page_scores_path=page_scores)

    def test_rejects_missing_or_unsupported_channel_status(self):
        for status in ("<missing>", "UNKNOWN"):
            with self.subTest(status=status), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                artifact, page_scores = _write_coverage_fixtures(root, [_valid_page("/")], ["/"])
                payload = json.loads(artifact.read_text(encoding="utf-8"))
                if status == "<missing>":
                    payload["pages"][0]["ga4"].pop("status")
                else:
                    payload["pages"][0]["ga4"]["status"] = status
                _write_json(artifact, payload)
                with self.assertRaisesRegex(ValueError, "ga4.*status"):
                    validate(artifact, page_scores_path=page_scores)

    def test_rejects_missing_required_channel_fields(self):
        for field in ("views", "period", "source"):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                artifact, page_scores = _write_coverage_fixtures(root, [_valid_page("/")], ["/"])
                payload = json.loads(artifact.read_text(encoding="utf-8"))
                payload["pages"][0]["ga4"].pop(field)
                _write_json(artifact, payload)
                with self.assertRaisesRegex(ValueError, f"ga4.*{field}"):
                    validate(artifact, page_scores_path=page_scores)

    def test_rejects_non_object_channel_period(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact, page_scores = _write_coverage_fixtures(root, [_valid_page("/")], ["/"])
            payload = json.loads(artifact.read_text(encoding="utf-8"))
            payload["pages"][0]["ga4"]["period"] = "2026-10-01"
            _write_json(artifact, payload)
            with self.assertRaisesRegex(ValueError, "ga4.*period"):
                validate(artifact, page_scores_path=page_scores)

    def test_accepts_verified_numeric_zero_metrics_and_null_disconnected_metrics(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            page = _valid_page("/")
            page["ga4"].update({
                "status": "VERIFIED", "period": {"start": "2026-10-01", "end": "2026-10-01"},
                "source": "TEST", "views": 0, "users": 0, "engagementSeconds": 0,
                "revenue": 0, "revenueMetric": "totalAdRevenue",
            })
            page["google"].update({
                "status": "VERIFIED", "period": {"start": "2026-10-01", "end": "2026-10-01"},
                "source": "TEST", "clicks": 0, "impressions": 0, "ctr": 0, "position": 0,
            })
            artifact, page_scores = _write_coverage_fixtures(root, [page], ["/"])
            self.assertEqual(validate(artifact, page_scores_path=page_scores)["pages"], 1)


if __name__ == "__main__":
    unittest.main()
