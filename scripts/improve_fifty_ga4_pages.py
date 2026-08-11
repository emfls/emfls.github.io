#!/usr/bin/env python3
"""Apply the approved 2026-08-11 trust/SEO improvements to 50 GA4 pages."""

from __future__ import annotations

import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tests.fifty_ga4_manifest import PAGES  # noqa: E402

MARKER = "ga4-priority-2026-08-11"


def public_url(relative: str) -> str:
    path = relative.removesuffix("index.html")
    return f"https://emfls.github.io/{path}"


def language(relative: str) -> str:
    return relative.split("/", 1)[0] if relative.split("/", 1)[0] in {"vn", "ae", "cn", "de", "kor"} else "en"


def copy_for(relative: str, category: str, hub: str) -> tuple[str, str, str]:
    if category == "health":
        return (
            "정보 확인 및 진료 안내",
            "2026년 8월 11일에 내용을 재검토했습니다. 격리·등원 여부는 증상, 연령, 기관 지침에 따라 달라질 수 있으므로 질병관리청 최신 안내와 의료진 판단을 우선하세요. 고열, 탈수, 의식 저하 등 이상 증상이 있으면 즉시 진료를 받아야 합니다.",
            "관련 건강 정보",
        )
    if category == "game_article":
        return (
            "패치 시점과 해석 범위",
            "2026년 8월 11일 기준으로 재검토한 공략·의견 자료입니다. 직업 평가는 패치, 장비, 플레이 숙련도와 콘텐츠에 따라 달라지며 공식 순위가 아닙니다. 적용 전 최신 패치 노트와 실제 게임 정보를 함께 확인하세요.",
            "관련 게임 글",
        )
    if category == "camp":
        return (
            "출발 전 반드시 확인하세요",
            "2026년 8월 11일에 정보를 재검토했습니다. 소개된 장소가 무료·합법 야영을 자동으로 보장하지 않습니다. 현장 표지, 토지 관리자와 지자체의 출입·취사·숙박 규정을 우선 확인하고, 기상특보·산불 위험·하천 수위와 대피 경로를 출발 직전에 다시 점검하세요.",
            "다른 지역 캠핑 정보",
        )
    if category == "coin":
        return (
            "투자 전 확인 사항",
            "2026년 8월 11일에 교육 목적으로 재검토한 자료이며 투자 권유가 아닙니다. 암호자산은 가격 변동성, 낮은 유동성, 스마트 계약 오류, 보관·해킹, 상장폐지와 규제 변화로 원금 전부를 잃을 수 있습니다. 공식 문서·계약 주소·거래소 공지·관할 규제기관 자료를 직접 대조하세요.",
            "관련 암호자산 가이드",
        )

    lang = language(relative)
    if category == "finance":
        return (
            "计算结果说明",
            "本页已于2026年8月11日复核。结果仅供估算，可能因四舍五入、计息周期、费用、税费和实际合同条款而不同；作出财务决定前请与银行、合同或专业人士的数据核对。",
            "相关计算工具",
        )
    localized = {
        "vn": (
            "Phạm vi và giới hạn",
            "Nội dung được kiểm tra lại ngày 11/08/2026. Công cụ chạy trong trình duyệt và kết quả có thể khác theo thiết bị, trình duyệt hoặc dữ liệu nhập; hãy kiểm tra lại trước khi dùng cho quyết định quan trọng.",
            "Công cụ liên quan",
        ),
        "ae": (
            "النطاق والقيود",
            "تمت مراجعة الصفحة في 11 أغسطس 2026. تعمل الأداة داخل المتصفح وقد تختلف النتائج باختلاف الجهاز أو المتصفح أو البيانات المدخلة؛ تحقق من النتيجة قبل استخدامها في قرار مهم.",
            "أدوات ذات صلة",
        ),
        "cn": (
            "使用范围与限制",
            "本页已于2026年8月11日复核。工具在浏览器中运行，结果可能因设备、浏览器或输入数据而不同；用于重要决定前请再次核对。",
            "相关工具",
        ),
        "de": (
            "Geltungsbereich und Grenzen",
            "Diese Seite wurde am 11. August 2026 geprüft. Das Werkzeug läuft im Browser; Ergebnisse können je nach Gerät, Browser und Eingabe abweichen. Bitte vor wichtigen Entscheidungen unabhängig prüfen.",
            "Ähnliche Werkzeuge",
        ),
        "kor": (
            "이용 범위와 한계",
            "2026년 8월 11일에 다시 확인했습니다. 게임 결과는 기기 성능, 브라우저와 입력 방식에 따라 달라질 수 있으며 오락·연습용입니다.",
            "관련 게임",
        ),
        "en": (
            "Scope and limitations",
            "Reviewed on August 11, 2026. This browser-based tool may produce different results depending on the device, browser, or input data. Verify the output independently before using it for an important decision.",
            "Related tools",
        ),
    }
    title, body, label = localized[lang]
    if category == "game" and lang == "cn":
        body = "本页已于2026年8月11日复核。游戏仅供娱乐和练习，随机或计时结果可能因设备性能、浏览器及输入方式而不同。"
    elif category == "game" and lang == "en":
        body = "Reviewed on August 11, 2026. This game is for entertainment and practice; random or timed results may vary with device performance, browser behavior, and input method."
    return title, body, label


def block(relative: str, schema_type: str, category: str, hub: str) -> str:
    title, body, label = copy_for(relative, category, hub)
    schema = json.dumps(
        {"@context": "https://schema.org", "@type": schema_type, "dateModified": "2026-08-11", "url": public_url(relative)},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    extra = ""
    if category == "camp":
        extra = ' <a href="https://www.gocamping.or.kr/" rel="noopener noreferrer">고캠핑 공식 정보</a>'
    return f'''\n<!-- {MARKER} -->
<style>.adsbygoogle,div[id^="aswift_"]{{max-width:100%!important;overflow:hidden}}</style>
<script type="application/ld+json">{schema}</script>
<section data-trust-category="{category}" style="max-width:860px;margin:24px auto;padding:20px;border:1px solid #dbe3ee;border-radius:12px;background:#f8fafc;color:#263238;line-height:1.7">
  <h2 style="margin-top:0">{html.escape(title)}</h2>
  <p>{html.escape(body)}</p>
  <p><a href="{html.escape(hub, quote=True)}">{html.escape(label)}</a>{extra}</p>
</section>
'''


def main() -> None:
    if len(PAGES) != 50 or len({row[0] for row in PAGES}) != 50:
        raise SystemExit("manifest must contain exactly 50 unique pages")
    changed = skipped = 0
    for relative, schema_type, category, hub in PAGES:
        path = ROOT / relative
        if not path.is_file():
            raise SystemExit(f"missing page: {relative}")
        source = path.read_text(encoding="utf-8")
        if MARKER in source:
            skipped += 1
            continue
        if "</body>" not in source.lower():
            raise SystemExit(f"missing body close: {relative}")
        position = source.lower().rfind("</body>")
        updated = source[:position] + block(relative, schema_type, category, hub) + source[position:]
        path.write_text(updated, encoding="utf-8")
        changed += 1
    print(f"changed={changed} skipped={skipped}")


if __name__ == "__main__":
    main()
