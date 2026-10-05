import subprocess
import sys
import unittest
from pathlib import Path


import io
import inspect
import json
import os
import urllib.error
from urllib.parse import parse_qs, urlsplit
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timezone
from unittest import TestCase
from unittest.mock import patch

from scripts import collect_adsense_snapshot as collector


METRICS = (
    "ESTIMATED_EARNINGS",
    "PAGE_VIEWS",
    "PAGE_VIEWS_RPM",
    "IMPRESSIONS",
    "CLICKS",
    "COST_PER_CLICK",
)
SITE_DIMENSIONS = ("DATE", "OWNED_SITE_DOMAIN_NAME")
PAGE_DIMENSIONS = ("PAGE_URL",)
NOW = datetime(2026, 10, 5, 6, 0, tzinfo=timezone.utc)


def _date_parts(value):
    year, month, day = (int(part) for part in value.split("-"))
    return {"year": year, "month": month, "day": day}


def make_report(dimensions, start, end, rows, totals, *, currency="USD", total_matched_rows=None, warnings=None):
    headers = [{"name": name, "type": "DIMENSION"} for name in dimensions]
    for name in METRICS:
        metric_type = "METRIC_CURRENCY" if name in {"ESTIMATED_EARNINGS", "COST_PER_CLICK"} else "METRIC_RATIO" if name == "PAGE_VIEWS_RPM" else "METRIC_TALLY"
        header = {"name": name, "type": metric_type}
        if metric_type == "METRIC_CURRENCY":
            header["currencyCode"] = currency
        headers.append(header)

    encoded_rows = []
    for row in rows:
        values = [row.get(name, "") for name in dimensions]
        values.extend(row.get(name, "") for name in METRICS)
        encoded_rows.append({"cells": [{"value": str(value)} for value in values]})
    total_values = [""] * len(dimensions) + [str(totals.get(name, "")) for name in METRICS]
    return {
        "headers": headers,
        "rows": encoded_rows,
        "totals": {"cells": [{"value": value} for value in total_values]},
        "totalMatchedRows": str(len(rows) if total_matched_rows is None else total_matched_rows),
        "startDate": _date_parts(start),
        "endDate": _date_parts(end),
        "warnings": warnings or [],
    }


def reports(*, current_rows=None, prior_rows=None, page_rows=None, current_totals=None, prior_totals=None, current_currency="USD", prior_currency="USD", page_total=None, current_site="emfls.github.io"):
    current_rows = current_rows if current_rows is not None else [{"DATE": "2026-10-04", "OWNED_SITE_DOMAIN_NAME": current_site, **(current_totals or {})}]
    prior_rows = prior_rows if prior_rows is not None else [{"DATE": "2026-09-27", "OWNED_SITE_DOMAIN_NAME": "emfls.github.io", **(prior_totals or {})}]
    page_rows = page_rows if page_rows is not None else [{"PAGE_URL": "https://emfls.github.io/known.html", "ESTIMATED_EARNINGS": "0.4", "PAGE_VIEWS": "20", "PAGE_VIEWS_RPM": "20", "IMPRESSIONS": "50", "CLICKS": "1", "COST_PER_CLICK": "0.4"}]
    current_totals = current_totals or {"ESTIMATED_EARNINGS": "18.50", "PAGE_VIEWS": "1000", "PAGE_VIEWS_RPM": "18.50", "IMPRESSIONS": "2000", "CLICKS": "10", "COST_PER_CLICK": "1.85"}
    prior_totals = prior_totals or {"ESTIMATED_EARNINGS": "10.00", "PAGE_VIEWS": "500", "PAGE_VIEWS_RPM": "20.00", "IMPRESSIONS": "1000", "CLICKS": "5", "COST_PER_CLICK": "2.00"}
    current = make_report(SITE_DIMENSIONS, "2026-09-28", "2026-10-04", current_rows, current_totals, currency=current_currency)
    prior = make_report(SITE_DIMENSIONS, "2026-09-21", "2026-09-27", prior_rows, prior_totals, currency=prior_currency)
    page = make_report(PAGE_DIMENSIONS, "2026-09-28", "2026-10-04", page_rows, {}, total_matched_rows=page_total)
    return current, prior, page


ROOT = Path(__file__).resolve().parents[1]
COLLECTOR = ROOT / "scripts" / "collect_adsense_snapshot.py"


