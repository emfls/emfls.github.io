#!/usr/bin/env python3
"""Apply the approved fifth GA4 hundred-page batch."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.improve_two_hundred_ga4_pages_common import apply_pages
from tests.fifth_hundred_ga4_manifest import PAGES


if __name__ == "__main__":
    changed, skipped = apply_pages(ROOT, PAGES, "fifth-hundred-ga4-priority-2026-08-11")
    print(f"changed={changed} skipped={skipped}")
