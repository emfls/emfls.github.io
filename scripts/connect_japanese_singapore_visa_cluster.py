#!/usr/bin/env python3
"""Correct Japanese Singapore page language and add one visa-guide link."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = [
    page
    for page in sorted((ROOT / "jp/report/travel").glob("singapore-*.html"))
    if page.name != "singapore-visa.html"
]
LINK = 'href="/jp/report/travel/singapore-visa.html"'
ASIDE = (
    '\n<aside class="singapore-entry-guide" style="max-width:900px;margin:24px auto;'
    'padding:16px 18px;background:#fff8e6;border:1px solid #e8c36a;border-radius:10px">'
    '<strong>渡航前に確認：</strong> <a href="/jp/report/travel/singapore-visa.html">'
    'シンガポールのビザ種類・SG Arrival Card・就労パス</a></aside>\n'
)


def improve(html: str) -> str:
    updated = html.replace('<html lang="ko">', '<html lang="ja">', 1)
    if LINK not in updated:
        updated = updated.replace("</body>", ASIDE + "</body>", 1)
    if '<html lang="ja">' not in updated or updated.count(LINK) != 1:
        raise ValueError("Japanese Singapore cluster contract not satisfied")
    return updated


def main() -> None:
    if len(PAGES) != 25:
        raise SystemExit(f"expected 25 city pages, found {len(PAGES)}")
    changed = 0
    for page in PAGES:
        original = page.read_text(encoding="utf-8")
        updated = improve(original)
        if updated != original:
            page.write_text(updated, encoding="utf-8")
            changed += 1
    print(f"changed={changed} pages={len(PAGES)}")


if __name__ == "__main__":
    main()
