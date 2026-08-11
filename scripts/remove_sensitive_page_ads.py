#!/usr/bin/env python3
"""Remove AdSense fragments from approved sensitive HTML pages."""

from __future__ import annotations

import argparse
from pathlib import Path
import re


POLICY_PATHS = {
    Path("kor/privacy-policy.html"),
    Path("kor/terms.html"),
    Path("kor/contact.html"),
}
DISABLED_MARKER = "<!-- AdSense disabled on this interactive or sensitive page: ca-pub-8830524482034754 -->"
SAFE_IFRAME_STYLE = '<style>div[id^="aswift_"]{max-width:100%!important;overflow:hidden}</style>'

ADSENSE_LOADER = re.compile(
    r"\s*<script\b[^>]*\bsrc=[\"'][^\"']*pagead2\.googlesyndication\.com/pagead/js(?:/adsbygoogle\.js)?[^\"']*[\"'][^>]*>\s*</script>\s*",
    re.IGNORECASE,
)
ADSENSE_UNIT = re.compile(
    r"\s*<ins\b[^>]*\bclass=[\"'][^\"']*\badsbygoogle\b[^\"']*[\"'][^>]*>.*?</ins>\s*",
    re.IGNORECASE | re.DOTALL,
)
ADSENSE_PUSH_SCRIPT = re.compile(
    r"\s*<script\b[^>]*>\s*(?:try\s*\{\s*)?\(?\s*adsbygoogle\s*=\s*window\.adsbygoogle\s*\|\|\s*\[\]\s*\)?\.push\s*\(\s*\{\s*\}\s*\)\s*;?\s*(?:\}\s*catch\s*\([^)]*\)\s*\{\s*\}\s*)?</script>\s*",
    re.IGNORECASE,
)
ADSENSE_STYLE = re.compile(
    r"\s*<style>\s*(?:ins)?\.adsbygoogle\s*\{[^{}]*\}\s*</style>\s*",
    re.IGNORECASE,
)
ADSENSE_SELECTOR_TOKEN = re.compile(
    r"(?:ins)?\.adsbygoogle\s*,?\s*",
    re.IGNORECASE,
)
EMPTY_AD_WRAPPER = re.compile(
    r"\s*<(div|section)\b([^>]*\bclass=[\"'][^\"']*\b(?:ad-wrap|ad-container|ads?)\b[^\"']*[\"'][^>]*)>\s*</\1>\s*",
    re.IGNORECASE,
)


def is_sensitive_path(path: Path) -> bool:
    normalized = Path(*path.parts)
    return "game" in normalized.parts or normalized in POLICY_PATHS


def remove_adsense(html: str) -> str:
    result = ADSENSE_LOADER.sub("\n", html)
    result = ADSENSE_UNIT.sub("\n", result)
    result = ADSENSE_PUSH_SCRIPT.sub("\n", result)
    result = ADSENSE_STYLE.sub("\n", result)
    result = ADSENSE_SELECTOR_TOKEN.sub("", result)
    result = EMPTY_AD_WRAPPER.sub("\n", result)
    return result


def ensure_disabled_marker(html: str) -> str:
    additions = []
    if DISABLED_MARKER not in html:
        additions.append(DISABLED_MARKER)
    if SAFE_IFRAME_STYLE not in html and 'div[id^="aswift_"]{max-width:100%' not in html:
        additions.append(SAFE_IFRAME_STYLE)
    if not additions:
        return html
    insertion = "\n".join(additions) + "\n"
    closing_head = re.search(r"</head>", html, re.IGNORECASE)
    if closing_head:
        return html[: closing_head.start()] + insertion + html[closing_head.start() :]
    return insertion + html


def transform_tree(root: Path, write: bool = False) -> tuple[int, int]:
    selected = changed = 0
    for path in sorted(root.rglob("*.html")):
        relative = path.relative_to(root)
        if not is_sensitive_path(relative):
            continue
        selected += 1
        before = path.read_text(encoding="utf-8")
        after = ensure_disabled_marker(remove_adsense(before))
        if after == before:
            continue
        changed += 1
        if write:
            path.write_text(after, encoding="utf-8")
    return selected, changed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    selected, changed = transform_tree(args.root.resolve(), args.write)
    mode = "written" if args.write else "would_change"
    print(f"selected={selected} {mode}={changed}")


if __name__ == "__main__":
    main()