class AdSenseCollectorCommandTest(unittest.TestCase):
    def test_help_is_available_without_live_credentials(self):
        result = subprocess.run(
            [sys.executable, str(COLLECTOR), "--help"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--output", result.stdout)

    def test_workflow_uses_readonly_oauth_and_serializes_measurement_refreshes(self):
        workflow = (ROOT / ".github/workflows/adsense-collection.yml").read_text(encoding="utf-8")
        for required in (
            "workflow_dispatch:",
            'cron: "47 1 * * *"',
            "ADSENSE_ACCOUNT_NAME: ${{ vars.ADSENSE_ACCOUNT_NAME }}",
            "ADSENSE_OAUTH_CLIENT_ID: ${{ secrets.ADSENSE_OAUTH_CLIENT_ID }}",
            "ADSENSE_OAUTH_CLIENT_SECRET: ${{ secrets.ADSENSE_OAUTH_CLIENT_SECRET }}",
            "ADSENSE_OAUTH_REFRESH_TOKEN: ${{ secrets.ADSENSE_OAUTH_REFRESH_TOKEN }}",
            "https://www.googleapis.com/auth/adsense.readonly",
            "group: site-measurement-collection",
            "queue: max",
            "--validate-only data/performance/adsense-latest.json",
        ):
            self.assertIn(required, workflow)
        self.assertNotIn("GOOGLE_APPLICATION_CREDENTIALS", workflow)

    def test_measurement_workflows_share_the_non_dropping_max_queue(self):
        for name in ("adsense-collection.yml", "ga4-collection.yml", "gsc-collection.yml"):
            workflow = (ROOT / ".github/workflows" / name).read_text(encoding="utf-8")
            self.assertIn(
                "group: site-measurement-collection\n  cancel-in-progress: false\n  queue: max",
                workflow,
                name,
            )

    def test_adsense_workflow_stages_only_the_compact_latest_snapshot(self):
        workflow = (ROOT / ".github/workflows/adsense-collection.yml").read_text(encoding="utf-8")
        staged_line = next(line.strip() for line in workflow.splitlines() if line.strip().startswith("git add "))
        self.assertEqual(staged_line, "git add data/performance/adsense-latest.json")
        for derived_artifact in (
            "data/page-performance.json",
            "data/revenue-opportunities.json",
            "reports/revenue-growth-report.md",
        ):
            self.assertNotIn(derived_artifact, workflow)
        for derived_publisher in ("scripts/seo_audit.py", "scripts/quality_audit.py", "scripts/revenue_growth.py"):
            self.assertNotIn(derived_publisher, workflow)

    def test_adsense_snapshot_runs_before_existing_ga4_gsc_consumers(self):
        workflow_crons = {}
        for name in ("adsense-collection.yml", "ga4-collection.yml", "gsc-collection.yml"):
            workflow = (ROOT / ".github/workflows" / name).read_text(encoding="utf-8")
            workflow_crons[name] = next(line.split('"')[1] for line in workflow.splitlines() if "cron:" in line)

        self.assertEqual(workflow_crons, {
            "adsense-collection.yml": "47 1 * * *",
            "ga4-collection.yml": "17 2 * * *",
            "gsc-collection.yml": "47 2 * * *",
        })
        revenue_growth = (ROOT / "scripts/revenue_growth.py").read_text(encoding="utf-8")
        self.assertIn('default=Path("data/performance/adsense-latest.json")', revenue_growth)


class AdSenseSnapshotContractTest(TestCase):
    def require_function(self, name):
        function = getattr(collector, name, None)
        self.assertTrue(callable(function), f"collector.{name} is missing")
        return function

    def build(self, *, current=None, prior=None, page=None):
        current, prior, page = (current, prior, page) if current is not None else reports()
        return self.require_function("build_snapshot")(
            account_name="accounts/pub-test",
            account={"name": "accounts/pub-test", "timeZone": {"id": "Asia/Seoul"}},
            current_report=current,
            prior_report=prior,
            page_url_report=page,
            now=NOW,
            generated_at="2026-10-05T06:00:00+00:00",
            days=7,
        )

    def test_current_and_prior_periods_are_equal_length_and_exclude_current_day(self):
        current, prior = self.require_function("build_periods")(NOW, "Asia/Seoul", days=7)

        self.assertEqual(current, {"start": "2026-09-28", "end": "2026-10-04", "days": 7, "inclusive": True})
        self.assertEqual(prior, {"start": "2026-09-21", "end": "2026-09-27", "days": 7, "inclusive": True})

    def test_site_report_parse_and_matched_deltas_are_correct(self):
        snapshot = self.build()

        self.assertEqual(snapshot["site"]["status"], "VERIFIED")
        self.assertEqual(snapshot["site"]["current"]["estimatedEarnings"], 18.5)
        self.assertEqual(snapshot["site"]["prior"]["estimatedEarnings"], 10.0)
        self.assertAlmostEqual(snapshot["site"]["absoluteDelta"]["estimatedEarnings"], 8.5)
        self.assertAlmostEqual(snapshot["site"]["relativeDelta"]["estimatedEarnings"], 0.85)
        self.assertEqual(snapshot["site"]["current"]["pageViews"], 1000)
        self.assertEqual(snapshot["site"]["prior"]["impressions"], 1000)

    def test_page_url_report_is_partial_and_missing_cpc_stays_null(self):
        current, prior, page = reports(page_rows=[{
            "PAGE_URL": "https://emfls.github.io/known.html",
            "ESTIMATED_EARNINGS": "0.4",
            "PAGE_VIEWS": "20",
            "PAGE_VIEWS_RPM": "20",
            "IMPRESSIONS": "50",
            "CLICKS": "1",
            "COST_PER_CLICK": "",
        }])
        snapshot = self.build(current=current, prior=prior, page=page)

        self.assertEqual(snapshot["pageUrls"]["coverageStatus"], "PARTIAL")
        self.assertEqual(snapshot["pageUrls"]["rows"][0]["estimatedEarnings"], 0.4)
        self.assertIsNone(snapshot["pageUrls"]["rows"][0]["costPerClick"])

    def test_missing_url_is_not_returned_as_zero_and_page_coverage_stays_partial(self):
        current, prior, page = reports(page_rows=[], page_total=0)
        snapshot = self.build(current=current, prior=prior, page=page)

        self.assertEqual(snapshot["pageUrls"]["rows"], [])
        self.assertEqual(snapshot["pageUrls"]["coverageStatus"], "PARTIAL")
        self.assertEqual(snapshot["pageUrls"]["returnedRowCount"], 0)

    def test_total_matched_rows_greater_than_returned_rows_marks_truncation(self):
        current, prior, page = reports(page_total=12000)
        snapshot = self.build(current=current, prior=prior, page=page)

        self.assertEqual(snapshot["pageUrls"]["returnedRowCount"], 1)
        self.assertEqual(snapshot["pageUrls"]["totalMatchedRows"], 12000)
        self.assertEqual(snapshot["pageUrls"]["truncationStatus"], "TRUNCATED")

    def test_currency_mismatch_invalidates_comparison(self):
        current, prior, page = reports(prior_currency="EUR")
        snapshot = self.build(current=current, prior=prior, page=page)

        self.assertNotEqual(snapshot["site"]["status"], "VERIFIED")

    def test_timezone_mismatch_invalidates_comparison(self):
        contract = self.require_function("comparison_status")
        current = {"site": "emfls.github.io", "timeZone": "Asia/Seoul", "currency": "USD", "dimensions": list(SITE_DIMENSIONS), "metrics": list(METRICS), "days": 7}
        prior = {**current, "timeZone": "America/Los_Angeles"}

        self.assertNotEqual(contract(current, prior), "VERIFIED")

    def test_site_mismatch_invalidates_comparison(self):
        current, prior, page = reports(current_site="other.example")
        snapshot = self.build(current=current, prior=prior, page=page)

        self.assertNotEqual(snapshot["site"]["status"], "VERIFIED")
        self.assertNotEqual(snapshot["site"]["comparisonStatus"], "VERIFIED")

    def test_empty_site_api_response_does_not_create_verified_zero_snapshot(self):
        current, prior, page = reports(current_rows=[], current_totals={metric: "0" for metric in METRICS})

        error_type = getattr(collector, "CollectorError", Exception)
        with self.assertRaises(error_type) as captured:
            self.build(current=current, prior=prior, page=page)
        self.assertRegex(str(captured.exception), "empty|no rows|unavailable")

    def test_api_auth_failure_preserves_last_good_snapshot_and_redacts_response_body(self):
        output = ROOT / "tmp-adsense-last-good.json"
        output.write_text('{"marker":"last-good"}\n', encoding="utf-8")
        body_secret = "ACCESS_TOKEN_BODY_SENTINEL"
        access_token = "ACCESS_TOKEN_SENTINEL"
        oauth_secret = "OAUTH_REFRESH_SENTINEL"
        environment = {
            "ADSENSE_ACCOUNT_NAME": "accounts/pub-test",
            "ADSENSE_OAUTH_CLIENT_ID": "CLIENT_ID_SENTINEL",
            "ADSENSE_OAUTH_CLIENT_SECRET": "CLIENT_SECRET_SENTINEL",
            "ADSENSE_OAUTH_REFRESH_TOKEN": oauth_secret,
        }
        error = urllib.error.HTTPError(
            "https://adsense.googleapis.com/v2/accounts/pub-test",
            401,
            "Unauthorized",
            hdrs=None,
            fp=io.BytesIO(f"{body_secret} {access_token}".encode()),
        )
        stderr = io.StringIO()

        class Response:
            def read(self):
                return json.dumps({"access_token": access_token, "expires_in": 3600}).encode()

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

        call_count = 0

        def fake_open(_request, timeout):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return Response()
            raise error

        try:
            with patch.dict(os.environ, environment, clear=False), patch.object(collector, "urlopen", side_effect=fake_open, create=True), redirect_stderr(stderr):
                main = collector.main
                if "argv" not in inspect.signature(main).parameters:
                    self.fail("collector.main must accept an argv list for a credential-safe CLI test")
                result = main(["--output", str(output)])

            self.assertEqual(result, 1)
            self.assertEqual(output.read_text(encoding="utf-8"), '{"marker":"last-good"}\n')
            self.assertNotIn(body_secret, stderr.getvalue())
            self.assertNotIn(access_token, stderr.getvalue())
            self.assertNotIn(oauth_secret, stderr.getvalue())
        finally:
            output.unlink(missing_ok=True)

    def test_api_queries_keep_site_and_page_url_reports_separate_and_never_store_tokens(self):
        current, prior, page = reports()
        response_bodies = [
            {"access_token": "ACCESS_TOKEN_SENTINEL", "expires_in": 3600, "token_type": "Bearer"},
            {"name": "accounts/pub-test", "timeZone": {"id": "Asia/Seoul"}},
            current,
            prior,
            page,
        ]
        requests = []

        class Response:
            def __init__(self, payload):
                self.payload = json.dumps(payload).encode()

            def read(self):
                return self.payload

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

        def fake_open(request, timeout):
            requests.append(request)
            return Response(response_bodies.pop(0))

        output = ROOT / "tmp-adsense-snapshot.json"
        try:
            snapshot = self.require_function("collect_snapshot")(
                output,
                account_name="accounts/pub-test",
                client_id="CLIENT_ID_SENTINEL",
                client_secret="CLIENT_SECRET_SENTINEL",
                refresh_token="REFRESH_TOKEN_SENTINEL",
                now=NOW,
                open_url=fake_open,
            )

            self.assertEqual(len(requests), 5)
            report_requests = requests[2:]
            query_strings = [parse_qs(urlsplit(request.full_url).query) for request in report_requests]
            self.assertEqual(query_strings[0]["dimensions"], list(SITE_DIMENSIONS))
            self.assertEqual(query_strings[1]["dimensions"], list(SITE_DIMENSIONS))
            self.assertEqual(query_strings[2]["dimensions"], list(PAGE_DIMENSIONS))
            self.assertIn("OWNED_SITE_DOMAIN_NAME==emfls.github.io", query_strings[0]["filters"])
            self.assertNotIn("DATE", query_strings[2]["dimensions"])
            stored = output.read_text(encoding="utf-8")
            self.assertEqual(snapshot["source"], "DIRECT_ADSENSE_MANAGEMENT_API_V2")
            for secret in ("CLIENT_ID_SENTINEL", "CLIENT_SECRET_SENTINEL", "REFRESH_TOKEN_SENTINEL", "ACCESS_TOKEN_SENTINEL"):
                self.assertNotIn(secret, stored)
        finally:
            output.unlink(missing_ok=True)

    def test_missing_credentials_do_not_replace_last_good_snapshot(self):
        output = ROOT / "tmp-adsense-missing-credentials.json"
        output.write_text('{"marker":"last-good"}\n', encoding="utf-8")
        environment = {"ADSENSE_ACCOUNT_NAME": "accounts/pub-test"}

        try:
            with patch.dict(os.environ, environment, clear=True), redirect_stderr(io.StringIO()):
                main = collector.main
                if "argv" not in inspect.signature(main).parameters:
                    self.fail("collector.main must accept an argv list for a credential-safe CLI test")
                result = main(["--output", str(output)])
            self.assertEqual(result, 1)
            self.assertEqual(output.read_text(encoding="utf-8"), '{"marker":"last-good"}\n')
        finally:
            output.unlink(missing_ok=True)

    def test_collect_schema_validation_accepts_normalized_snapshot(self):
        snapshot = self.build()

        self.require_function("validate_snapshot")(snapshot)
        self.assertEqual(snapshot["collector"]["scheduleTimeZone"], "UTC")

    def test_validate_only_cli_accepts_saved_normalized_snapshot_without_credentials(self):
        snapshot = self.build()
        path = ROOT / "tmp-adsense-schema-validation.json"
        path.write_text(json.dumps(snapshot), encoding="utf-8")
        try:
            result = subprocess.run(
                [sys.executable, str(COLLECTOR), "--validate-only", str(path)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
                env={"PATH": os.environ.get("PATH", "")},
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("AdSense snapshot schema: PASS", result.stdout)
        finally:
            path.unlink(missing_ok=True)
