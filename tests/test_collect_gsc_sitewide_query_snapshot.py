from pathlib import Path
import importlib

import pytest


ROOT = Path(__file__).resolve().parents[1]
COLLECTOR = importlib.import_module("scripts.collect_gsc_sitewide_query_snapshot")
PROPERTY_URL = "https://emfls.github.io/"
PERIOD_START = "2026-09-05"
PERIOD_END = "2026-10-02"
GENERATED_AT = "2026-10-06T00:00:00+00:00"


def _function(name):
    value = getattr(COLLECTOR, name, None)
    assert callable(value), f"site-wide collector must implement {name}"
    return value


class _Request:
    def __init__(self, payload):
        self.payload = payload

    def execute(self):
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload


class _Sites:
    def __init__(self, response=None):
        self.response = response or {"siteUrl": PROPERTY_URL, "permissionLevel": "siteOwner"}
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
        if callable(self.responses):
            response = self.responses(body)
        else:
            response = self.responses.get(body["startRow"], {"rows": []})
        return _Request(response)


class _Service:
    def __init__(self, responses, site_response=None):
        self.site_api = _Sites(site_response)
        self.analytics_api = _SearchAnalytics(responses)

    def sites(self):
        return self.site_api

    def searchanalytics(self):
        return self.analytics_api


def _api_row(page="https://emfls.github.io/a?source=api#fragment", query="example query", clicks=1, impressions=2, position=3.5):
    return {
        "keys": [page, query],
        "clicks": clicks,
        "impressions": impressions,
        "ctr": clicks / impressions if impressions else 0.0,
        "position": position,
    }


def _snapshot():
    return {
        "status": "VERIFIED",
        "source": "GOOGLE_SEARCH_CONSOLE_API",
        "property": PROPERTY_URL,
        "periodStart": PERIOD_START,
        "periodEnd": PERIOD_END,
        "periods": {"gsc": {"start": PERIOD_START, "end": PERIOD_END}},
    }


def _build(rows, pagination=None):
    return _function("build_snapshot")(
        rows,
        property_url=PROPERTY_URL,
        period_start=PERIOD_START,
        period_end=PERIOD_END,
        generated_at=GENERATED_AT,
        pagination=pagination or {
            "pagesFetched": 1,
            "finalStartRow": 0,
            "stoppedBecause": "short_page",
            "maxPages": 20,
        },
    )


def test_sitewide_collector_is_separate_from_opportunity_sidecar():
    collector = ROOT / "scripts" / "collect_gsc_sitewide_query_snapshot.py"

    assert collector.is_file(), "site-wide evidence needs a dedicated collector"


def test_request_dimensions_are_page_and_query_with_web_final_semantics():
    service = _Service({0: {"rows": [_api_row()]}})

    _function("collect_with_service")(service, PROPERTY_URL, PERIOD_START, PERIOD_END)

    body = service.analytics_api.calls[0][1]
    assert body["dimensions"] == ["page", "query"]
    assert body["type"] == "web"
    assert body["dataState"] == "final"


def test_request_period_matches_the_current_page_snapshot(tmp_path):
    service = _Service({0: {"rows": [_api_row()]}})
    output = tmp_path / "gsc-sitewide-query.json"

    _function("run_collection")(service, _snapshot(), output, generated_at=GENERATED_AT)

    body = service.analytics_api.calls[0][1]
    assert body["startDate"] == PERIOD_START
    assert body["endDate"] == PERIOD_END


def test_request_has_no_page_filter():
    service = _Service({0: {"rows": []}})

    _function("collect_with_service")(service, PROPERTY_URL, PERIOD_START, PERIOD_END)

    assert "dimensionFilterGroups" not in service.analytics_api.calls[0][1]


def test_request_uses_25000_row_limit_by_default():
    service = _Service({0: {"rows": []}})

    _function("collect_with_service")(service, PROPERTY_URL, PERIOD_START, PERIOD_END)

    assert service.analytics_api.calls[0][1]["rowLimit"] == 25_000


def test_first_request_starts_at_zero():
    service = _Service({0: {"rows": []}})

    _function("collect_with_service")(service, PROPERTY_URL, PERIOD_START, PERIOD_END)

    assert service.analytics_api.calls[0][1]["startRow"] == 0


def test_pagination_increments_start_row_by_row_limit():
    service = _Service({
        0: {"rows": [_api_row(query="first"), _api_row(query="second")]},
        2: {"rows": [_api_row(query="third")]},
    })

    _function("collect_with_service")(service, PROPERTY_URL, PERIOD_START, PERIOD_END, row_limit=2)

    assert [body["startRow"] for _, body in service.analytics_api.calls] == [0, 2]


def test_pagination_stops_after_a_short_page():
    service = _Service({
        0: {"rows": [_api_row(query="first"), _api_row(query="second")]},
        2: {"rows": [_api_row(query="third")]},
    })

    result = _function("collect_with_service")(service, PROPERTY_URL, PERIOD_START, PERIOD_END, row_limit=2)

    assert result["pagination"]["stoppedBecause"] == "short_page"
    assert result["pagination"]["pagesFetched"] == 2
    assert result["pagination"]["finalStartRow"] == 2


def test_pagination_stops_when_zero_rows_are_returned():
    service = _Service({0: {"rows": []}})

    result = _function("collect_with_service")(service, PROPERTY_URL, PERIOD_START, PERIOD_END)

    assert result["pagination"]["stoppedBecause"] == "zero_rows"
    assert result["pagination"]["pagesFetched"] == 1
    assert [body["startRow"] for _, body in service.analytics_api.calls] == [0]


