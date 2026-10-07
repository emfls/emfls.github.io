import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
from urllib.request import Request

import yaml

from scripts import collect_adsense_snapshot as collector
from scripts.content_launch_guard import validate_launch


ACCOUNT = "accounts/pub-1234567890123456"
NOW = datetime(2026, 10, 7, 3, 0, tzinfo=timezone.utc)


def report_for(metrics, rows=(), *, matched=None, warnings=(), currency="USD"):
    headers = [{"name": "PAGE_URL", "type": "DIMENSION"}]
    for metric in metrics:
        header = {"name": metric, "type": "METRIC_TALLY"}
        if metric == "ESTIMATED_EARNINGS":
            header.update({"type": "METRIC_CURRENCY", "currencyCode": currency})
        headers.append(header)
    encoded_rows = []
    for row in rows:
        values = [row.get("PAGE_URL")]
        values.extend(row.get(metric) for metric in metrics)
        encoded_rows.append({"cells": [{"value": str(value)} for value in values]})
    response = {"headers": headers, "rows": encoded_rows, "warnings": list(warnings)}
    if matched is not None:
        response["totalMatchedRows"] = str(matched)
    return response


class PageUrlProbeSpecTests(unittest.TestCase):
    def test_probe_matrix_uses_the_exact_metrics_filters_and_complete_kst_windows(self):
        specs = collector.build_page_url_probe_specs(NOW, "Asia/Seoul")

        self.assertEqual([spec["id"] for spec in specs], [
            "probe-a-30d-standard",
            "probe-b-30d-impressions",
            "probe-c-7d-impressions",
            "probe-d-30d-earnings",
            "probe-e-afc",
        ])
        self.assertEqual([spec["dimensions"] for spec in specs], [("PAGE_URL",)] * 5)
        self.assertEqual([spec["metrics"] for spec in specs], [
            ("ESTIMATED_EARNINGS", "PAGE_VIEWS", "IMPRESSIONS", "CLICKS"),
            ("IMPRESSIONS",),
            ("IMPRESSIONS",),
            ("ESTIMATED_EARNINGS",),
            ("IMPRESSIONS",),
        ])
        self.assertEqual([spec["filters"] for spec in specs], [(), (), (), (), ("PRODUCT_CODE==AFC",)])
        self.assertEqual([(spec["period"]["start"], spec["period"]["end"]) for spec in specs], [
            ("2026-09-07", "2026-10-06"),
            ("2026-09-07", "2026-10-06"),
            ("2026-09-30", "2026-10-06"),
            ("2026-09-07", "2026-10-06"),
            ("2026-09-07", "2026-10-06"),
        ])

    def test_probe_run_records_http_report_metadata_warnings_currency_and_five_url_samples(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "probe-summary.json"
            called = []

            def generate_report(account_name, period, dimensions, access_token, open_url, **kwargs):
                called.append({
                    "period": period,
                    "dimensions": dimensions,
                    "filters": kwargs["filters"],
                    "metrics": kwargs["metrics"],
                })
                kwargs["response_metadata"].update({
                    "httpStatus": 200,
                    "httpHeaders": {"content-type": "application/json", "x-goog-request-id": "req-1"},
                })
                rows = [
                    {
                        "PAGE_URL": f"https://emfls.github.io/page-{index}/",
                        "ESTIMATED_EARNINGS": index / 10,
                        "PAGE_VIEWS": 10 + index,
                        "IMPRESSIONS": 20 + index,
                        "CLICKS": index,
                    }
                    for index in range(1, 7)
                ]
                return report_for(
                    kwargs["metrics"], rows, matched=7,
                    warnings=["Some dimensions do not apply to all ad clients."],
                )

            with patch.object(collector, "_refresh_access_token", return_value="secret-access-token"), \
                 patch.object(collector, "_api_get", return_value={"timeZone": {"id": "Asia/Seoul"}}), \
                 patch.object(collector, "_generate_report", side_effect=generate_report):
                summary = collector.run_page_url_probe_matrix(
                    output,
                    account_name=ACCOUNT,
                    client_id="secret-client-id",
                    client_secret="secret-client-secret",
                    refresh_token="secret-refresh-token",
                    now=NOW,
                )

            self.assertEqual(len(called), 5)
            self.assertEqual(summary["reportingTimeZone"], "Asia/Seoul")
            self.assertEqual(summary["probes"][0]["httpStatus"], 200)
            self.assertEqual(summary["probes"][0]["status"], "PARTIAL")
            self.assertEqual(summary["probes"][0]["httpHeaders"]["x-goog-request-id"], "req-1")
            self.assertEqual(summary["probes"][0]["currency"], "USD")
            self.assertEqual(summary["currency"], "USD")
            self.assertEqual(summary["probes"][0]["returnedRowCount"], 6)
            self.assertEqual(summary["probes"][0]["totalMatchedRows"], 7)
            self.assertEqual(summary["probes"][0]["truncationStatus"], "TRUNCATED")
            self.assertEqual(len(summary["probes"][0]["samplePageUrls"]), 5)
            self.assertEqual(summary["topPageRevenueRows"][0]["pageUrl"], "https://emfls.github.io/page-6/")
            self.assertEqual(summary["topPageRevenueRows"][0]["pageViewsRPMSource"], "DERIVED_FROM_DIRECT_ADSENSE_EARNINGS_AND_PAGE_VIEWS")
            self.assertIn("Some dimensions", summary["probes"][0]["warnings"][0])
            self.assertTrue((Path(directory) / "probe-a-30d-standard.json").exists())
            self.assertTrue((Path(directory) / "probe-e-afc.json").exists())
            serialized = "\n".join(path.read_text(encoding="utf-8") for path in Path(directory).glob("*.json"))
            self.assertNotIn("secret-access-token", serialized)
            self.assertNotIn("secret-client-secret", serialized)
            self.assertNotIn("secret-refresh-token", serialized)

    def test_missing_rows_or_matched_count_remain_unknown_instead_of_zero_revenue(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "probe-summary.json"

            def generate_report(account_name, period, dimensions, access_token, open_url, **kwargs):
                kwargs["response_metadata"].update({"httpStatus": 200, "httpHeaders": {}})
                return {"headers": [], "warnings": []}

            with patch.object(collector, "_refresh_access_token", return_value="token"), \
                 patch.object(collector, "_api_get", return_value={"timeZone": {"id": "Asia/Seoul"}}), \
                 patch.object(collector, "_generate_report", side_effect=generate_report):
                summary = collector.run_page_url_probe_matrix(
                    output, account_name=ACCOUNT, client_id="id", client_secret="secret",
                    refresh_token="refresh", now=NOW,
                )

            self.assertIsNone(summary["probes"][0]["returnedRowCount"])
            self.assertIsNone(summary["probes"][0]["totalMatchedRows"])
            self.assertEqual(summary["probes"][0]["truncationStatus"], "NOT_AVAILABLE")
            self.assertEqual(summary["probes"][0]["samplePageUrls"], [])
            self.assertEqual(summary["topPageRevenueRows"], [])
            self.assertEqual(summary["classification"], "UNKNOWN")

    def test_explicit_zero_rows_do_not_create_zero_revenue_and_can_classify_account_limitation(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "probe-summary.json"

            def generate_report(account_name, period, dimensions, access_token, open_url, **kwargs):
                kwargs["response_metadata"].update({"httpStatus": 200, "httpHeaders": {}})
                return report_for(kwargs["metrics"], matched=0)

            with patch.object(collector, "_refresh_access_token", return_value="token"), \
                 patch.object(collector, "_api_get", return_value={"timeZone": {"id": "Asia/Seoul"}}), \
                 patch.object(collector, "_generate_report", side_effect=generate_report):
                summary = collector.run_page_url_probe_matrix(
                    output, account_name=ACCOUNT, client_id="id", client_secret="secret",
                    refresh_token="refresh", now=NOW,
                )

            self.assertEqual(summary["classification"], "PAGE_URL_ACCOUNT_LIMITATION")
            for result in summary["probes"]:
                self.assertEqual(result["returnedRowCount"], 0)
                self.assertEqual(result["totalMatchedRows"], 0)
                self.assertEqual(result["samplePageUrls"], [])

    def test_probe_http_errors_are_fail_soft_and_do_not_stop_other_cases(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "probe-summary.json"
            calls = []

            def generate_report(account_name, period, dimensions, access_token, open_url, **kwargs):
                index = len(calls)
                calls.append(kwargs["metrics"])
                if index == 0:
                    kwargs["response_metadata"].update({"httpStatus": 400, "httpHeaders": {"content-type": "application/json"}})
                    raise collector.GoogleAPIError(
                        stage="PAGE_URL_PROBE", http_status=400,
                        google_status="INVALID_ARGUMENT", safe_message="Metric combination is invalid.",
                    )
                kwargs["response_metadata"].update({"httpStatus": 200, "httpHeaders": {}})
                return report_for(kwargs["metrics"], matched=0)

            with patch.object(collector, "_refresh_access_token", return_value="token"), \
                 patch.object(collector, "_api_get", return_value={"timeZone": {"id": "Asia/Seoul"}}), \
                 patch.object(collector, "_generate_report", side_effect=generate_report):
                summary = collector.run_page_url_probe_matrix(
                    output, account_name=ACCOUNT, client_id="id", client_secret="secret",
                    refresh_token="refresh", now=NOW,
                )

            self.assertEqual(len(calls), 5)
            self.assertEqual(summary["probes"][0]["status"], "API_ERROR")
            self.assertEqual(summary["probes"][0]["httpStatus"], 400)
            self.assertEqual(summary["probes"][1]["status"], "SUCCESS")
            self.assertEqual(summary["classification"], "UNKNOWN")

    def test_classification_distinguishes_metric_window_and_content_applicability(self):
        base = {
            "httpStatus": 200,
            "status": "SUCCESS",
            "rowsPresent": True,
            "returnedRowCount": 0,
            "totalMatchedRows": 0,
        }
        empty = {key: dict(base, id=key) for key in ("probe-a-30d-standard", "probe-b-30d-impressions", "probe-c-7d-impressions", "probe-d-30d-earnings", "probe-e-afc")}
        metric_limited = {key: dict(value) for key, value in empty.items()}
        metric_limited["probe-a-30d-standard"].update(returnedRowCount=0)
        metric_limited["probe-b-30d-impressions"].update(returnedRowCount=1)
        metric_limited["probe-c-7d-impressions"].update(returnedRowCount=1)
        self.assertEqual(collector.classify_page_url_probe_results(metric_limited), "METRIC_COMPATIBILITY_CONFIRMED")

        invalid_metric_set = {key: dict(value) for key, value in empty.items()}
        invalid_metric_set["probe-a-30d-standard"].update(status="API_ERROR", googleStatus="INVALID_ARGUMENT")
        invalid_metric_set["probe-b-30d-impressions"].update(returnedRowCount=1)
        invalid_metric_set["probe-c-7d-impressions"].update(returnedRowCount=1)
        self.assertEqual(collector.classify_page_url_probe_results(invalid_metric_set), "METRIC_COMPATIBILITY_CONFIRMED")

        window_limited = {key: dict(value) for key, value in empty.items()}
        window_limited["probe-a-30d-standard"].update(returnedRowCount=1)
        window_limited["probe-b-30d-impressions"].update(returnedRowCount=1)
        self.assertEqual(collector.classify_page_url_probe_results(window_limited), "WINDOW_THRESHOLD_CONFIRMED")

        content_limited = {key: dict(value) for key, value in empty.items()}
        content_limited["probe-e-afc"].update(returnedRowCount=1)
        self.assertEqual(collector.classify_page_url_probe_results(content_limited), "CONTENT_PRODUCT_APPLICABILITY")

        unknown = {key: dict(value, httpStatus=400, status="API_ERROR") for key, value in empty.items()}
        self.assertEqual(collector.classify_page_url_probe_results(unknown), "UNKNOWN")

        warned_empty = {key: dict(value, status="PARTIAL", warnings=["dimension applicability warning"])
                        for key, value in empty.items()}
        self.assertEqual(collector.classify_page_url_probe_results(warned_empty), "UNKNOWN")

        rows_without_urls = {
            key: dict(value, status="PARTIAL", returnedRowCount=1, usablePageUrlRowCount=0,
                      totalMatchedRows=1, warnings=["PAGE_URL was empty"])
            for key, value in empty.items()
        }
        self.assertEqual(collector.classify_page_url_probe_results(rows_without_urls), "UNKNOWN")

    def test_report_request_captures_only_safe_http_response_headers(self):
        class FakeResponse:
            status = 200
            headers = {
                "Content-Type": "application/json",
                "Date": "Wed, 07 Oct 2026 03:00:00 GMT",
                "Set-Cookie": "session=must-not-be-captured",
                "X-Goog-Request-Id": "request-123",
            }

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return b'{"headers":[],"rows":[]}'

        metadata = {}
        response = collector._json_request(
            Request("https://adsense.googleapis.com/v2/test"),
            lambda request, timeout: FakeResponse(),
            stage="PAGE_URL_PROBE_TEST",
            sensitive_values=("secret-value",),
            response_metadata=metadata,
        )

        self.assertEqual(response, {"headers": [], "rows": []})
        self.assertEqual(metadata["httpStatus"], 200)
        self.assertEqual(metadata["httpHeaders"]["content-type"], "application/json")
        self.assertEqual(metadata["httpHeaders"]["x-goog-request-id"], "request-123")
        self.assertNotIn("set-cookie", metadata["httpHeaders"])

    def test_cli_probe_mode_uses_temp_output_entrypoint_without_running_regular_collection(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "probe-summary.json"
            with patch.dict("os.environ", {
                "ADSENSE_ACCOUNT_NAME": ACCOUNT,
                "ADSENSE_OAUTH_CLIENT_ID": "id",
                "ADSENSE_OAUTH_CLIENT_SECRET": "secret",
                "ADSENSE_OAUTH_REFRESH_TOKEN": "refresh",
            }), patch.object(collector, "run_page_url_probe_matrix", return_value={
                "runStatus": "COMPLETE", "classification": "UNKNOWN", "probes": [{}, {}, {}, {}, {}],
            }) as probe, patch.object(collector, "collect_snapshot") as regular_collection:
                code = collector.main(["--page-url-probe-output", str(output)])

            self.assertEqual(code, 0)
            probe.assert_called_once()
            regular_collection.assert_not_called()

    def test_probe_uses_existing_dispatchable_workflow_and_preserves_collection_job(self):
        workflow_path = Path(__file__).resolve().parents[1] / ".github/workflows/adsense-collection.yml"
        workflow = yaml.load(workflow_path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
        jobs = workflow["jobs"]
        dispatch = workflow["on"]["workflow_dispatch"]

        self.assertEqual(dispatch["inputs"]["operation"]["default"], "collect")
        self.assertEqual(dispatch["inputs"]["operation"]["options"], ["collect", "page_url_probe"])
        self.assertEqual(jobs["collect"]["permissions"], {"contents": "write"})
        self.assertIn("Collect direct AdSense latest snapshot", [step.get("name") for step in jobs["collect"]["steps"]])
        self.assertIn("Commit refreshed AdSense snapshot", [step.get("name") for step in jobs["collect"]["steps"]])
        self.assertIn("schedule", jobs["collect"]["if"])

        probe = jobs["probe"]
        self.assertEqual(probe["permissions"], {"contents": "read"})
        self.assertIn("workflow_dispatch", probe["if"])
        self.assertIn("page_url_probe", probe["if"])
        self.assertEqual(len([
            step for step in probe["steps"]
            if step.get("uses") == "actions/upload-artifact@v4"
        ]), 1)
        probe_steps = "\n".join(str(step) for step in probe["steps"])
        self.assertNotIn("git add", probe_steps)
        self.assertNotIn("git commit", probe_steps)
        self.assertNotIn("git push", probe_steps)
        self.assertNotIn("adsense-latest.json", probe_steps)

        workflow_text = workflow_path.read_text(encoding="utf-8")
        self.assertIn(
            '--page-url-probe-output "$RUNNER_TEMP/adsense-page-url-probe/probe-summary.json"',
            " ".join(workflow_text.split()),
        )
        self.assertIn("adsense-page-url-probe-${{ github.run_id }}", workflow_text)
        self.assertIn("retention-days: 7", workflow_text)
        self.assertIn("if: always()", workflow_text)


def test_guard_allows_only_the_exact_initial_diagnostics_snapshot_blob():
    path = "data/performance/adsense-diagnostics-latest.json"
    expected_blob = "6649da69660e608f2b47a48cc46b72e8023ba2af"
    assert validate_launch(Path(__file__).resolve().parents[1], {"urls": [], "contentPaths": []}, [
        ("A", path, None, expected_blob),
    ]) == []
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        Path(__file__).resolve().parents[1], {"urls": [], "contentPaths": []}, [
            ("A", path, None, "0" * 40),
        ]
    )
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        Path(__file__).resolve().parents[1], {"urls": [], "contentPaths": []}, [
            ("M", path, expected_blob, expected_blob),
        ]
    )


def test_guard_still_rejects_adsense_latest_change_and_unrelated_analytics():
    root = Path(__file__).resolve().parents[1]
    manifest = {"urls": [], "contentPaths": []}
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        root, manifest, [("M", "data/performance/adsense-latest.json", "a" * 40, "b" * 40)]
    )
    assert "MONETIZATION_OR_ANALYTICS_CHANGED" in validate_launch(
        root, manifest, [("M", "data/analytics/custom-revenue.json", "a" * 40, "b" * 40)]
    )


if __name__ == "__main__":
    unittest.main()
