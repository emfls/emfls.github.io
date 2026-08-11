"""Shared transformer for the fifth and sixth GA4 hundred-page batches."""

from __future__ import annotations

import re

import scripts.improve_next_hundred_ga4_pages as base

_default_copy = base.trust_copy

RISK_TOKENS = (
    "afghanistan-", "belarus-", "iran-", "iraq-", "israel-", "libya-",
    "myanmar-", "north-korea-", "palestine-", "russia-", "sudan-", "syria-",
    "ukraine-", "venezuela-", "yemen-",
)


def localized_copy(relative: str, category: str) -> tuple[str, str, str]:
    locale = relative.split("/", 1)[0] if "/" in relative else "en"
    if category in {"travel", "visa"} and any(token in relative for token in RISK_TOKENS):
        if locale == "jp":
            return (
                "渡航許可や安全を保証する情報ではありません",
                "2026年8月11日に再確認しました。紛争、国境・入域制限、航空便、通信、領事支援は急変します。出発当日に日本国外務省など管轄政府の渡航中止勧告・危険情報と現地の公式規則を確認してください。",
                "関連する渡航情報",
            )
        return (
            "분쟁·출입 제한과 정부 여행경보를 당일 확인하세요",
            "2026년 8월 11일에 재검토했습니다. 이 페이지는 입국 허가나 안전을 보장하지 않습니다. 분쟁, 국경·검문 통제, 항공편, 통신과 영사 지원이 급변할 수 있으므로 관할 정부의 최신 여행금지·여행경보와 현지 출입 규정을 당일 확인하세요.",
            "국가별 비자 정보" if category == "visa" else "다른 여행지 정보",
        )
    if locale == "jp":
        if category in {"travel", "visa"}:
            return (
                "出発直前に公式情報を確認してください",
                "2026年8月11日に再確認しました。入国条件、安全、交通、料金、営業時間は変更されます。大使館、入管、外務省、航空会社、現地運営者の最新情報を出発当日に照合してください。",
                "関連する渡航情報",
            )
        if category == "game":
            return (
                "利用範囲と制限",
                "2026年8月11日に再確認しました。娯楽・練習用のゲームで、乱数、時間、操作結果は端末、ブラウザ、入力方法により異なる場合があります。",
                "関連ゲーム",
            )
        return (
            "情報の範囲と制限",
            "2026年8月11日に再確認しました。内容は一般情報であり、制度、価格、製品・サービスの条件は変更されます。重要な判断の前に一次資料と最新の公式情報を確認してください。",
            "関連情報",
        )
    if locale == "cn":
        if category == "game":
            return (
                "使用范围与限制",
                "已于2026年8月11日复核。本游戏仅供娱乐和练习；随机、计时和操作结果可能因设备、浏览器和输入方式而异。",
                "相关游戏",
            )
        return (
            "使用范围与限制",
            "已于2026年8月11日复核。工具或内容的结果可能受设备、浏览器、输入数据和本地处理限制影响；用于重要用途前请独立核对。",
            "相关内容",
        )
    if locale not in {"kor", "ru"}:
        if category == "game":
            return (
                "Scope and limitations",
                "Reviewed on August 11, 2026. This game is for entertainment and practice; random, timing, and control results can vary by device, browser, and input method.",
                "Related games",
            )
        return (
            "Scope and limitations",
            "Reviewed on August 11, 2026. Information, tool output, prices, rules, and service conditions can change or vary by device and input. Verify primary and current official sources before important use.",
            "Related information",
        )
    if category == "article":
        return (
            "작성 시점과 적용 범위를 확인하세요",
            "2026년 8월 11일에 재검토한 일반 정보입니다. 법령, 정책, 제품, 가격과 서비스 조건은 바뀔 수 있으므로 중요한 판단 전 최신 공식 자료와 원문을 직접 확인하세요.",
            "관련 정보",
        )
    return _default_copy(relative, category)


def apply_pages(root, pages, marker: str, expected_len: int = 100) -> tuple[int, int]:
    if len(pages) != expected_len or len({row[0] for row in pages}) != expected_len:
        raise SystemExit(f"manifest must contain exactly {expected_len} unique pages")
    sources: dict[str, str] = {}
    for relative, _, _, _ in pages:
        path = root / relative
        if not path.is_file():
            raise SystemExit(f"missing page: {relative}")
        source = path.read_text(encoding="utf-8")
        if "</body>" not in source.lower():
            raise SystemExit(f"missing body close: {relative}")
        if "G-QP5Q67GE5B" not in source or "ca-pub-8830524482034754" not in source:
            raise SystemExit(f"missing measurement tag: {relative}")
        sources[relative] = source
    base.MARKER = marker
    base.trust_copy = localized_copy
    changed = skipped = 0
    for relative, schema_type, category, hub in pages:
        source = sources[relative]
        if marker in source:
            skipped += 1
            continue
        body_closes = list(re.finditer(r"</body\s*>", source, flags=re.IGNORECASE))
        if not body_closes:
            raise SystemExit(f"missing body close after preflight: {relative}")
        position = body_closes[-1].start()
        (root / relative).write_text(
            source[:position] + base.make_block(relative, schema_type, category, hub) + source[position:],
            encoding="utf-8",
        )
        changed += 1
    return changed, skipped
