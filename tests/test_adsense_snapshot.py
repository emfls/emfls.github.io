import subprocess
import sys
import unittest
from pathlib import Path


import io
import inspect
import json
import os
import urllib.error
import tempfile
from urllib.parse import parse_qs, urlsplit
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta, timezone
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


def make_missing_rows_report(dimensions, start, end, totals, *, currency="USD"):
    """Fixture for a valid Google report response that omits optional rows."""
    report = make_report(dimensions, start, end, [], totals, currency=currency)
    report.pop("rows")
    report.pop("totalMatchedRows")
    return report


BREAKDOWN_METRICS_FIXTURE = (
    "ESTIMATED_EARNINGS", "PAGE_VIEWS", "PAGE_VIEWS_RPM", "IMPRESSIONS", "CLICKS",
    "COST_PER_CLICK", "AD_REQUESTS", "MATCHED_AD_REQUESTS", "AD_REQUESTS_COVERAGE",
    "ACTIVE_VIEW_VIEWABILITY",
)


def make_breakdown_report(dimensions, start, end, rows, totals, *, currency="USD", total_matched_rows=None, warnings=None):
    headers = [{"name": name, "type": "DIMENSION"} for name in dimensions]
    for name in BREAKDOWN_METRICS_FIXTURE:
        metric_type = (
            "METRIC_CURRENCY" if name in {"ESTIMATED_EARNINGS", "COST_PER_CLICK"}
            else "METRIC_RATIO" if name in {"PAGE_VIEWS_RPM", "AD_REQUESTS_COVERAGE", "ACTIVE_VIEW_VIEWABILITY"}
            else "METRIC_TALLY"
        )
        header = {"name": name, "type": metric_type}
        if metric_type == "METRIC_CURRENCY":
            header["currencyCode"] = currency
        headers.append(header)

    def encode(row):
        values = [row.get(name, "") for name in dimensions]
        values.extend(row.get(name, "") for name in BREAKDOWN_METRICS_FIXTURE)
        return {"cells": [{"value": str(value)} for value in values]}

    total_values = [""] * len(dimensions) + [str(totals.get(name, "")) for name in BREAKDOWN_METRICS_FIXTURE]
    return {
        "headers": headers,
        "rows": [encode(row) for row in rows],
        "totals": {"cells": [{"value": value} for value in total_values]},
        "totalMatchedRows": str(len(rows) if total_matched_rows is None else total_matched_rows),
        "startDate": _date_parts(start),
        "endDate": _date_parts(end),
        "warnings": warnings or [],
    }


