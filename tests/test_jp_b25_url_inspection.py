import csv
import hashlib
import json
from pathlib import Path

from scripts.inspect_gsc_urls import (
    CLASSIFICATIONS,
    build_decision_rows,
    classify_inspection,
    inspect_urls,
    load_manifest,
    summarize,
    write_artifacts,
)


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/jp-b25-url-inspection-input-20261007.csv"
WORKFLOW = ROOT / ".github/workflows/gsc-collection.yml"
ROUTE_SHA256 = "0da63fa6450d2d3c956d44d74b24e05012a42d0fcbc580691a8d29dbcc86727c"


def record(index_status):
    return {
        "inspectionUrl": "https://emfls.github.io/jp/report/travel/example.html",
        "response": {"inspectionResult": {"indexStatusResult": index_status}},
    }


class FakeRequest:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error
        self.retry_counts = []

    def execute(self, *, num_retries):
        self.retry_counts.append(num_retries)
        if self.error:
            raise self.error
        return self.response


class FakeIndex:
    def __init__(self, requests):
        self.requests = iter(requests)
        self.bodies = []

    def inspect(self, *, body):
        self.bodies.append(body)
        return next(self.requests)


class FakeUrlInspection:
    def __init__(self, index):
        self._index = index

    def index(self):
        return self._index


class FakeService:
    def __init__(self, index):
        self._url_inspection = FakeUrlInspection(index)

    def urlInspection(self):
        return self._url_inspection


def test_manifest_is_the_frozen_nested_b25_set():
    rows = load_manifest(MANIFEST)
    routes = [row["route"] for row in rows]
    digest = hashlib.sha256(("\n".join(routes) + "\n").encode()).hexdigest()
    assert len(rows) == 25
    assert digest == ROUTE_SHA256
    assert routes[0] == "/jp/report/travel/malaysia-kuala-terengganu.html"
    assert routes[-1] == "/jp/report/travel/somalia-kismayo.html"
    assert all(row["selectionSet"] == "NESTED_REFINED_B25_OF_B100" for row in rows)


def test_classification_uses_explicit_index_status_and_missing_fields_stay_unknown():
    assert classify_inspection(record({"verdict": "PASS"})) == "INDEXED"
    assert classify_inspection(
        record({"verdict": "NEUTRAL", "coverageState": "Discovered - currently not indexed"})
    ) == "DISCOVERED_NOT_INDEXED"
    assert classify_inspection(
        record({"verdict": "NEUTRAL", "coverageState": "Crawled - currently not indexed"})
    ) == "CRAWLED_NOT_INDEXED"
    assert classify_inspection(
        record({"verdict": "NEUTRAL", "coverageState": "URL is unknown to Google"})
    ) == "URL_UNKNOWN_TO_GOOGLE"
    assert classify_inspection(record({"verdict": "FAIL"})) == "NOT_INDEXED"
    assert classify_inspection(record({"robotsTxtState": "DISALLOWED"})) == "BLOCKED"
    assert classify_inspection(record({"indexingState": "INDEXING_ALLOWED"})) == "INSPECTION_UNKNOWN"
    assert classify_inspection({"inspectionUrl": "https://emfls.github.io/x", "error": {"class": "HttpError", "status": 403}}) == "INSPECTION_UNKNOWN"
    assert set(CLASSIFICATIONS) == {
        "INDEXED", "NOT_INDEXED", "URL_UNKNOWN_TO_GOOGLE", "CRAWLED_NOT_INDEXED",
        "DISCOVERED_NOT_INDEXED", "BLOCKED", "INSPECTION_UNKNOWN",
    }


def test_inspection_calls_once_without_retry_and_keeps_raw_response_unchanged():
    url = "https://emfls.github.io/jp/report/travel/example.html"
    response = {"inspectionResult": {"inspectionResultLink": "https://search.google.com/search-console/inspect?resource_id=x", "indexStatusResult": {"verdict": "PASS", "sitemap": ["https://emfls.github.io/jp/report/travel/sitemap.xml"]}}}
    request = FakeRequest(response=response)
    index = FakeIndex([request])
    rows = inspect_urls([url], FakeService(index))
    assert rows == [{"inspectionUrl": url, "response": response}]
    assert request.retry_counts == [0]
    assert index.bodies == [{"inspectionUrl": url, "siteUrl": "https://emfls.github.io/", "languageCode": "en-US"}]


def test_inspection_records_exact_error_class_and_status_then_continues():
    class FakeHttpError(Exception):
        def __init__(self):
            self.resp = type("Response", (), {"status": 429})()
            super().__init__("quota")

    failed = FakeRequest(error=FakeHttpError())
    succeeded = FakeRequest(response={"inspectionResult": {"indexStatusResult": {"verdict": "PASS"}}})
    index = FakeIndex([failed, succeeded])
    urls = ["https://emfls.github.io/jp/report/travel/a.html", "https://emfls.github.io/jp/report/travel/b.html"]
    rows = inspect_urls(urls, FakeService(index))
    assert rows[0]["error"] == {"class": "FakeHttpError", "status": 429}
    assert rows[1]["response"] == {"inspectionResult": {"indexStatusResult": {"verdict": "PASS"}}}
    assert failed.retry_counts == [0]
    assert succeeded.retry_counts == [0]


