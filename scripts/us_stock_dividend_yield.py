#!/usr/bin/env python3
"""Normalize and validate US-stock dividend yields expressed in percent points.

yfinance's ``dividendYield`` / ``trailingAnnualDividendYield`` values used by
this site are already percentage points (for example, ``0.36`` means 0.36%).
The retired legacy generator multiplied those values by 100 once more.  This
module provides the shared boundary rule and repairs those rendered pages.
"""

import argparse
import json
import math
import re
from pathlib import Path


MAX_PLAUSIBLE_DIVIDEND_YIELD_PERCENT = 20.0


class DividendYieldError(ValueError):
    """Raised when a yield cannot be displayed safely."""


def normalize_yfinance_percent(raw_value):
    """Return percentage points without applying an additional ×100."""
    if raw_value is None or raw_value == "N/A":
        return None
    try:
        value = float(raw_value)
    except (TypeError, ValueError) as exc:
        raise DividendYieldError("dividend yield is not numeric") from exc
    if not math.isfinite(value) or not 0 <= value <= MAX_PLAUSIBLE_DIVIDEND_YIELD_PERCENT:
        raise DividendYieldError(f"dividend yield outside 0..{MAX_PLAUSIBLE_DIVIDEND_YIELD_PERCENT}%")
    return round(value, 4)


_YIELD_KPI_RE = re.compile(
    r'(<div class="kpi")(?P<unit> data-dividend-yield-unit="percent")?'
    r'(><div class="k-label">배당수익률</div><div class="k-val">)'
    r'(?P<value>[^<]+)(</div>)'
)


def repair_legacy_html(html):
    """Repair one legacy KPI and mark it so repeated runs are idempotent."""
    match = _YIELD_KPI_RE.search(html)
    if not match:
        raise DividendYieldError("dividend yield KPI not found")

    displayed = match.group("value").strip()
    result = None
    if displayed != "N/A":
        try:
            numeric = float(displayed.removesuffix("%"))
            candidate = numeric if match.group("unit") else numeric / 100
            result = normalize_yfinance_percent(candidate)
        except (ValueError, DividendYieldError):
            result = None

    rendered = "N/A" if result is None else f"{result:.2f}%"
    replacement = (
        match.group(1)
        + ' data-dividend-yield-unit="percent"'
        + match.group(3)
        + rendered
        + match.group(5)
    )
    return html[: match.start()] + replacement + html[match.end() :], result


def validate_stockwiki_record(record):
    """Validate the already-normalized percent value in a StockWiki record."""
    try:
        raw_value = record["dividends"]["yield"]
    except (KeyError, TypeError) as exc:
        raise DividendYieldError("stock record is missing dividends.yield") from exc
    return normalize_yfinance_percent(raw_value)


def repair_directory(directory, write=False):
    results = []
    for page in sorted(directory.glob("*.html")):
        html = page.read_text(encoding="utf-8")
        try:
            repaired, value = repair_legacy_html(html)
        except DividendYieldError:
            continue
        if write and repaired != html:
            page.write_text(repaired, encoding="utf-8")
        results.append({"ticker": page.stem.upper(), "yieldPercent": value})
    return results


def validate_stockwiki_directory(directory):
    results = []
    for path in sorted(directory.glob("*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        if record.get("market") != "US":
            continue
        value = validate_stockwiki_record(record)
        results.append({"ticker": record.get("ticker", path.stem), "yieldPercent": value})
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--fix-legacy", action="store_true")
    args = parser.parse_args()

    legacy = repair_directory(args.root / "kor/report/stock/us", write=args.fix_legacy)
    stockwiki = validate_stockwiki_directory(args.root / "kor/stockwiki/data/stocks")
    print(json.dumps({"legacyPages": legacy, "stockwikiRecords": stockwiki}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
