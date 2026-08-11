#!/usr/bin/env python3
"""Apply the approved third 100-page GA4 quality batch."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import scripts.improve_next_hundred_ga4_pages as base
from tests.third_hundred_ga4_manifest import PAGES

MARKER = "third-hundred-ga4-priority-2026-08-11"
_default_copy = base.trust_copy


def trust_copy(relative: str, category: str) -> tuple[str, str, str]:
    risk_tokens = ("israel-", "ukraine", "iraq-", "venezuela-", "belarus-")
    if category in {"travel", "visa"} and any(token in relative for token in risk_tokens):
        return (
            "분쟁·출입 제한과 정부 여행경보를 당일 확인하세요",
            "2026년 8월 11일에 재검토했습니다. 이 페이지는 입국 허가나 안전을 보장하지 않습니다. 무력 충돌, 국경·검문 통제, 항공편, 통신과 영사 지원이 급변할 수 있으므로 대한민국 외교부 등 관할 정부의 최신 여행금지·여행경보와 현지 출입 규정을 당일 확인하세요.",
            "국가별 비자 정보" if category == "visa" else "다른 여행지 정보",
        )
    return _default_copy(relative, category)


def main() -> None:
    if len(PAGES) != 100 or len({row[0] for row in PAGES}) != 100:
        raise SystemExit("manifest must contain exactly 100 unique pages")
    sources: dict[str, str] = {}
    for relative, _, _, _ in PAGES:
        path = ROOT / relative
        if not path.is_file():
            raise SystemExit(f"missing page: {relative}")
        source = path.read_text(encoding="utf-8")
        if "</body>" not in source.lower():
            raise SystemExit(f"missing body close: {relative}")
        if "G-QP5Q67GE5B" not in source or "ca-pub-8830524482034754" not in source:
            raise SystemExit(f"missing measurement tag: {relative}")
        sources[relative] = source

    base.MARKER = MARKER
    base.trust_copy = trust_copy
    changed = skipped = 0
    for relative, schema_type, category, hub in PAGES:
        source = sources[relative]
        if MARKER in source:
            skipped += 1
            continue
        position = source.lower().rfind("</body>")
        (ROOT / relative).write_text(
            source[:position] + base.make_block(relative, schema_type, category, hub) + source[position:],
            encoding="utf-8",
        )
        changed += 1
    print(f"changed={changed} skipped={skipped}")


if __name__ == "__main__":
    main()
