#!/usr/bin/env python3
"""Apply the next approved 50-page GA4 quality batch once."""

from __future__ import annotations

import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tests.next_fifty_ga4_manifest import PAGES  # noqa: E402

MARKER = "next-ga4-priority-2026-08-11"


def public_url(relative: str) -> str:
    return "https://emfls.github.io/" + relative.removesuffix("index.html")


def trust_copy(relative: str, category: str) -> tuple[str, str, str]:
    copy = {
        "tool": (
            "Scope and limitations",
            "Reviewed on August 11, 2026. This browser tool uses pseudorandom output and can behave differently by device or browser. Verify results independently before using them for an important decision.",
            "Related tools",
        ),
        "camp": (
            "출발 전 현장 규정을 확인하세요",
            "2026년 8월 11일에 재검토했습니다. 소개 장소가 무료 또는 합법 야영을 보장하지 않습니다. 텐트·차박·취사 전에 현장 표지와 토지 관리자·지자체 규정을 확인하고 기상특보, 산불 위험, 하천 수위와 대피 경로를 다시 점검하세요.",
            "다른 지역 캠핑 정보",
        ),
        "visa": (
            "입국 조건은 출발 직전에 재확인하세요",
            "2026년 8월 11일에 재검토했습니다. 이 글은 입국이나 체류 승인을 보장하지 않으며 국적, 여권, 방문 목적과 경유지에 따라 조건이 달라질 수 있습니다. 대사관·이민국·외교부와 이용 항공사의 최신 공식 안내를 직접 대조하세요.",
            "국가별 비자 정보",
        ),
        "travel": (
            "여행 정보 확인 범위",
            "2026년 8월 11일에 재검토했습니다. 입국, 치안, 교통, 가격과 운영시간은 예고 없이 바뀔 수 있습니다. 출발 당일 외교부 여행경보, 현지 정부·교통 운영사와 예약처의 공식 정보를 확인하고 여행자 보험과 비상 연락·대피 계획을 준비하세요.",
            "다른 여행지 정보",
        ),
        "finance": (
            "자료의 범위와 투자 유의사항",
            "2026년 8월 11일에 교육 목적으로 재검토한 비개인화 자료이며 실시간 시세나 투자 권유가 아닙니다. 수익을 보장하지 않으며 원금 손실이 가능합니다. 공시 원문과 최신 재무자료를 직접 확인하고 필요하면 인가된 전문가와 상담하세요.",
            "관련 금융 정보",
        ),
        "windows": (
            "변경 전 백업이 필요합니다",
            "2026년 8월 11일에 재검토했습니다. 해결 절차는 Windows 빌드, 장치, 드라이버와 조직 정책에 따라 달라질 수 있습니다. 시스템 변경 전 중요 파일을 백업하고 복원 지점과 되돌리기 방법을 준비하세요.",
            "다른 Windows 해결 방법",
        ),
    }
    if category == "game":
        if relative.startswith("jp/"):
            return (
                "動作範囲と制限",
                "2026年8月11日に再確認しました。このゲームは娯楽・練習用です。端末性能、ブラウザー、入力方法によって操作感や計時結果が異なる場合があります。",
                "関連ゲーム",
            )
        return (
            "Scope and limitations",
            "Reviewed on August 11, 2026. This game is for entertainment and practice. Random, timed, or control results can vary with device performance, browser behavior, and input method.",
            "Related games",
        )
    return copy[category]


def make_block(relative: str, schema_type: str, category: str, hub: str) -> str:
    title, body, label = trust_copy(relative, category)
    schema = json.dumps(
        {"@context": "https://schema.org", "@type": schema_type, "dateModified": "2026-08-11", "url": public_url(relative)},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    official = ""
    if category == "camp":
        official = ' · <a href="https://www.gocamping.or.kr/" target="_blank" rel="noopener noreferrer">고캠핑 공식 정보</a>'
    return f'''\n<!-- {MARKER} -->
<style>.adsbygoogle,div[id^="aswift_"]{{max-width:100%!important;overflow:hidden}}</style>
<script type="application/ld+json">{schema}</script>
<section data-trust-category="{category}" style="max-width:860px;margin:24px auto;padding:20px;border:1px solid #dbe3ee;border-radius:12px;background:#f8fafc;color:#263238;line-height:1.7">
  <h2 style="margin-top:0">{html.escape(title)}</h2>
  <p>{html.escape(body)}</p>
  <p><a href="{html.escape(hub, quote=True)}">{html.escape(label)}</a>{official}</p>
</section>
'''


def main() -> None:
    if len(PAGES) != 50 or len({row[0] for row in PAGES}) != 50:
        raise SystemExit("manifest must contain exactly 50 unique pages")
    changed = skipped = 0
    for relative, schema_type, category, hub in PAGES:
        path = ROOT / relative
        source = path.read_text(encoding="utf-8")
        if MARKER in source:
            skipped += 1
            continue
        position = source.lower().rfind("</body>")
        if position < 0:
            raise SystemExit(f"missing body close: {relative}")
        path.write_text(source[:position] + make_block(relative, schema_type, category, hub) + source[position:], encoding="utf-8")
        changed += 1
    print(f"changed={changed} skipped={skipped}")


if __name__ == "__main__":
    main()
