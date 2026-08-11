#!/usr/bin/env python3
"""Apply the approved 100-page GA4 quality batch with full preflight."""

from __future__ import annotations

import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tests.next_hundred_ga4_manifest import PAGES  # noqa: E402

MARKER = "next-hundred-ga4-priority-2026-08-11"


def public_url(relative: str) -> str:
    return "https://emfls.github.io/" + relative.removesuffix("index.html")


def trust_copy(relative: str, category: str) -> tuple[str, str, str]:
    if category == "travel":
        if "north-korea" in relative:
            return (
                "방문 허가와 안전을 보장하지 않습니다",
                "2026년 8월 11일에 재검토했습니다. 이 페이지를 북한 방문 허가나 안전 판단의 근거로 사용하지 마세요. 출입 제한, 제재, 영사 지원과 신변 위험이 급변할 수 있으므로 대한민국 외교부 등 관할 정부의 최신 여행금지·여행경보와 법률을 당일 확인하세요.",
                "다른 여행지 정보",
            )
        return (
            "출발 당일 공식 정보를 확인하세요",
            "2026년 8월 11일에 재검토했습니다. 입국, 치안, 교통, 가격, 운영시간과 지역 접근은 예고 없이 바뀔 수 있습니다. 외교부 여행경보, 현지 정부·교통 운영사와 예약처의 공식 정보를 당일 확인하고 보험·비상 연락·대피 계획을 준비하세요.",
            "다른 여행지 정보",
        )
    if category == "visa":
        return (
            "입국 조건은 출발 직전에 재확인하세요",
            "2026년 8월 11일에 재검토했습니다. 이 글은 비자 발급이나 입국을 보장하지 않으며 국적, 여권, 방문 목적과 경유지에 따라 조건이 달라집니다. 대사관·이민국·외교부와 이용 항공사의 최신 공식 안내를 직접 대조하세요.",
            "국가별 비자 정보",
        )
    if category == "camp":
        return (
            "야영 허용 여부와 안전을 확인하세요",
            "2026년 8월 11일에 재검토했습니다. 소개 장소가 무료 또는 합법 야영을 보장하지 않습니다. 현장 표지와 토지 관리자·지자체 규정을 확인하고 기상특보, 산불 위험, 하천 수위와 대피 경로를 출발 직전에 점검하세요.",
            "다른 지역 캠핑 정보",
        )
    if category == "coin":
        return (
            "교육 자료이며 투자 권유가 아닙니다",
            "2026년 8월 11일에 재검토했습니다. 암호자산은 가격 변동성, 낮은 유동성, 스마트 계약 오류, 보관·해킹, 상장폐지와 규제 변화로 원금 전부를 잃을 수 있습니다. 공식 문서·계약 주소·거래소 공지·관할 규제기관 자료를 직접 확인하세요.",
            "관련 암호자산 가이드",
        )
    if category == "health":
        return (
            "의료진과 공식 지침을 우선하세요",
            "2026년 8월 11일에 재검토한 일반 정보이며 진단이나 치료를 대신하지 않습니다. 측정기 사용법과 수치는 제품 설명서·의료진·질병관리청 최신 안내를 우선하고, 의식 저하·호흡 곤란·심한 탈수 등 급성 증상이 있으면 즉시 응급 진료를 받으세요.",
            "관련 건강 정보",
        )
    if category == "finance":
        return (
            "비개인화 교육 자료입니다",
            "2026년 8월 11일에 재검토했으며 실시간 시세나 투자 권유가 아닙니다. 수익을 보장하지 않고 원금 손실이 가능하므로 공시 원문과 최신 재무자료를 직접 확인하고 필요하면 인가된 전문가와 상담하세요.",
            "관련 금융 정보",
        )
    if category == "article":
        return (
            "비교 기준과 서비스는 바뀔 수 있습니다",
            "2026년 8월 11일 기준의 편집 비교이며 영구적인 우열 순위가 아닙니다. 모델 기능, 가격, 사용 한도, 개인정보 처리와 약관은 수시로 바뀌므로 선택 전에 각 서비스의 최신 공식 문서를 확인하세요.",
            "관련 기술 글",
        )
    if category == "game":
        if relative.startswith("ru/"):
            return (
                "Область применения и ограничения",
                "Проверено 11 августа 2026 года. Игра предназначена для развлечения и тренировки; случайные, временные и управляющие результаты зависят от устройства, браузера и способа ввода.",
                "Похожие игры",
            )
        return (
            "이용 범위와 한계",
            "2026년 8월 11일에 재검토했습니다. 이 게임은 오락·연습용이며 난수, 시간 측정과 조작 결과는 기기 성능, 브라우저와 입력 방식에 따라 달라질 수 있습니다.",
            "관련 게임",
        )
    if relative.startswith("ru/"):
        return (
            "Область применения и ограничения",
            "Проверено 11 августа 2026 года. Инструмент работает в браузере; результат может зависеть от устройства, браузера и введённых данных. Проверьте результат перед важным использованием.",
            "Похожие инструменты",
        )
    return (
        "Scope and limitations",
        "Reviewed on August 11, 2026. This browser tool may vary by device, browser, input data, local processing limits, or pseudorandom behavior. Verify the result independently before important use.",
        "Related tools",
    )


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
        sources[relative] = source

    changed = skipped = 0
    for relative, schema_type, category, hub in PAGES:
        source = sources[relative]
        if MARKER in source:
            skipped += 1
            continue
        position = source.lower().rfind("</body>")
        (ROOT / relative).write_text(source[:position] + make_block(relative, schema_type, category, hub) + source[position:], encoding="utf-8")
        changed += 1
    print(f"changed={changed} skipped={skipped}")


if __name__ == "__main__":
    main()