def test_decisions_preserve_google_field_names_and_returned_field_presence():
    input_row = {"url": "https://emfls.github.io/jp/report/travel/example.html", "route": "/jp/report/travel/example.html"}
    inspection = {"inspectionUrl": input_row["url"], "response": {"inspectionResult": {"inspectionResultLink": "https://search.google.com/search-console/inspect?resource_id=x", "indexStatusResult": {"verdict": "PASS", "coverageState": "Indexed", "sitemap": ["https://emfls.github.io/jp/report/travel/sitemap.xml"], "referringUrls": []}}}}
    row = build_decision_rows([input_row], [inspection])[0]
    assert row["classification"] == "INDEXED"
    assert row["inspectionResultLink"].startswith("https://search.google.com/")
    assert row["verdict"] == "PASS"
    assert row["coverageState"] == "Indexed"
    assert json.loads(row["sitemap"]) == ["https://emfls.github.io/jp/report/travel/sitemap.xml"]
    assert "robotsTxtState" not in row["returnedIndexStatusFields"]


def test_artifacts_contain_only_the_four_requested_outputs(tmp_path):
    rows = load_manifest(MANIFEST)
    inspections = []
    for row in rows:
        inspections.append({"inspectionUrl": row["url"], "response": {"inspectionResult": {"indexStatusResult": {"verdict": "PASS", "coverageState": "Indexed"}}}})
    summary = write_artifacts(MANIFEST, rows, inspections, tmp_path)
    assert {p.name for p in tmp_path.iterdir()} == {
        "b25-input-manifest.csv", "b25-url-inspection.json", "b25-decision.csv", "b25-summary.json"
    }
    raw = json.loads((tmp_path / "b25-url-inspection.json").read_text(encoding="utf-8"))
    assert raw["records"] == inspections
    assert summary["classificationCounts"]["INDEXED"] == 25
    assert summary["inputCount"] == summary["inspectionRecordCount"] == 25
    decision = list(csv.DictReader((tmp_path / "b25-decision.csv").open(encoding="utf-8", newline="")))
    assert len(decision) == 25


def test_workflow_has_branch_guard_read_only_audit_and_seven_day_artifact():
    source = WORKFLOW.read_text(encoding="utf-8")
    dispatch = source[source.index("  workflow_dispatch:"):source.index("permissions:")]
    assert "jp_url_inspection_audit:" in dispatch
    assert "type: boolean" in dispatch
    assert "default: false" in dispatch
    assert "options: [page, camping-query, opportunity-query, sitewide-query]" in dispatch
    assert "inputs.jp_url_inspection_audit != true" in source
    assert "jp-b25-url-inspection" in source
    start = source.index("  inspect_jp_b25:")
    audit = source[start:]
    assert "inputs.jp_url_inspection_audit == true" in audit
    assert 'test "$GITHUB_REF" = "refs/heads/codex/jp-b25-url-inspection-audit-20261007"' in audit
    assert "contents: read" in audit
    assert "scripts/inspect_gsc_urls.py" in audit
    assert "runner.temp" in audit
    assert "actions/upload-artifact@v4" in audit
    assert "retention-days: 7" in audit
    assert "git add" not in audit
    assert "git commit" not in audit


def test_summary_keeps_source_window_gaps_and_missing_gsc_rows_unknown():
    rows = load_manifest(MANIFEST)
    records = [{"inspectionUrl": row["url"], "error": {"class": "HttpError", "status": 429}} for row in rows]
    summary = summarize(rows, records)
    assert summary["ga4CandidateStatus"]["GA4_90D_NO_ACTIVITY_ROW"] == 25
    assert summary["ga4CandidateStatus"]["sourceWindowProvenInManifest"] == 0
    assert summary["ga4CandidateStatus"]["trackedSnapshotWindow"] == {"start": "2026-09-08", "end": "2026-10-05"}
    assert summary["ga4CandidateStatus"]["B25RowsAbsentInTrackedSnapshot"] == 25
    assert summary["gscPageSignal"]["B25RowsAbsentInTrackedSnapshot"] == 25
    assert summary["gscPageSignal"]["B25PositiveClickOrImpressionRows"] == 0
    assert summary["gscPageSignal"]["missingRowsMeanZero"] is False
    assert summary["highConfidenceDeleteCandidateCount"] == 0
    assert summary["holdCount"] == 25


def test_explicitly_excluded_pages_stay_on_hold_without_proven_90_day_window():
    rows = load_manifest(MANIFEST)
    records = [
        {
            "inspectionUrl": row["url"],
            "response": {
                "inspectionResult": {
                    "indexStatusResult": {
                        "verdict": "NEUTRAL",
                        "coverageState": "Crawled - currently not indexed",
                    }
                }
            },
        }
        for row in rows
    ]
    summary = summarize(rows, records)
    assert summary["classificationCounts"]["CRAWLED_NOT_INDEXED"] == 25
    assert summary["highConfidenceDeleteCandidateCount"] == 0
    assert summary["holdCount"] == 25
