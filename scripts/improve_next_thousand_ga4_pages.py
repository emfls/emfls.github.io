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
    parser.add_argument("--batch", type=int, choices=range(1, 11), required=True)
    args = parser.parse_args()
    pages = importlib.import_module(f"tests.long_tail_ga4_{args.batch:02d}_manifest").PAGES
    marker = f"ga4-long-tail-{args.batch:02d}-priority-2026-08-11"
    changed, skipped = apply_pages(ROOT, pages, marker)
    print(f"batch={args.batch:02d} changed={changed} skipped={skipped}")


if __name__ == "__main__":
    main()
