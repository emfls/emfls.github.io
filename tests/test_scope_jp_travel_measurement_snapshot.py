import pytest

from scripts.scope_jp_travel_measurement_snapshot import scope_snapshot


def test_scope_ga4_snapshot_preserves_source_window_and_only_jp_travel_pages():
    snapshot = {
        "as_of": "2026-10-05",
        "periods": {"ga4": {"start": "2026-07-08", "end": "2026-10-04"}},
        "collection": {"source": "GOOGLE_ANALYTICS_DATA_API", "propertyId": "123"},
        "site": {"ga4": {"status": "VERIFIED"}},
        "pages": [
            {"url": "/jp/report/travel/france-paris.html", "ga4": {"views": 12}},
            {"url": "/jp/report/travelogue/not-a-travel-page.html", "ga4": {"views": 99}},
            {"url": "/us/report/travel/example.html", "ga4": {"views": 33}},
        ],
    }

    result = scope_snapshot(snapshot, "ga4")

    assert result["period"] == {"start": "2026-07-08", "end": "2026-10-04"}
    assert result["source"] == "GOOGLE_ANALYTICS_DATA_API"
    assert result["scope"]["property"] == "123"
    assert [row["url"] for row in result["pages"]] == ["/jp/report/travel/france-paris.html"]
    assert result["pages"][0]["ga4"]["views"] == 12


def test_scope_gsc_snapshot_accepts_absolute_page_urls_and_keeps_period():
    snapshot = {
        "status": "VERIFIED",
        "source": "GOOGLE_SEARCH_CONSOLE_API",
        "property": "https://emfls.github.io/",
        "periods": {"gsc": {"start": "2026-07-08", "end": "2026-10-04"}},
        "pages": [
            {"url": "https://emfls.github.io/jp/report/travel/france-lyon.html?x=1", "google": {"clicks": 2}},
            {"url": "https://other.example/jp/report/travel/france.html", "google": {"clicks": 8}},
        ],
    }

    result = scope_snapshot(snapshot, "gsc")

    assert result["period"] == {"start": "2026-07-08", "end": "2026-10-04"}
    assert result["source"] == "GOOGLE_SEARCH_CONSOLE_API"
    assert result["scope"]["property"] == "https://emfls.github.io/"
    assert [row["url"] for row in result["pages"]] == [
        "https://emfls.github.io/jp/report/travel/france-lyon.html?x=1"
    ]


def test_scope_allows_zero_jp_rows_without_fabricating_empty_page_metrics():
    snapshot = {
        "as_of": "2026-10-05",
        "periods": {"ga4": {"start": "2026-08-10", "end": "2026-10-04"}},
        "collection": {"source": "GOOGLE_ANALYTICS_DATA_API", "propertyId": "123"},
        "site": {"ga4": {"status": "VERIFIED"}},
        "pages": [{"url": "/us/report/travel/example.html", "ga4": {"views": 33}}],
    }

    result = scope_snapshot(snapshot, "ga4")

    assert result["pages"] == []
    assert result["scope"]["sourceRowCount"] == 1
    assert result["scope"]["scopedRowCount"] == 0
    assert "site" not in result


@pytest.mark.parametrize("source_kind", ["ga4", "gsc"])
def test_scope_rejects_unverified_source(source_kind):
    snapshot = {
        "status": "ERROR",
        "source": "UNKNOWN",
        "periods": {source_kind: {"start": "2026-08-10", "end": "2026-10-04"}},
        "collection": {"source": "UNKNOWN", "propertyId": "123"},
        "pages": [],
    }

    with pytest.raises(ValueError, match="verified"):
        scope_snapshot(snapshot, source_kind)
