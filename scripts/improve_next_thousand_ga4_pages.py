#!/usr/bin/env python3
"""Apply one approved 100-page slice from the next-thousand GA4 batch."""

from __future__ import annotations

import argparse
import importlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.improve_two_hundred_ga4_pages_common import apply_pages


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, choices=range(1, 29), required=True)
    parser.add_argument("--series", choices=("first", "second", "final"), default="first")
    args = parser.parse_args()
    if args.series != "final" and args.batch > 10:
        parser.error("first and second series only support batches 1-10")
    marker_number = args.batch if args.series == "first" else args.batch + 10
    module = (
        f"tests.final_ga4_inventory_{args.batch:02d}_manifest"
        if args.series == "final"
        else f"tests.{'long_tail' if args.series == 'first' else 'second_long_tail'}_ga4_{args.batch:02d}_manifest"
    )
    pages = importlib.import_module(module).PAGES
    marker = (
        f"ga4-final-{args.batch:02d}-priority-2026-08-11"
        if args.series == "final"
        else f"ga4-long-tail-{marker_number:02d}-priority-2026-08-11"
    )
    expected_len = 39 if args.series == "final" and args.batch == 28 else 100
    changed, skipped = apply_pages(ROOT, pages, marker, expected_len)
    print(f"series={args.series} batch={args.batch:02d} changed={changed} skipped={skipped}")


if __name__ == "__main__":
    main()
