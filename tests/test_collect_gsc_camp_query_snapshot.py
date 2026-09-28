from datetime import date
from pathlib import Path
import subprocess
import sys

import pytest

from scripts.collect_gsc_camp_query_snapshot import (
    PROPERTY_URL,
    build_snapshot,
    collect_with_service,
    get_collection_period,
    validate_snapshot,
    write_atomically,
)

ROOT = Path(__file__).resolve().parents[1]


class _Request:
    def __init__(self, payload):
        self.payload = payload

    def execute(self):
        return self.payload


class _Sites:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def get(self, *, siteUrl):
        self.calls.append(siteUrl)
        return _Request(self.response)


class _SearchAnalytics:
    def __init__(self, pages):
        self.pages = pages
        self.calls = []

    def query(self, *, siteUrl, body):
        self.calls.append((siteUrl, body))
        return _Request(self.pages.get(body["startRow"], {"rows": []}))


class _Service:
    def __init__(self, site_response, pages):
        self.site_api = _Sites(site_response)
        self.analytics_api = _SearchAnalytics(pages)

    def sites(self):
        return self.site_api

    def searchanalytics(self):
        return self.analytics_api


def _row(page, query, clicks, impressions, position):
    return {
        "keys": [page, query],
        "clicks": clicks,
        "impressions": impressions,
        "ctr": clicks / impressions if impressions else 0,
        "position": position,
    }


def test_period_uses_established_28_day_window_and_three_day_lag():
    assert get_collection_period(date(2026, 9, 28)) == ("2026-08-29", "2026-09-25")


def test_collector_script_can_run_as_a_file_from_repo_root():
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "collect_gsc_camp_query_snapshot.py"), "--help"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr


def test_collect_requests_exact_property_camping_pages_and_page_query_dimensions():
    service = _Service(
        {"siteUrl": PROPERTY_URL, "permissionLevel": "siteOwner"},
        {0: {"rows": [_row("https://emfls.github.io/kor/report/camp/a.html", "캠핑장 예약", 2, 8, 4.5)]}},
    )

    rows = collect_with_service(service, PROPERTY_URL, "2026-08-29", "2026-09-25", row_limit=10)

    assert len(rows) == 1
    assert service.site_api.calls == [PROPERTY_URL]
    site_url, body = service.analytics_api.calls[0]
    assert site_url == PROPERTY_URL
    assert body["dimensions"] == ["page", "query"]
    assert body["aggregationType"] == "byPage"
    assert body["dimensionFilterGroups"][0]["filters"] == [
        {"dimension": "page", "operator": "contains", "expression": "/kor/report/camp/"}
    ]
    assert body["startDate"] == "2026-08-29"
    assert body["endDate"] == "2026-09-25"


def test_collect_paginates_all_query_rows():
    service = _Service(
        {"siteUrl": PROPERTY_URL, "permissionLevel": "siteOwner"},
        {
            0: {"rows": [_row("https://emfls.github.io/kor/report/camp/a.html", "첫 쿼리", 1, 2, 3), _row("https://emfls.github.io/kor/report/camp/a.html", "둘 쿼리", 0, 1, 7)]},
            2: {"rows": [_row("https://emfls.github.io/kor/report/camp/b.html", "셋 쿼리", 2, 4, 5), _row("https://emfls.github.io/kor/report/camp/b.html", "넷 쿼리", 0, 2, 8)]},
        },
    )

    rows = collect_with_service(service, PROPERTY_URL, "2026-08-29", "2026-09-25", row_limit=2)

    assert len(rows) == 4
    assert [body["startRow"] for _, body in service.analytics_api.calls] == [0, 2, 4]


def test_rejects_property_response_that_does_not_exactly_match():
    service = _Service(
        {"siteUrl": "sc-domain:emfls.github.io", "permissionLevel": "siteOwner"},
        {0: {"rows": []}},
    )

    with pytest.raises(ValueError, match="property mismatch"):
        collect_with_service(service, PROPERTY_URL, "2026-08-29", "2026-09-25")


