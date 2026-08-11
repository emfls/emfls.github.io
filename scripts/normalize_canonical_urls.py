#!/usr/bin/env python3
"""Normalize self-canonical links across the static site."""

from pathlib import Path
import re
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://emfls.github.io"
EXCLUDED = {
    "404.html",
    "google3cba66fc0d0e3d2e.html",
    "naverea2d4af329724872f8cfdad857e3540e.html",
    "kor/stockwiki/test/index.html",
}
LINK_TAG = re.compile(r"<link\b[^>]*>", re.IGNORECASE)
REL_CANONICAL = re.compile(
    r"\brel\s*=\s*([\"'])[^\"']*\bcanonical\b[^\"']*\1", re.IGNORECASE
)
HREF = re.compile(r"(\bhref\s*=\s*)([\"'])([^\"']*)(\2)", re.IGNORECASE)


def public_url(relative_path: str) -> str:
    relative_path = unicodedata.normalize("NFC", relative_path)
    if relative_path == "index.html":
        return f"{BASE_URL}/"
    if relative_path.endswith("/index.html"):
        return f"{BASE_URL}/{relative_path[:-10]}"
    return f"{BASE_URL}/{relative_path}"


def normalize_page(page: Path) -> bool:
    relative_path = unicodedata.normalize("NFC", page.relative_to(ROOT).as_posix())
    if relative_path in EXCLUDED:
        return False

    source = page.read_text(encoding="utf-8")
    expected_url = public_url(relative_path)
    canonical_tag = f'<link href="{expected_url}" rel="canonical"/>'
    seen = False

    def replace_link(match: re.Match) -> str:
        nonlocal seen
        tag = match.group(0)
        if not REL_CANONICAL.search(tag):
            return tag
        if seen:
            return ""
        seen = True
        if not HREF.search(tag):
            raise ValueError(f"canonical missing href: {relative_path}")
        return HREF.sub(lambda href: f"{href.group(1)}{href.group(2)}{expected_url}{href.group(4)}", tag, count=1)

    updated = LINK_TAG.sub(replace_link, source)
    if not seen:
        head_end = re.search(r"</head\s*>", updated, re.IGNORECASE)
        if not head_end:
            raise ValueError(f"missing </head>: {relative_path}")
        updated = updated[: head_end.start()] + canonical_tag + updated[head_end.start() :]

    if updated == source:
        return False
    page.write_text(updated, encoding="utf-8")
    return True


def main() -> None:
    changed = [page for page in sorted(ROOT.rglob("*.html")) if normalize_page(page)]
    print(f"changed={len(changed)}")


if __name__ == "__main__":
    main()
