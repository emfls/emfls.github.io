#!/usr/bin/env python3
"""Add one policy-safe visa-guide link to every Korean Slovakia city page."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = sorted((ROOT / "kor/report/travel").glob("slovakia-*.html"))
TARGET = 'href="/kor/report/visa/slovakia.html"'
ASIDE = (
    '\n<aside class="slovakia-entry-guide" style="max-width:860px;margin:24px auto;'
    'padding:18px 20px;border:1px solid #dbe3ee;border-radius:12px;background:#f8fafc;line-height:1.7">'
    '<strong>출발 전 입국 조건 확인:</strong> <a href="/kor/report/visa/slovakia.html">'
    '슬로바키아 비자·솅겐 체류일 안내</a>에서 한국 여권의 단기 방문 기준과 솅겐 180일 중 90일 계산 방법을 확인하세요.'
    '</aside>\n'
)


def improve(html: str) -> str:
    updated = html
    if TARGET not in updated:
        updated = updated.replace("</body>", ASIDE + "</body>", 1)
    if updated.count(TARGET) != 1 or "슬로바키아 비자·솅겐 체류일 안내" not in updated:
        raise ValueError("Korean Slovakia cluster contract not satisfied")
    return updated


def main() -> None:
    if len(PAGES) != 26:
        raise SystemExit(f"expected 26 city pages, found {len(PAGES)}")
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
