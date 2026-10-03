import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.collect_gsc_opportunity_query_snapshot import (
    PROPERTY_URL,
    build_snapshot,
    collect_with_service,
    current_opportunity_urls,
    run_collection,
    validate_snapshot,
)

ROOT = Path(__file__).resolve().parents[1]


class _Request:
    def __init__(self, payload):
        self.payload = payload

    def execute(self):
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload


class _Sites:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def get(self, *, siteUrl):
        self.calls.append(siteUrl)
        return _Request(self.response)


class _SearchAnalytics:
    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    def query(self, *, siteUrl, body):
        self.calls.append((siteUrl, body))
        expression = body["dimensionFilterGroups"][0]["filters"][0]["expression"]
        return _Request(self.responses.get(expression, {"rows": []}))


class _Service:
    def __init__(self, responses, site_response=None):
        self.site_api = _Sites(site_response or {"siteUrl": PROPERTY_URL, "permissionLevel": "siteOwner"})
        self.analytics_api = _SearchAnalytics(responses)

    def sites(self):
        return self.site_api

    def searchanalytics(self):
        return self.analytics_api


def _row(query, clicks, impressions, position):
    return {
        "keys": [query],
        "clicks": clicks,
        "impressions": impressions,
        "ctr": clicks / impressions if impressions else 0,
        "position": position,
    }


def _opportunity(url, classification="OPPORTUNITY"):
    return {"url": url, "classification": classification}


def _summary(count):
    return {"classificationCounts": {"OPPORTUNITY": count}}


def test_existing_page_snapshot_schema_remains_page_level_only():
    with (ROOT / "data/performance/gsc-latest.json").open(encoding="utf-8") as handle:
        snapshot = json.load(handle)
    assert set(snapshot) == {
        "status", "source", "property", "periodStart", "periodEnd", "generatedAt", "periods", "pages"
    }
    assert snapshot["pages"]
    assert set(snapshot["pages"][0]) == {"url", "google"}


def test_current_opportunities_are_exhaustive_and_cross_checked_against_summary():
    page_performance = {"pages": [_opportunity("/a/"), _opportunity("/b/"), _opportunity("/winner/", "WINNER")]}
    assert current_opportunity_urls(page_performance, _summary(2)) == ["/a/", "/b/"]
    with pytest.raises(ValueError, match="does not match"):
        current_opportunity_urls(page_performance, _summary(1))


def test_only_current_opportunity_urls_are_queried_and_not_ymyl_labeled():
    pages = [_opportunity("/a/"), _opportunity("/b/"), _opportunity("/winner/", "WINNER")]
    urls = current_opportunity_urls({"pages": pages}, _summary(2))
    service = _Service({})
    rows = collect_with_service(service, PROPERTY_URL, "2026-09-03", "2026-09-30", urls)
    assert set(rows) == {"/a/", "/b/"}
    assert [body["dimensionFilterGroups"][0]["filters"][0]["expression"] for _, body in service.analytics_api.calls] == [
        "https://emfls.github.io/a/", "https://emfls.github.io/b/"
    ]
    payload = build_snapshot(urls, rows, period_start="2026-09-03", period_end="2026-09-30", generated_at="2026-10-03T00:00:00+00:00")
    assert all("ymyl" not in page and "riskClass" not in page for page in payload["pages"])


def test_query_requests_use_page_snapshot_exact_period_and_full_canonical_url_filter():
    service = _Service({"https://emfls.github.io/util/a/": {"rows": [_row("query A", 2, 10, 4.5)]}})
    collect_with_service(service, PROPERTY_URL, "2026-09-03", "2026-09-30", ["/util/a/"])
    site_url, body = service.analytics_api.calls[0]
    assert site_url == PROPERTY_URL
    assert body["startDate"] == "2026-09-03"
    assert body["endDate"] == "2026-09-30"
    assert body["dimensions"] == ["query"]
    assert body["aggregationType"] == "auto"
    assert body["dimensionFilterGroups"] == [{"filters": [{
        "dimension": "page", "operator": "equals", "expression": "https://emfls.github.io/util/a/"
    }]}]


