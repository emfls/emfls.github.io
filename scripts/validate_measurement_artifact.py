#!/usr/bin/env python3
"""Validate the generated URL-performance artifact before it is consumed."""

import argparse
import json
from datetime import date
from pathlib import Path


REQUIRED_KEYS = {"schemaVersion", "asOf", "summary", "pages"}
GA4_MAX_AGE_DAYS = 7


def _validate_ga4_freshness(page, as_of):
    ga4 = page.get("ga4") or {}
    period = ga4.get("period") or {}
    end = period.get("end")
    if not end or ga4.get("status") == "NOT_CONNECTED":
        return
    try:
        age = (date.fromisoformat(as_of) - date.fromisoformat(end)).days
    except (TypeError, ValueError) as exc:
        raise ValueError(f"invalid GA4 period for {page.get('url')}: {end!r}") from exc
    if age > GA4_MAX_AGE_DAYS and ga4.get("status") == "VERIFIED":
        raise ValueError(
            f"GA4 freshness contract violated for {page.get('url')}: "
            f"period ended {end}, asOf {as_of}, age {age}d; use STALE_DATA"
        )


def validate(path: Path, *, minimum_pages: int = 1):
    payload = json.loads(path.read_text(encoding="utf-8"))
    missing = REQUIRED_KEYS - set(payload)
    if missing:
        raise ValueError(f"missing keys: {', '.join(sorted(missing))}")
    pages = payload.get("pages")
    if not isinstance(pages, list) or len(pages) < minimum_pages:
        raise ValueError(f"expected at least {minimum_pages} generated pages, got {len(pages) if isinstance(pages, list) else 'non-list'}")
    if not payload.get("asOf"):
        raise ValueError("asOf is empty")
    if payload.get("summary", {}).get("evaluatedIndexablePages") != len(pages):
        raise ValueError("summary page count does not match pages")
    for page in pages:
        _validate_ga4_freshness(page, payload["asOf"])
    return {"pages": len(pages), "asOf": payload["asOf"]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    print(json.dumps(validate(args.path), ensure_ascii=False))


if __name__ == "__main__":
    main()
