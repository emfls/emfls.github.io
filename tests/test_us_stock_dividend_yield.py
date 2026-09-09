import json
from pathlib import Path

import pytest

from scripts.us_stock_dividend_yield import (
    DividendYieldError,
    normalize_yfinance_percent,
    repair_legacy_html,
    validate_stockwiki_record,
)


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [(0.36, 0.36), (2.61, 2.61), (0, 0.0), (None, None), ("N/A", None)],
)
def test_yfinance_percentage_points_are_not_multiplied_again(raw, expected):
    assert normalize_yfinance_percent(raw) == expected


@pytest.mark.parametrize("raw", [-0.1, 20.01, 36, float("inf"), "broken"])
def test_invalid_yfinance_yield_is_rejected_instead_of_displayed(raw):
    with pytest.raises(DividendYieldError):
        normalize_yfinance_percent(raw)


def test_legacy_double_scaled_html_is_repaired_and_validated():
    html = '<div class="kpi"><div class="k-label">배당수익률</div><div class="k-val">261.00%</div></div>'
    repaired, result = repair_legacy_html(html)
    assert result == 2.61
    assert '<div class="k-val">2.61%</div>' in repaired
    assert 'data-dividend-yield-unit="percent"' in repaired
    assert repair_legacy_html(repaired) == (repaired, 2.61)


def test_legacy_outlier_becomes_na_instead_of_remaining_visible():
    html = '<div class="kpi"><div class="k-label">배당수익률</div><div class="k-val">2500.00%</div></div>'
    repaired, result = repair_legacy_html(html)
    assert result is None
    assert '<div class="k-val">N/A</div>' in repaired


@pytest.mark.parametrize(
    ("ticker", "expected"),
    [("AAPL", "0.36%"), ("KO", "2.61%"), ("JNJ", "2.34%"), ("NVDA", "0.02%"), ("TSLA", "N/A"), ("AMZN", "N/A")],
)
def test_published_us_stock_samples_have_normalized_yields(ticker, expected):
    html = (ROOT / "kor" / "report" / "stock" / "us" / f"{ticker.lower()}.html").read_text(encoding="utf-8")
    marker = '<div class="k-label">배당수익률</div><div class="k-val">'
    assert marker + expected + "</div>" in html


@pytest.mark.parametrize("ticker", ["AAPL", "MSFT", "NVDA", "TSLA"])
def test_stockwiki_samples_pass_common_yield_validation(ticker):
    path = ROOT / "kor" / "stockwiki" / "data" / "stocks" / f"{ticker}.json"
    record = json.loads(path.read_text(encoding="utf-8"))
    assert validate_stockwiki_record(record) == record["dividends"]["yield"]