def breakdown_fixtures(snapshot, *, missing_date=None, warnings=None, total_matched_rows=None, missing_metric=False, aggregate_mismatch=False):
    first = datetime.fromisoformat(snapshot["priorPeriod"]["start"])
    last = datetime.fromisoformat(snapshot["currentPeriod"]["end"])
    dates = [(first + timedelta(days=offset)).date().isoformat() for offset in range((last - first).days + 1)]
    current_values = {
        "ESTIMATED_EARNINGS": "18.50", "PAGE_VIEWS": "1000", "PAGE_VIEWS_RPM": "18.50",
        "IMPRESSIONS": "2000", "CLICKS": "10", "COST_PER_CLICK": "1.85",
        "AD_REQUESTS": "2500", "MATCHED_AD_REQUESTS": "2200", "AD_REQUESTS_COVERAGE": "0.88",
        "ACTIVE_VIEW_VIEWABILITY": "0.62",
    }
    prior_values = {
        "ESTIMATED_EARNINGS": "10.00", "PAGE_VIEWS": "500", "PAGE_VIEWS_RPM": "20.00",
        "IMPRESSIONS": "1000", "CLICKS": "5", "COST_PER_CLICK": "2.00",
        "AD_REQUESTS": "1200", "MATCHED_AD_REQUESTS": "900", "AD_REQUESTS_COVERAGE": "0.75",
        "ACTIVE_VIEW_VIEWABILITY": "0.68",
    }
    rows = []
    for day in dates:
        values = current_values if day == snapshot["currentPeriod"]["end"] else prior_values if day == snapshot["priorPeriod"]["end"] else {
            metric: "0" for metric in BREAKDOWN_METRICS_FIXTURE
        }
        row = {"DATE": day, **values}
        if missing_metric and day == dates[0]:
            row["ACTIVE_VIEW_VIEWABILITY"] = ""
        if day != missing_date:
            rows.append(row)
    totals = {
        "ESTIMATED_EARNINGS": "28.50", "PAGE_VIEWS": "1500", "PAGE_VIEWS_RPM": "19.00",
        "IMPRESSIONS": "3000", "CLICKS": "15", "COST_PER_CLICK": "1.90",
        "AD_REQUESTS": "3700", "MATCHED_AD_REQUESTS": "3100", "AD_REQUESTS_COVERAGE": "0.83",
        "ACTIVE_VIEW_VIEWABILITY": "0.65",
    }
    if aggregate_mismatch:
        totals["ESTIMATED_EARNINGS"] = "30.00"
    daily = make_breakdown_report(
        ("DATE",), dates[0], dates[-1], rows, totals,
        warnings=warnings, total_matched_rows=total_matched_rows,
    )
    dimension_reports = {}
    for key, dimension in (("country", "COUNTRY_NAME"), ("platformType", "PLATFORM_TYPE_NAME"), ("adFormat", "AD_FORMAT_NAME")):
        label = {"country": "South Korea", "platformType": "Desktop", "adFormat": "In-page"}[key]
        dimensional_rows = [{**row, dimension: label} for row in rows]
        dimension_reports[key] = make_breakdown_report(
            ("DATE", dimension), dates[0], dates[-1], dimensional_rows, totals,
            warnings=warnings,
            total_matched_rows=total_matched_rows if total_matched_rows is not None else len(dimensional_rows),
        )
    return daily, dimension_reports


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
            "--breakdown-output data/performance/adsense-breakdown-latest.json",
            "--validate-breakdown-only data/performance/adsense-breakdown-latest.json",
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
        self.assertEqual(
            staged_line,
            "git add data/performance/adsense-latest.json data/performance/adsense-breakdown-latest.json",
        )
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

    def test_page_url_rows_are_locally_filtered_to_the_exact_site_hostname(self):
        current, prior, page = reports(page_rows=[
            {"PAGE_URL": "https://emfls.github.io/known.html", "ESTIMATED_EARNINGS": "0.4"},
            {"PAGE_URL": "https://sub.emfls.github.io/other.html", "ESTIMATED_EARNINGS": "9.0"},
            {"PAGE_URL": "https://unrelated.example/other.html", "ESTIMATED_EARNINGS": "12.0"},
        ])

        snapshot = self.build(current=current, prior=prior, page=page)

        self.assertEqual(
            [row["url"] for row in snapshot["pageUrls"]["rows"]],
            ["https://emfls.github.io/known.html"],
        )
        self.assertEqual(snapshot["pageUrls"]["returnedRowCount"], 3)
        self.assertEqual(snapshot["pageUrls"]["totalMatchedRows"], 3)
        self.assertIn("Ignored 2 PAGE_URL rows", " ".join(snapshot["collector"]["warnings"]))
        self.assertNotIn("unrelated.example", json.dumps(snapshot))

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
        zero_totals = {metric: "0" for metric in METRICS}
        current, prior, page = reports()

        for stage, report_name in (("SITE_CURRENT_REPORT_EMPTY", "current"), ("SITE_PRIOR_REPORT_EMPTY", "prior")):
            with self.subTest(stage=stage):
                payloads = {"current": current, "prior": prior, "page": page}
                payloads[report_name] = make_missing_rows_report(
                    SITE_DIMENSIONS,
                    "2026-09-28" if report_name == "current" else "2026-09-21",
                    "2026-10-04" if report_name == "current" else "2026-09-27",
                    zero_totals,
                )
                with self.assertRaises(collector.CollectorError) as captured:
                    self.build(**payloads)
                self.assertIn(stage, str(captured.exception))

    def test_live_missing_rows_contract_fixture_is_attributed_without_guessing_endpoint(self):
        zero_totals = {metric: "0" for metric in METRICS}
        current, prior, page = reports()
        missing_current = make_missing_rows_report(SITE_DIMENSIONS, "2026-09-28", "2026-10-04", zero_totals)
        missing_prior = make_missing_rows_report(SITE_DIMENSIONS, "2026-09-21", "2026-09-27", zero_totals)
        missing_page = make_missing_rows_report(PAGE_DIMENSIONS, "2026-09-28", "2026-10-04", {})

        for stage, reports_to_build in (
            ("SITE_CURRENT_REPORT_EMPTY", (missing_current, prior, page)),
            ("SITE_PRIOR_REPORT_EMPTY", (current, missing_prior, page)),
        ):
            with self.subTest(stage=stage):
                with self.assertRaises(collector.CollectorError) as captured:
                    self.build(current=reports_to_build[0], prior=reports_to_build[1], page=reports_to_build[2])
                self.assertIn(stage, str(captured.exception))

        snapshot = self.build(current=current, prior=prior, page=missing_page)
        self.assertTrue(collector.validate_snapshot(snapshot))
        self.assertEqual(snapshot["source"], "DIRECT_ADSENSE_MANAGEMENT_API_V2")
        self.assertEqual(snapshot["site"]["status"], "VERIFIED")
        self.assertEqual(snapshot["site"]["comparisonStatus"], "VERIFIED")
        self.assertEqual(snapshot["pageUrls"]["coverageStatus"], "PARTIAL")
        self.assertEqual(snapshot["pageUrls"]["rows"], [])
        self.assertEqual(snapshot["pageUrls"]["returnedRowCount"], 0)
        self.assertIsNone(snapshot["pageUrls"]["totalMatchedRows"])
        self.assertEqual(snapshot["pageUrls"]["truncationStatus"], "NOT_AVAILABLE")
        self.assertIn("missing URL is NOT_AVAILABLE, not zero", snapshot["pageUrls"]["coverageCaveat"])

    def test_non_list_rows_and_invalid_matched_count_include_parse_stage(self):
        current, prior, page = reports()
        cases = (
            ("SITE_CURRENT_REPORT_PARSE", "current", None),
            ("SITE_PRIOR_REPORT_PARSE", "prior", {}),
            ("PAGE_URL_REPORT_PARSE", "page", "not-a-list"),
        )
        for stage, report_name, rows in cases:
            with self.subTest(stage=stage):
                payloads = {"current": current, "prior": prior, "page": page}
                payloads[report_name] = dict(payloads[report_name])
                payloads[report_name]["rows"] = rows
                with self.assertRaises(collector.CollectorError) as captured:
                    self.build(**payloads)
                self.assertIn(stage, str(captured.exception))

        invalid_count = dict(page)
        invalid_count["totalMatchedRows"] = "not-a-number"
        with self.assertRaises(collector.CollectorError) as captured:
            self.build(current=current, prior=prior, page=invalid_count)
        self.assertIn("PAGE_URL_REPORT_PARSE", str(captured.exception))

    def test_structural_report_errors_include_the_exact_parse_stage(self):
        current, prior, page = reports()
        malformed = (
            ("SITE_CURRENT_REPORT_PARSE", "current", "headers", [None]),
            ("SITE_PRIOR_REPORT_PARSE", "prior", "startDate", {"year": "bad", "month": 9, "day": 21}),
            ("PAGE_URL_REPORT_PARSE", "page", "rows", [{"cells": []}]),
        )
        for stage, report_name, field, value in malformed:
            with self.subTest(stage=stage, field=field):
                payloads = {"current": current, "prior": prior, "page": page}
                payloads[report_name] = dict(payloads[report_name])
                payloads[report_name][field] = value
                with self.assertRaises(collector.CollectorError) as captured:
                    self.build(**payloads)
                self.assertIn(stage, str(captured.exception))

    def test_empty_site_report_parse_preserves_the_last_good_snapshot(self):
        current, prior, page = reports()
        current = make_missing_rows_report(
            SITE_DIMENSIONS,
            "2026-09-28",
            "2026-10-04",
            {metric: "0" for metric in METRICS},
        )
        responses = [
            {"access_token": "ACCESS_TOKEN_SENTINEL", "expires_in": 3600},
            {"name": "accounts/pub-test", "timeZone": {"id": "Asia/Seoul"}},
            current,
            prior,
            page,
        ]

        class Response:
            def __init__(self, payload):
                self.payload = json.dumps(payload).encode()

            def read(self):
                return self.payload

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "adsense-latest.json"
            output.write_text('{"marker":"last-good"}\n', encoding="utf-8")
            call_count = 0

            def fake_open(_request, timeout):
                nonlocal call_count
                response = Response(responses[call_count])
                call_count += 1
                return response

            with self.assertRaises(collector.CollectorError) as captured:
                collector.collect_snapshot(
                    output,
                    account_name="accounts/pub-test",
                    client_id="CLIENT_ID_SENTINEL",
                    client_secret="CLIENT_SECRET_SENTINEL",
                    refresh_token="REFRESH_TOKEN_SENTINEL",
                    now=NOW,
                    open_url=fake_open,
                )
            self.assertIn("SITE_CURRENT_REPORT_EMPTY", str(captured.exception))
            self.assertEqual(output.read_text(encoding="utf-8"), '{"marker":"last-good"}\n')

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

    def test_http_400_identifies_the_exact_collection_stage(self):
        current, prior, page = reports()
        responses = [
            {"access_token": "ACCESS_TOKEN_SENTINEL", "expires_in": 3600},
            {"name": "accounts/pub-test", "timeZone": {"id": "Asia/Seoul"}},
            current,
            prior,
            page,
        ]
        stages = (
            "OAUTH_REFRESH",
            "ACCOUNT_GET",
            "SITE_CURRENT_REPORT",
            "SITE_PRIOR_REPORT",
            "PAGE_URL_REPORT",
        )

        class Response:
            def __init__(self, payload):
                self.payload = json.dumps(payload).encode()

            def read(self):
                return self.payload

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

        for failing_call, stage in enumerate(stages, start=1):
            with self.subTest(stage=stage):
                call_count = 0

                def fake_open(request, timeout):
                    nonlocal call_count
                    call_count += 1
                    if call_count == failing_call:
                        raise urllib.error.HTTPError(
                            request.full_url,
                            400,
                            "Bad Request",
                            hdrs=None,
                            fp=io.BytesIO(json.dumps({"error": {
                                "code": 400,
                                "status": "INVALID_ARGUMENT",
                                "message": "Invalid report argument",
                            }}).encode()),
                        )
                    return Response(responses[call_count - 1])

                output = ROOT / f"tmp-adsense-{stage.lower()}.json"
                with self.assertRaises(collector.CollectorError) as captured:
                    collector.collect_snapshot(
                        output,
                        account_name="accounts/pub-test",
                        client_id="CLIENT_ID_SENTINEL",
                        client_secret="CLIENT_SECRET_SENTINEL",
                        refresh_token="REFRESH_TOKEN_SENTINEL",
                        now=NOW,
                        open_url=fake_open,
                    )

                self.assertIn(stage, str(captured.exception))
                self.assertIn("HTTP 400", str(captured.exception))
                self.assertIn("INVALID_ARGUMENT", str(captured.exception))
                self.assertIn("Invalid report argument", str(captured.exception))
                output.unlink(missing_ok=True)

    def test_live_page_url_dimension_failure_writes_verified_site_snapshot(self):
        current, prior, page = reports()
        responses = [
            {"access_token": "ACCESS_TOKEN_SENTINEL", "expires_in": 3600},
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
            if len(requests) == 5:
                raise urllib.error.HTTPError(
                    request.full_url,
                    400,
                    "Bad Request",
                    hdrs=None,
                    fp=io.BytesIO(json.dumps({"error": {
                        "code": 400,
                        "status": "INVALID_ARGUMENT",
                        "message": "The combination of requested dimensions is unavailable.",
                    }}).encode()),
                )
            return Response(responses[len(requests) - 1])

        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "adsense-latest.json"
            try:
                snapshot = collector.collect_snapshot(
                    output,
                    account_name="accounts/pub-test",
                    client_id="CLIENT_ID_SENTINEL",
                    client_secret="CLIENT_SECRET_SENTINEL",
                    refresh_token="REFRESH_TOKEN_SENTINEL",
                    now=NOW,
                    open_url=fake_open,
                )
            except collector.CollectorError as error:
                self.fail(f"PAGE_URL unavailability discarded valid site reports: {error}")

            saved = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(snapshot, saved)
            self.assertTrue(collector.validate_snapshot(saved))
            self.assertEqual(saved["source"], "DIRECT_ADSENSE_MANAGEMENT_API_V2")
            self.assertEqual(saved["site"]["status"], "VERIFIED")
            self.assertEqual(saved["site"]["comparisonStatus"], "VERIFIED")
            self.assertEqual(saved["site"]["current"]["estimatedEarnings"], 18.5)
            self.assertEqual(saved["site"]["prior"]["estimatedEarnings"], 10.0)
            urls = saved["pageUrls"]
            self.assertEqual(urls["source"], "DIRECT_ADSENSE_PAGE_URL")
            self.assertEqual(urls["coverageStatus"], "NOT_AVAILABLE")
            self.assertEqual(urls["rows"], [])
            self.assertEqual(urls["returnedRowCount"], 0)
            self.assertIsNone(urls["totalMatchedRows"])
            self.assertEqual(urls["truncationStatus"], "NOT_AVAILABLE")
            self.assertEqual(urls["unavailableReason"], "PAGE_URL_DIMENSION_COMBINATION_UNAVAILABLE")
            page_query = parse_qs(urlsplit(requests[4].full_url).query)
            self.assertNotIn("filters", page_query)
            for secret in ("ACCESS_TOKEN_SENTINEL", "CLIENT_ID_SENTINEL", "CLIENT_SECRET_SENTINEL", "REFRESH_TOKEN_SENTINEL"):
                self.assertNotIn(secret, output.read_text(encoding="utf-8"))

    def test_live_page_url_error_has_safe_structured_classification(self):
        def failing_open(request, timeout):
            raise urllib.error.HTTPError(
                request.full_url,
                400,
                "Bad Request",
                hdrs=None,
                fp=io.BytesIO(json.dumps({"error": {
                    "code": 400,
                    "status": "INVALID_ARGUMENT",
                    "message": "The combination of requested dimensions is unavailable.",
                }}).encode()),
            )

        with self.assertRaises(collector.CollectorError) as captured:
            collector._api_get(
                "https://adsense.googleapis.com/v2/accounts/pub-test/reports:generate",
                "ACCESS_TOKEN_SENTINEL",
                failing_open,
                stage="PAGE_URL_REPORT",
            )

        error = captured.exception
        self.assertEqual(error.stage, "PAGE_URL_REPORT")
        self.assertEqual(error.http_status, 400)
        self.assertEqual(error.google_status, "INVALID_ARGUMENT")
        self.assertEqual(error.classification, "PAGE_URL_DIMENSION_COMBINATION_UNAVAILABLE")
        self.assertEqual(error.safe_message, "The combination of requested dimensions is unavailable.")
        self.assertIsNone(error.__context__)
        self.assertNotIn("https://", str(error))
        self.assertNotIn("ACCESS_TOKEN_SENTINEL", str(error))

    def test_only_the_exact_page_url_unavailable_error_is_fail_soft(self):
        current, prior, page = reports()
        responses = [
            {"access_token": "ACCESS_TOKEN_SENTINEL", "expires_in": 3600},
            {"name": "accounts/pub-test", "timeZone": {"id": "Asia/Seoul"}},
            current,
            prior,
            page,
        ]
        cases = (
            (5, 400, "INVALID_ARGUMENT", "Invalid report argument", "PAGE_URL_REPORT"),
            (5, 500, "INTERNAL", "Temporary server error", "PAGE_URL_REPORT"),
            (5, 429, "RESOURCE_EXHAUSTED", "Rate limit exceeded", "PAGE_URL_REPORT"),
            (1, 400, "INVALID_ARGUMENT", "The combination of requested dimensions is unavailable.", "OAUTH_REFRESH"),
            (3, 400, "INVALID_ARGUMENT", "The combination of requested dimensions is unavailable.", "SITE_CURRENT_REPORT"),
            (4, 400, "INVALID_ARGUMENT", "The combination of requested dimensions is unavailable.", "SITE_PRIOR_REPORT"),
        )

        class Response:
            def __init__(self, payload):
                self.payload = json.dumps(payload).encode()

            def read(self):
                return self.payload

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

        for failing_call, http_status, status, message, stage in cases:
            with self.subTest(http_status=http_status, stage=stage, message=message):
                requests = []

                def fake_open(request, timeout):
                    requests.append(request)
                    if len(requests) == failing_call:
                        raise urllib.error.HTTPError(
                            request.full_url,
                            http_status,
                            "Google API failure",
                            hdrs=None,
                            fp=io.BytesIO(json.dumps({"error": {
                                "code": http_status,
                                "status": status,
                                "message": message,
                            }}).encode()),
                        )
                    return Response(responses[len(requests) - 1])

                with tempfile.TemporaryDirectory() as temporary:
                    output = Path(temporary) / "adsense-latest.json"
                    with self.assertRaises(collector.CollectorError) as captured:
                        collector.collect_snapshot(
                            output,
                            account_name="accounts/pub-test",
                            client_id="CLIENT_ID_SENTINEL",
                            client_secret="CLIENT_SECRET_SENTINEL",
                            refresh_token="REFRESH_TOKEN_SENTINEL",
                            now=NOW,
                            open_url=fake_open,
                        )
                    self.assertIn(stage, str(captured.exception))
                    self.assertFalse(output.exists())

    def test_http_error_details_are_sanitized_and_never_include_request_urls_or_body(self):
        sentinels = (
            "ACCESS_TOKEN_SENTINEL_12345678901234567890",
            "REFRESH_TOKEN_SENTINEL_12345678901234567890",
            "CLIENT_SECRET_SENTINEL_12345678901234567890",
            "CLIENT_ID_SENTINEL_12345678901234567890",
            "opaque_token_like_value_abcdefghijklmnopqrstuvwxyz123456",
        )
        echoed = (
            "accounts/pub-1234567890123456 Authorization: Bearer header_bearer_secret_1234567890 "
            "access_token=ACCESS_TOKEN_SENTINEL_12345678901234567890 "
            "refresh_token=REFRESH_TOKEN_SENTINEL_12345678901234567890 "
            "client_secret=CLIENT_SECRET_SENTINEL_12345678901234567890 "
            "client_id=CLIENT_ID_SENTINEL_12345678901234567890 "
            "opaque_token_like_value_abcdefghijklmnopqrstuvwxyz123456 "
            "https://adsense.googleapis.com/v2/accounts/pub-1234567890123456/reports:generate?limit=123"
        )

        def failing_open(request, timeout):
            raise urllib.error.HTTPError(
                request.full_url,
                400,
                "Bad Request",
                hdrs=None,
                fp=io.BytesIO(json.dumps({"error": {
                    "code": 400,
                    "status": "INVALID_ARGUMENT",
                    "message": echoed,
                }}).encode()),
            )

        with self.assertRaises(collector.CollectorError) as captured:
            collector.collect_snapshot(
                ROOT / "tmp-adsense-never-written.json",
                account_name="accounts/pub-1234567890123456",
                client_id=sentinels[3],
                client_secret=sentinels[2],
                refresh_token=sentinels[1],
                now=NOW,
                open_url=failing_open,
            )

        message = str(captured.exception)
        self.assertIn("OAUTH_REFRESH", message)
        self.assertIn("HTTP 400", message)
        for secret in (*sentinels, "header_bearer_secret_1234567890", "accounts/pub-1234567890123456"):
            self.assertNotIn(secret, message)
        self.assertNotIn("https://", message)
        self.assertNotIn("?limit=", message)

    def test_non_json_http_error_body_reports_only_stage_and_http_status(self):
        def failing_open(request, timeout):
            raise urllib.error.HTTPError(
                request.full_url,
                400,
                "Bad Request",
                hdrs=None,
                fp=io.BytesIO(b"<html>private proxy body and https://internal.invalid/?token=secret</html>"),
            )

        with self.assertRaises(collector.CollectorError) as captured:
            collector.collect_snapshot(
                ROOT / "tmp-adsense-non-json-never-written.json",
                account_name="accounts/pub-test",
                client_id="CLIENT_ID_SENTINEL",
                client_secret="CLIENT_SECRET_SENTINEL",
                refresh_token="REFRESH_TOKEN_SENTINEL",
                now=NOW,
                open_url=failing_open,
            )

        message = str(captured.exception)
        self.assertIn("OAUTH_REFRESH", message)
        self.assertIn("HTTP 400", message)
        self.assertNotIn("private proxy body", message)
        self.assertNotIn("internal.invalid", message)
        self.assertNotIn("token=secret", message)

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
            self.assertIn("OWNED_SITE_DOMAIN_NAME==emfls.github.io", query_strings[1]["filters"])
            self.assertNotIn("filters", query_strings[2])
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

    def test_snapshot_validator_accepts_page_url_not_available_without_values(self):
        snapshot = self.build()
        snapshot["pageUrls"].update({
            "coverageStatus": "NOT_AVAILABLE",
            "rows": [],
            "returnedRowCount": 0,
            "totalMatchedRows": None,
            "truncationStatus": "NOT_AVAILABLE",
            "unavailableReason": "PAGE_URL_DIMENSION_COMBINATION_UNAVAILABLE",
        })

        self.assertTrue(self.require_function("validate_snapshot")(snapshot))
        self.assertEqual(snapshot["site"]["status"], "VERIFIED")
        self.assertEqual(snapshot["site"]["comparisonStatus"], "VERIFIED")

    def test_snapshot_validator_rejects_fabricated_values_for_page_url_not_available(self):
        snapshot = self.build()
        snapshot["pageUrls"].update({
            "coverageStatus": "NOT_AVAILABLE",
            "rows": [],
            "returnedRowCount": 0,
            "totalMatchedRows": None,
            "truncationStatus": "NOT_AVAILABLE",
            "unavailableReason": "PAGE_URL_DIMENSION_COMBINATION_UNAVAILABLE",
        })
        self.assertTrue(self.require_function("validate_snapshot")(snapshot))

        snapshot["pageUrls"]["rows"] = [{
            "url": "https://emfls.github.io/unavailable.html",
            "estimatedEarnings": 0,
            "impressions": 0,
            "clicks": 0,
            "revenueMetric": "ESTIMATED_EARNINGS",
            "source": "DIRECT_ADSENSE_PAGE_URL",
        }]
        with self.assertRaises(collector.CollectorError):
            self.require_function("validate_snapshot")(snapshot)

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


class AdSenseBreakdownSnapshotTest(TestCase):
    def build(self, **fixture_options):
        site_current, site_prior, page = reports()
        base = collector.build_snapshot(
            account_name="accounts/pub-test",
            account={"name": "accounts/pub-test", "timeZone": {"id": "Asia/Seoul"}},
            current_report=site_current,
            prior_report=site_prior,
            page_url_report=page,
            now=NOW,
            generated_at="2026-10-05T06:00:00+00:00",
            days=7,
        )
        daily, breakdowns = breakdown_fixtures(base, **fixture_options)
        return collector.build_breakdown_snapshot(
            account_name="accounts/pub-test",
            account={"name": "accounts/pub-test", "timeZone": {"id": "Asia/Seoul"}},
            snapshot=base,
            daily_report=daily,
            breakdown_reports=breakdowns,
            generated_at="2026-10-05T06:00:00Z",
            days=7,
        )

    def test_daily_rows_keep_two_complete_windows_metrics_timezone_currency_and_periods(self):
        artifact = self.build()

        self.assertEqual(artifact["source"], "DIRECT_ADSENSE_MANAGEMENT_API_V2")
        self.assertEqual(artifact["reportingTimeZone"], {"mode": "ACCOUNT_TIME_ZONE", "id": "Asia/Seoul"})
        self.assertEqual(artifact["currency"], "USD")
        self.assertEqual(artifact["priorPeriod"], {"start": "2026-09-21", "end": "2026-09-27", "days": 7, "inclusive": True})
        self.assertEqual(artifact["currentPeriod"], {"start": "2026-09-28", "end": "2026-10-04", "days": 7, "inclusive": True})
        self.assertEqual(artifact["daily"]["rowCount"], 14)
        self.assertEqual(artifact["daily"]["rows"][-1]["date"], "2026-10-04")
        self.assertEqual(artifact["daily"]["rows"][-1]["estimatedEarnings"], 18.5)
        self.assertEqual(artifact["daily"]["rows"][-1]["pageViews"], 1000)
        self.assertEqual(artifact["daily"]["rows"][-1]["pageViewsRPM"], 18.5)
        self.assertEqual(artifact["daily"]["rows"][-1]["impressions"], 2000)
        self.assertEqual(artifact["daily"]["rows"][-1]["clicks"], 10)
        self.assertEqual(artifact["daily"]["rows"][-1]["costPerClick"], 1.85)
        self.assertEqual(artifact["daily"]["rows"][-1]["adRequests"], 2500)
        self.assertEqual(artifact["daily"]["rows"][-1]["matchedAdRequests"], 2200)
        self.assertEqual(artifact["daily"]["rows"][-1]["adRequestsCoverage"], 0.88)
        self.assertEqual(artifact["daily"]["rows"][-1]["activeViewViewability"], 0.62)

    def test_daily_sum_matches_site_aggregate_only_for_additive_metrics(self):
        artifact = self.build()

        self.assertEqual(artifact["daily"]["rowAggregateCheck"]["estimatedEarnings"], {"status": "MATCH", "dailyTotal": 28.5, "reportedTotal": 28.5})
        self.assertEqual(artifact["daily"]["rowAggregateCheck"]["pageViews"], {"status": "MATCH", "dailyTotal": 1500, "reportedTotal": 1500})
        self.assertEqual(artifact["daily"]["rowAggregateCheck"]["pageViewsRPM"]["status"], "NON_ADDITIVE")
        self.assertEqual(artifact["daily"]["rowAggregateCheck"]["costPerClick"]["status"], "NON_ADDITIVE")
        self.assertEqual(artifact["aggregateReconciliation"]["current"]["estimatedEarnings"]["status"], "MATCH")
        self.assertEqual(artifact["aggregateReconciliation"]["prior"]["pageViews"]["status"], "MATCH")

    def test_partial_missing_date_is_not_filled_with_zero_and_explicit_zero_is_preserved(self):
        artifact = self.build(missing_date="2026-10-02")

        daily = artifact["daily"]
        self.assertEqual(daily["status"], "PARTIAL")
        self.assertEqual(daily["missingDates"], ["2026-10-02"])
        self.assertNotIn("2026-10-02", {row["date"] for row in daily["rows"]})
        self.assertEqual(daily["rows"][0]["estimatedEarnings"], 0)
        self.assertEqual(daily["rowAggregateCheck"]["estimatedEarnings"]["status"], "NOT_AVAILABLE")

    def test_missing_metric_stays_null_and_partial_day_is_excluded(self):
        artifact = self.build(missing_metric=True)

        self.assertIsNone(artifact["daily"]["rows"][0]["activeViewViewability"])
        self.assertEqual(artifact["daily"]["status"], "PARTIAL")
        self.assertEqual(artifact["daily"]["rowAggregateCheck"]["estimatedEarnings"]["status"], "MATCH")
        self.assertEqual(artifact["aggregateReconciliation"]["current"]["estimatedEarnings"]["status"], "MATCH")
        self.assertEqual(artifact["range"]["end"], "2026-10-04")
        self.assertNotIn("2026-10-05", [row["date"] for row in artifact["daily"]["rows"]])

    def test_pair_breakdowns_are_retained_and_unverified_three_way_pair_is_not_fabricated(self):
        artifact = self.build()

        self.assertEqual(artifact["breakdowns"]["country"]["dimensions"], ["DATE", "COUNTRY_NAME"])
        self.assertEqual(artifact["breakdowns"]["country"]["rows"][0]["country"], "South Korea")
        self.assertEqual(artifact["breakdowns"]["platformType"]["rows"][0]["platformType"], "Desktop")
        self.assertEqual(artifact["breakdowns"]["adFormat"]["rows"][0]["adFormat"], "In-page")
        three_way = artifact["breakdowns"]["platformTypeAdFormat"]
        self.assertEqual(three_way["status"], "NOT_AVAILABLE")
        self.assertEqual(three_way["availabilityReason"], "NOT_PROBED_ACTUAL_API_COMPATIBILITY")
        self.assertEqual(three_way["rows"], [])

    def test_warnings_and_row_truncation_are_preserved_as_partial(self):
        artifact = self.build(warnings=["fixture report warning"], total_matched_rows=15)

        self.assertEqual(artifact["daily"]["rowCount"], 14)
        self.assertEqual(artifact["daily"]["totalMatchedRows"], 15)
        self.assertEqual(artifact["daily"]["truncationStatus"], "TRUNCATED")
        self.assertEqual(artifact["daily"]["status"], "PARTIAL")
        self.assertIn("fixture report warning", artifact["daily"]["warnings"])
        self.assertIn("fixture report warning", artifact["warnings"])

    def test_additive_total_mismatch_is_partial_and_not_silently_accepted(self):
        artifact = self.build(aggregate_mismatch=True)

        self.assertEqual(artifact["daily"]["status"], "PARTIAL")
        self.assertEqual(artifact["daily"]["rowAggregateCheck"]["estimatedEarnings"]["status"], "MISMATCH")
        self.assertTrue(any("row sums did not match" in warning for warning in artifact["warnings"]))

    def test_unavailable_breakdown_is_unknown_not_zero(self):
        artifact = self.build()
        artifact["breakdowns"]["country"] = collector.unavailable_breakdown_report(
            ["DATE", "COUNTRY_NAME"], "NOT_AVAILABLE", "API_ERROR", ["safe API error"]
        )
        artifact["rowCounts"]["country"] = 0

        self.assertEqual(artifact["breakdowns"]["country"]["rows"], [])
        self.assertIsNone(artifact["breakdowns"]["country"]["totalMatchedRows"])
        self.assertEqual(artifact["breakdowns"]["country"]["status"], "NOT_AVAILABLE")
        self.assertNotIn("estimatedEarnings", artifact["breakdowns"]["country"])
        self.assertTrue(collector.validate_breakdown_snapshot(artifact))

    def test_breakdown_validator_rejects_rows_missing_a_metric_field(self):
        artifact = self.build()
        artifact["daily"]["rows"][0].pop("estimatedEarnings")

        with self.assertRaises(collector.CollectorError):
            collector.validate_breakdown_snapshot(artifact)

    def test_breakdown_validator_accepts_explicit_zero_and_null_values(self):
        artifact = self.build(missing_metric=True)

        self.assertTrue(collector.validate_breakdown_snapshot(artifact))
        self.assertEqual(artifact["daily"]["rows"][1]["estimatedEarnings"], 0)
        self.assertIsNone(artifact["daily"]["rows"][0]["activeViewViewability"])

    def test_validate_breakdown_only_cli_validates_saved_sidecar_without_credentials(self):
        artifact = self.build()
        path = ROOT / "tmp-adsense-breakdown-schema-validation.json"
        path.write_text(json.dumps(artifact), encoding="utf-8")
        try:
            result = subprocess.run(
                [sys.executable, str(COLLECTOR), "--validate-breakdown-only", str(path)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
                env={"PATH": os.environ.get("PATH", "")},
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("AdSense breakdown schema: PASS", result.stdout)
        finally:
            path.unlink(missing_ok=True)

    def test_breakdown_storage_window_cannot_expand_beyond_two_seven_day_periods(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(collector.CollectorError) as captured:
                collector.collect_snapshot(
                    Path(temporary) / "adsense-latest.json",
                    account_name="accounts/pub-test",
                    client_id="client",
                    client_secret="secret",
                    refresh_token="refresh",
                    days=8,
                    breakdown_output=Path(temporary) / "adsense-breakdown-latest.json",
                    open_url=lambda *_args, **_kwargs: self.fail("bounded-window rejection must not call the API"),
                )
        self.assertIn("bounded to two seven-day periods", str(captured.exception))

    def test_breakdown_cannot_replace_the_existing_snapshot_path(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "adsense-latest.json"
            output.write_text('{"marker":"last-good"}\n', encoding="utf-8")
            with self.assertRaises(collector.CollectorError) as captured:
                collector.collect_snapshot(
                    output,
                    account_name="accounts/pub-test",
                    client_id="client",
                    client_secret="secret",
                    refresh_token="refresh",
                    breakdown_output=output,
                    open_url=lambda *_args, **_kwargs: self.fail("output collision must be rejected before API access"),
                )
            self.assertIn("different files", str(captured.exception))
            self.assertEqual(output.read_text(encoding="utf-8"), '{"marker":"last-good"}\n')

    def test_collection_keeps_existing_snapshot_contract_and_fails_soft_per_report(self):
        site_current, site_prior, _page = reports()
        base = collector.build_snapshot(
            account_name="accounts/pub-test",
            account={"name": "accounts/pub-test", "timeZone": {"id": "Asia/Seoul"}},
            current_report=site_current,
            prior_report=site_prior,
            page_url_report=None,
            page_url_unavailable_reason=collector.PAGE_URL_UNAVAILABLE_CLASSIFICATION,
            page_url_unavailable_warning="The combination of requested dimensions is unavailable.",
            now=NOW,
            generated_at="2026-10-05T06:00:00Z",
            days=7,
        )
        daily_report, dimension_reports = breakdown_fixtures(base)
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
            if request.full_url.startswith(collector.OAUTH_TOKEN_URL):
                return Response({"access_token": "ACCESS_TOKEN_SENTINEL", "expires_in": 3600, "token_type": "Bearer"})
            query = parse_qs(urlsplit(request.full_url).query)
            if "/reports:generate" not in request.full_url:
                return Response({"name": "accounts/pub-test", "timeZone": {"id": "Asia/Seoul"}})
            dimensions = tuple(query.get("dimensions", []))
            if dimensions == PAGE_DIMENSIONS:
                raise urllib.error.HTTPError(
                    request.full_url,
                    400,
                    "Bad Request",
                    hdrs=None,
                    fp=io.BytesIO(json.dumps({"error": {
                        "code": 400,
                        "status": "INVALID_ARGUMENT",
                        "message": collector.PAGE_URL_UNAVAILABLE_MESSAGE,
                    }}).encode()),
                )
            if dimensions == SITE_DIMENSIONS:
                return Response(site_current if query["startDate.year"] == ["2026"] and query["startDate.month"] == ["9"] and query["startDate.day"] == ["28"] else site_prior)
            if dimensions == ("DATE",):
                return Response(daily_report)
            if dimensions == ("DATE", "COUNTRY_NAME"):
                raise urllib.error.HTTPError(
                    request.full_url,
                    400,
                    "Bad Request",
                    hdrs=None,
                    fp=io.BytesIO(json.dumps({"error": {
                        "code": 400,
                        "status": "INVALID_ARGUMENT",
                        "message": "Unsupported combination of dimensions and metrics.",
                    }}).encode()),
                )
            if dimensions == ("DATE", "PLATFORM_TYPE_NAME"):
                return Response(dimension_reports["platformType"])
            if dimensions == ("DATE", "AD_FORMAT_NAME"):
                return Response(dimension_reports["adFormat"])
            self.fail(f"Unexpected AdSense report dimensions: {dimensions}")

        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "adsense-latest.json"
            breakdown_output = Path(temporary) / "adsense-breakdown-latest.json"
            snapshot = collector.collect_snapshot(
                output,
                account_name="accounts/pub-test",
                client_id="CLIENT_ID_SENTINEL",
                client_secret="CLIENT_SECRET_SENTINEL",
                refresh_token="REFRESH_TOKEN_SENTINEL",
                now=NOW,
                open_url=fake_open,
                breakdown_output=breakdown_output,
            )
            stored_snapshot = json.loads(output.read_text(encoding="utf-8"))
            stored_breakdown = json.loads(breakdown_output.read_text(encoding="utf-8"))

        self.assertEqual(len(requests), 9)
        self.assertEqual(stored_snapshot["source"], "DIRECT_ADSENSE_MANAGEMENT_API_V2")
        self.assertEqual(snapshot["pageUrls"]["coverageStatus"], "NOT_AVAILABLE")
        self.assertEqual(snapshot["site"], stored_snapshot["site"])
        self.assertEqual(stored_breakdown["breakdowns"]["country"]["status"], "UNSUPPORTED_COMBINATION")
        self.assertEqual(stored_breakdown["breakdowns"]["country"]["rows"], [])
        self.assertEqual(stored_breakdown["daily"]["status"], "COMPLETE")
        requested_dimensions = [
            tuple(parse_qs(urlsplit(request.full_url).query).get("dimensions", []))
            for request in requests if "/reports:generate" in request.full_url
        ]
        self.assertNotIn(("DATE", "PLATFORM_TYPE_NAME", "AD_FORMAT_NAME"), requested_dimensions)
        breakdown_queries = [
            parse_qs(urlsplit(request.full_url).query)
            for request in requests
            if "/reports:generate" in request.full_url
            and tuple(parse_qs(urlsplit(request.full_url).query).get("dimensions", [])) not in {SITE_DIMENSIONS, PAGE_DIMENSIONS}
        ]
        self.assertTrue(all(query["metrics"] == list(BREAKDOWN_METRICS_FIXTURE) for query in breakdown_queries))
        self.assertTrue(all(query["limit"] == ["4000"] for query in breakdown_queries))
