#!/usr/bin/env python3
"""Validate required SEO, analytics, provenance, and freshness markers."""

from __future__ import annotations

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from typing import List, Optional, Tuple


GA4_ID = "G-QP5Q67GE5B"
ADSENSE_ID = "ca-pub-8830524482034754"
DATE_PATTERN = re.compile(r"최근\s*확인\s*[:：]?\s*20\d{2}-\d{2}-\d{2}")


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.has_canonical = False
        self.has_main = False
        self.has_h1 = False
        self.json_ld: List[str] = []
        self.links: List[Tuple[str, str]] = []
        self._json_buffer: Optional[List[str]] = None
        self._anchor_href: Optional[str] = None
        self._anchor_text: Optional[List[str]] = None

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        values = dict(attrs)
        if tag == "link" and values.get("rel") == "canonical" and values.get("href"):
            self.has_canonical = True
        elif tag == "main":
            self.has_main = True
        elif tag == "h1":
            self.has_h1 = True
        elif tag == "script" and values.get("type") == "application/ld+json":
            self._json_buffer = []
        elif tag == "a":
            self._anchor_href = values.get("href")
            self._anchor_text = []

    def handle_data(self, data: str) -> None:
        if self._json_buffer is not None:
            self._json_buffer.append(data)
        if self._anchor_text is not None:
            self._anchor_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._json_buffer is not None:
            self.json_ld.append("".join(self._json_buffer))
            self._json_buffer = None
        elif tag == "a" and self._anchor_text is not None:
            self.links.append((self._anchor_href or "", "".join(self._anchor_text).strip()))
            self._anchor_href = None
            self._anchor_text = None


def has_date_modified(documents: List[str]) -> bool:
    for document in documents:
        try:
            value = json.loads(document)
        except json.JSONDecodeError:
            continue
        values = value if isinstance(value, list) else [value]
        if any(isinstance(item, dict) and item.get("dateModified") for item in values):
            return True
    return False


def validate_page(path: Path) -> List[str]:
    """Return stable human-readable errors for one static HTML page."""
    text = path.read_text(encoding="utf-8")
    parser = PageParser()
    parser.feed(text)
    errors: List[str] = []

    if not parser.has_canonical:
        errors.append("missing canonical")
    if GA4_ID not in text:
        errors.append("missing GA4 measurement ID")
    if ADSENSE_ID not in text:
        errors.append("missing AdSense publisher ID")
    if not parser.has_main:
        errors.append("missing main element")
    if not parser.has_h1:
        errors.append("missing h1 element")
    if not has_date_modified(parser.json_ld):
        errors.append("missing JSON-LD dateModified")
    has_labeled_official_link = any(
        href.startswith("https://") and "공식" in label for href, label in parser.links
    )
    has_official_source_section = "공식 확인처" in text and any(
        href.startswith("https://") for href, _ in parser.links
    )
    if not (has_labeled_official_link or has_official_source_section):
        errors.append("missing HTTPS official source")
    if not DATE_PATTERN.search(text):
        errors.append("missing recent verification date")
    return errors


def main() -> int:
    argument_parser = argparse.ArgumentParser(description=__doc__)
    argument_parser.add_argument("paths", nargs="+", type=Path)
    arguments = argument_parser.parse_args()
    failed = False
    for path in arguments.paths:
        errors = validate_page(path)
        if errors:
            failed = True
            for error in errors:
                print(f"FAIL {path}: {error}")
        else:
            print(f"PASS {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