def test_repeated_response_page_stops_instead_of_looping():
    repeated = {"rows": [_api_row(query="same row")]}
    service = _Service(lambda body: repeated)

    with pytest.raises(ValueError, match="repeated"):
        _function("collect_with_service")(service, PROPERTY_URL, PERIOD_START, PERIOD_END, row_limit=1)

    assert [body["startRow"] for _, body in service.analytics_api.calls] == [0, 1]


def test_api_error_leaves_existing_output_unchanged(tmp_path):
    output = tmp_path / "gsc-sitewide-query.json"
    original = '{"last_good": true}\n'
    output.write_text(original, encoding="utf-8")
    service = _Service({
        0: {"rows": [_api_row(query="first")]},
        1: RuntimeError("temporary Search Console API failure"),
    })

    with pytest.raises(RuntimeError, match="temporary Search Console API failure"):
        _function("run_collection")(
            service, _snapshot(), output, generated_at=GENERATED_AT, row_limit=1,
        )

    assert output.read_text(encoding="utf-8") == original


def test_malformed_api_row_fails_validation():
    service = _Service({0: {"rows": [{"keys": ["https://emfls.github.io/"], "clicks": 1}]}})

    with pytest.raises(ValueError, match="row"):
        _function("collect_with_service")(service, PROPERTY_URL, PERIOD_START, PERIOD_END)


def test_malformed_api_response_fails_validation():
    service = _Service({0: {"rows": "not-a-row-list"}})

    with pytest.raises(ValueError, match="rows"):
        _function("collect_with_service")(service, PROPERTY_URL, PERIOD_START, PERIOD_END)


@pytest.mark.parametrize("field,value", [
    ("clicks", True), ("clicks", "1"), ("impressions", -1),
    ("ctr", float("nan")), ("ctr", 1.1), ("position", float("inf")),
])
def test_numeric_metrics_must_be_valid_and_are_not_coerced(field, value):
    row = {
        "page": "https://emfls.github.io/a",
        "query": "example query",
        "clicks": 1,
        "impressions": 2,
        "ctr": 0.5,
        "position": 3.5,
    }
    row[field] = value

    with pytest.raises(ValueError):
        _build([row])


def test_missing_query_is_not_converted_to_empty_or_zero_demand():
    row = {
        "page": "https://emfls.github.io/a",
        "clicks": 0,
        "impressions": 0,
        "ctr": 0.0,
        "position": 0.0,
    }

    with pytest.raises(ValueError, match="query"):
        _build([row])


def test_empty_api_rows_remain_empty_without_zero_demand_rows():
    payload = _build([])

    assert payload["rowCount"] == 0
    assert payload["rows"] == []


def test_metadata_marks_top_rows_as_partial_coverage():
    payload = _build([])

    assert payload["coverageStatus"] == "PARTIAL_TOP_ROWS"


def test_metadata_never_guarantees_completeness():
    payload = _build([])

    assert payload["completenessGuaranteed"] is False


def test_raw_page_url_is_preserved_exactly():
    page_url = "https://EMFLS.github.io/a?source=api#fragment"
    rows = [{"page": page_url, "query": " raw query ", "clicks": 1, "impressions": 2, "ctr": 0.5, "position": 3.5}]

    payload = _build(rows)

    assert payload["rows"][0]["page"] == page_url
    assert payload["rows"][0]["query"] == " raw query "


def test_safety_ceiling_is_deterministic_and_recorded_in_metadata():
    service = _Service(lambda body: {"rows": [_api_row(query=f"row-{body['startRow']}")]})

    result = _function("collect_with_service")(
        service, PROPERTY_URL, PERIOD_START, PERIOD_END, row_limit=1, max_pages=2,
    )

    assert result["pagination"]["stoppedBecause"] == "safety_ceiling"
    assert result["pagination"]["pagesFetched"] == 2
    assert result["pagination"]["maxPages"] == 2


def test_snapshot_validator_checks_metadata_and_rows():
    rows = [{"page": "https://emfls.github.io/a", "query": "example", "clicks": 1, "impressions": 2, "ctr": 0.5, "position": 3.5}]
    payload = _build(rows)

    summary = _function("validate_snapshot")(payload)

    assert summary["rowCount"] == 1
    assert summary["period"] == {"start": PERIOD_START, "end": PERIOD_END}


def test_overlapping_page_query_rows_across_pages_fail_safely():
    service = _Service({
        0: {"rows": [_api_row(query="first"), _api_row(query="overlap")]},
        2: {"rows": [_api_row(query="overlap"), _api_row(query="last")]},
    })

    with pytest.raises(ValueError, match="repeated"):
        _function("collect_with_service")(service, PROPERTY_URL, PERIOD_START, PERIOD_END, row_limit=2)


def test_malformed_nested_period_metadata_fails_with_value_error():
    snapshot = _snapshot()
    snapshot["periods"] = []

    with pytest.raises(ValueError, match="period"):
        _function("get_snapshot_period")(snapshot)


def test_artifact_validator_rejects_non_integer_row_count():
    payload = _build([{
        "page": "https://emfls.github.io/a",
        "query": "example",
        "clicks": 1,
        "impressions": 2,
        "ctr": 0.5,
        "position": 3.5,
    }])
    payload["rowCount"] = 1.0

    with pytest.raises(ValueError, match="row count"):
        _function("validate_snapshot")(payload)


def test_artifact_validator_rejects_malformed_pagination_reason():
    payload = _build([])
    payload["pagination"]["stoppedBecause"] = []

    with pytest.raises(ValueError, match="stoppedBecause"):
        _function("validate_snapshot")(payload)


def test_artifact_validator_rejects_boolean_schema_version():
    payload = _build([])
    payload["schemaVersion"] = True

    with pytest.raises(ValueError, match="schema"):
        _function("validate_snapshot")(payload)