@pytest.mark.parametrize(
    "keys",
    [None, [], [None, "query"], ["", "query"], ["https://emfls.github.io/kor/report/travel/a.html", "query"],
     ["https://other.example/kor/report/camp/a.html", "query"],
     ["http://emfls.github.io/kor/report/camp/a.html", "query"],
     ["https://emfls.github.io/kor/report/camp/a.html", ""]],
)
def test_invalid_or_out_of_scope_rows_are_rejected(keys):
    row = {"clicks": 1, "impressions": 2, "position": 3}
    if keys is not None:
        row["keys"] = keys
    with pytest.raises(ValueError):
        build_snapshot([row], period_start="2026-08-29", period_end="2026-09-25", generated_at="2026-09-28T00:00:00+00:00")


def test_snapshot_preserves_query_text_and_aggregates_duplicate_page_query_rows():
    snapshot = build_snapshot(
        [
            _row("https://emfls.github.io/kor/report/camp/a.html?ref=one", "캠핑장 예약 방법", 2, 10, 5),
            _row("https://emfls.github.io/kor/report/camp/a.html?ref=two", "캠핑장 예약 방법", 1, 5, 8),
            _row("https://emfls.github.io/kor/report/camp/a.html", "캠핑장 예약", 3, 10, 7),
        ],
        period_start="2026-08-29", period_end="2026-09-25", generated_at="2026-09-28T00:00:00+00:00",
    )

    assert snapshot["dimensions"] == ["page", "query"]
    assert snapshot["property"] == PROPERTY_URL
    assert snapshot["periods"]["gscCampQuery"] == {"start": "2026-08-29", "end": "2026-09-25"}
    assert len(snapshot["rows"]) == 2
    merged = next(row for row in snapshot["rows"] if row["query"] == "캠핑장 예약 방법")
    assert merged["page"] == "/kor/report/camp/a.html"
    assert merged["clicks"] == 3
    assert merged["impressions"] == 15
    assert merged["ctr"] == 0.2
    assert merged["position"] == 6
    assert snapshot["limitations"]["notForRevenueClassification"] is True
    assert validate_snapshot(snapshot) == {
        "rows": 2,
        "uniquePages": 1,
        "period": {"start": "2026-08-29", "end": "2026-09-25"},
    }


def test_empty_or_invalid_response_does_not_overwrite_previous_artifact(tmp_path):
    path = tmp_path / "gsc-camp-query-latest.json"
    path.write_text('{"prior": true}\n', encoding="utf-8")

    with pytest.raises(ValueError):
        payload = build_snapshot([], period_start="2026-08-29", period_end="2026-09-25", generated_at="2026-09-28T00:00:00+00:00")
        write_atomically(path, payload)
    assert path.read_text(encoding="utf-8") == '{"prior": true}\n'

    with pytest.raises(ValueError):
        payload = build_snapshot([{"keys": ["https://emfls.github.io/kor/report/camp/a.html"]}], period_start="2026-08-29", period_end="2026-09-25", generated_at="2026-09-28T00:00:00+00:00")
        write_atomically(path, payload)
    assert path.read_text(encoding="utf-8") == '{"prior": true}\n'


def test_atomic_writer_refuses_empty_artifact(tmp_path):
    path = tmp_path / "gsc-camp-query-latest.json"
    path.write_text('{"prior": true}\n', encoding="utf-8")

    payload = build_snapshot(
        [_row("https://emfls.github.io/kor/report/camp/a.html", "캠핑 쿼리", 1, 2, 3)],
        period_start="2026-08-29", period_end="2026-09-25", generated_at="2026-09-28T00:00:00+00:00",
    )
    payload["rows"] = []
    with pytest.raises(ValueError, match="empty"):
        write_atomically(path, payload)
    assert path.read_text(encoding="utf-8") == '{"prior": true}\n'