def test_query_rows_preserve_metrics_and_are_grouped_per_opportunity_url():
    urls = ["/util/a/", "/util/b/"]
    payload = build_snapshot(
        urls,
        {
            "/util/a/": [_row("alpha", 2, 10, 4), _row("beta", 1, 5, 8)],
            "/util/b/": [_row("gamma", 0, 3, 11)],
        },
        period_start="2026-09-03", period_end="2026-09-30", generated_at="2026-10-03T00:00:00+00:00",
    )
    assert validate_snapshot(payload)["queryRows"] == 3
    first, second = payload["pages"]
    assert first["url"] == "/util/a/"
    assert first["queryCount"] == 2
    assert first["queries"] == [
        {"query": "alpha", "clicks": 2, "impressions": 10, "ctr": 0.2, "position": 4.0},
        {"query": "beta", "clicks": 1, "impressions": 5, "ctr": 0.2, "position": 8.0},
    ]
    assert second["queries"][0]["clicks"] == 0
    assert second["queries"][0]["impressions"] == 3
    assert second["queries"][0]["position"] == 11.0


def test_empty_query_response_has_explicit_status_without_fabricated_zero_metrics():
    payload = build_snapshot(
        ["/util/a/"], {"/util/a/": []}, period_start="2026-09-03", period_end="2026-09-30",
        generated_at="2026-10-03T00:00:00+00:00",
    )
    page = payload["pages"][0]
    assert page["status"] == "NO_QUERY_ROWS_RETURNED"
    assert page["queryCount"] == 0
    assert page["queries"] == []
    assert "impressions" not in page
    assert "clicks" not in page
    assert "QUERY_ROWS_ARE_NOT_COMPLETE_COVERAGE" in payload["limitations"]


def test_api_error_preserves_last_good_sidecar(tmp_path):
    output = tmp_path / "gsc-opportunity-queries-latest.json"
    original = '{"last_good": true}\n'
    output.write_text(original, encoding="utf-8")
    service = _Service({"https://emfls.github.io/util/a/": RuntimeError("temporary API failure")})
    with pytest.raises(RuntimeError, match="temporary API failure"):
        run_collection(service, PROPERTY_URL, "2026-09-03", "2026-09-30", ["/util/a/"], output,
                       generated_at="2026-10-03T00:00:00+00:00")
    assert output.read_text(encoding="utf-8") == original


def test_dry_run_needs_no_secret_and_does_not_write_artifact(tmp_path):
    output = tmp_path / "should-not-exist.json"
    page_performance = tmp_path / "page-performance.json"
    opportunity_summary = tmp_path / "revenue-opportunities.json"
    page_performance.write_text(json.dumps({"pages": [
        _opportunity("/util/a/"), _opportunity("/util/b/"), _opportunity("/util/winner/", "WINNER"),
    ]}), encoding="utf-8")
    opportunity_summary.write_text(json.dumps(_summary(2)), encoding="utf-8")
    env = os.environ.copy()
    env.pop("GOOGLE_SERVICE_ACCOUNT_JSON_B64", None)
    env.pop("GA4_SERVICE_ACCOUNT_JSON_B64", None)
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts/collect_gsc_opportunity_query_snapshot.py"),
         "--dry-run", "--page-performance", str(page_performance),
         "--revenue-opportunities", str(opportunity_summary),
         "--output", str(output)], cwd=ROOT, env=env, capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["plannedUrls"] == 2
    assert not output.exists()
    assert "private_key" not in result.stdout


def test_noncanonical_urls_and_duplicate_normalized_opportunities_are_rejected():
    with pytest.raises(ValueError, match="relative site path"):
        current_opportunity_urls({"pages": [_opportunity("https://evil.example/a")]}, _summary(1))
    with pytest.raises(ValueError, match="duplicate"):
        current_opportunity_urls({"pages": [_opportunity("/a/"), _opportunity("/a/")]}, _summary(2))
    with pytest.raises(ValueError, match="query or fragment"):
        current_opportunity_urls({"pages": [_opportunity("/a/?x=1")]}, _summary(1))
