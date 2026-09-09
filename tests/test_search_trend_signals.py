import json
import sqlite3

from scripts.search_trend_signals import (
    collect_naver_datalab,
    load_trendradar_sqlite,
    run_search_trend_pipeline,
    trend_window,
)


def make_trendradar_db(path):
    connection = sqlite3.connect(path)
    connection.executescript(
        """
        CREATE TABLE news_items (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            platform_id TEXT NOT NULL,
            rank INTEGER NOT NULL,
            url TEXT DEFAULT '',
            mobile_url TEXT DEFAULT '',
            first_crawl_time TEXT NOT NULL,
            last_crawl_time TEXT NOT NULL,
            crawl_count INTEGER DEFAULT 1
        );
        """
    )
    connection.executemany(
        "INSERT INTO news_items VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)",
        [
            (1, "팰월드 1.0 낚시 난이도 조정", "steam", 2, "https://example.com/a", "08-00", "12-00", 4),
            (2, "다른 게임 업데이트", "news", 1, "https://example.com/b", "09-00", "09-00", 1),
            (3, "팰월드 신규 미션 공략", "naver", 7, "https://example.com/c", "10-00", "14-00", 5),
        ],
    )
    connection.commit()
    connection.close()


def test_trendradar_adapter_filters_keywords_and_preserves_observed_signal(tmp_path):
    database = tmp_path / "trendradar.db"
    make_trendradar_db(database)

    result = load_trendradar_sqlite(database, keywords=["팰월드"])

    assert result["status"] == "OBSERVED_SEARCH_SIGNAL"
    assert [row["title"] for row in result["signals"]] == [
        "팰월드 1.0 낚시 난이도 조정",
        "팰월드 신규 미션 공략",
    ]
    assert result["signals"][0]["rank"] == 2
    assert result["signals"][0]["occurrences"] == 4
    assert "searchVolume" not in result["signals"][0]


def test_missing_trendradar_database_does_not_invent_signals(tmp_path):
    result = load_trendradar_sqlite(tmp_path / "missing.db", keywords=["팰월드"])

    assert result == {
        "source": "TREND_RADAR",
        "status": "INSUFFICIENT_DATA",
        "signals": [],
        "warning": "TrendRadar database is missing.",
    }


def test_naver_without_credentials_is_not_connected_and_makes_no_request():
    called = False

    def transport(*args, **kwargs):
        nonlocal called
        called = True
        raise AssertionError("transport must not run without credentials")

    result = collect_naver_datalab(
        [{"groupName": "팰월드", "keywords": ["팰월드", "팔월드"]}],
        "2026-08-10",
        "2026-09-08",
        client_id="",
        client_secret="",
        transport=transport,
    )

    assert result["status"] == "NOT_CONNECTED"
    assert result["signals"] == []
    assert called is False


def test_naver_records_relative_interest_without_claiming_search_volume():
    response = {
        "startDate": "2026-08-10",
        "endDate": "2026-09-08",
        "timeUnit": "date",
        "results": [
            {
                "title": "팰월드",
                "keywords": ["팰월드", "팔월드"],
                "data": [
                    {"period": "2026-09-07", "ratio": 45.2},
                    {"period": "2026-09-08", "ratio": 100},
                ],
            }
        ],
    }

    result = collect_naver_datalab(
        [{"groupName": "팰월드", "keywords": ["팰월드", "팔월드"]}],
        "2026-08-10",
        "2026-09-08",
        client_id="id",
        client_secret="secret",
        transport=lambda request: json.dumps(response).encode("utf-8"),
    )

    assert result["status"] == "VERIFIED_SEARCH_DATA"
    assert result["signals"][0]["latestRelativeInterest"] == 100.0
    assert result["signals"][0]["peakRelativeInterest"] == 100.0
    assert result["signals"][0]["trendChangePercent"] == 121.24
    assert "searchVolume" not in result["signals"][0]


def test_trend_window_uses_run_date_instead_of_stale_fixed_dates():
    assert trend_window("2026-09-09T09:00:00+09:00", 30) == (
        "2026-08-11",
        "2026-09-09",
    )


def test_pipeline_writes_machine_data_and_human_report(tmp_path):
    database = tmp_path / "trendradar.db"
    make_trendradar_db(database)
    config = tmp_path / "keywords.json"
    config.write_text(
        json.dumps(
            {
                "trendRadarKeywords": ["팰월드"],
                "naverKeywordGroups": [
                    {"groupName": "팰월드", "keywords": ["팰월드"]}
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    payload = run_search_trend_pipeline(
        tmp_path,
        run_at="2026-09-09T09:00:00+09:00",
        config_path=config,
        trendradar_db=database,
        client_id="",
        client_secret="",
    )

    assert payload["summary"] == {
        "trendRadarSignals": 2,
        "naverTrendGroups": 0,
        "googleTrendsStatus": "NOT_CONNECTED",
    }
    saved = json.loads((tmp_path / "data/search-trend-signals.json").read_text())
    assert saved["sources"]["naver"]["status"] == "NOT_CONNECTED"
    report = (tmp_path / "reports/search-trend-signals.md").read_text(encoding="utf-8")
    assert "TrendRadar signals: 2" in report
    assert "Naver DataLab: NOT_CONNECTED" in report
