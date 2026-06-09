#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
쿠팡 파트너스 API를 이용해 카테고리별 상품 데이터를 갱신하고
/kor/data/coupang-products.json 을 업데이트하는 스크립트.

사용법:
  python3 update_coupang_products.py

주의:
  - Search API는 1시간에 최대 10회 호출 가능
  - 카테고리가 16개이므로 카테고리당 키워드 1개씩만 호출 (총 16회 이하)
  - 필요하면 --category 옵션으로 특정 카테고리만 갱신 가능
"""

import hmac
import hashlib
import requests
import json
import urllib.parse
import time
import argparse
import os
import sys
from time import gmtime, strftime
from datetime import datetime

# ── 설정 ──────────────────────────────────────────
ACCESS_KEY = "537242c1-60a4-4c60-ac25-b34f8dc73bc7"
SECRET_KEY = "06ab79657985589a7797bd6a53d994d387633822"
DOMAIN = "https://api-gateway.coupang.com"

# 스크립트 위치 기준으로 JSON 경로 설정
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(SCRIPT_DIR, "kor", "data", "coupang-products.json")

# 카테고리별 검색 키워드 (상위 키워드 → 하위 키워드 순)
CATEGORY_KEYWORDS = {
    "travel":       ["여행용품", "캐리어", "여행 파우치", "목베개", "트래블 파우치"],
    "coin":         ["암호화폐 책", "비트코인 책", "재테크 도서", "투자 도서"],
    "visa":         ["여권 지갑", "해외여행 준비물", "여행 파우치"],
    "camp":         ["캠핑용품", "텐트", "캠핑 의자", "랜턴", "버너"],
    "window":       ["윈도우 노트북", "PC 주변기기", "키보드", "마우스"],
    "stock":        ["주식 책", "투자 도서", "경제 책", "재테크 도서"],
    "finance":      ["재테크 책", "경제 도서", "가계부", "투자 입문"],
    "car":          ["차량용품", "블랙박스", "방향제", "차량 청소"],
    "health":       ["건강식품", "유산균", "비타민", "다이어트"],
    "it":           ["무선이어폰", "스마트워치", "노트북", "태블릿"],
    "fashion":      ["패션 의류", "운동화", "가방", "액세서리"],
    "fitness":      ["운동기구", "요가매트", "덤벨", "헬스용품"],
    "general":      ["생활용품", "주방용품", "인테리어", "청소용품"],
    "events":       ["쿠팡 특가", "인기상품", "로켓배송"],
    "society_book": ["베스트셀러", "소설", "자기계발 책", "인문 도서"],
    "society_life": ["생활용품", "주방기구", "정리수납", "욕실용품"],
}

LIMIT_PER_KEYWORD = 10  # API 최대 10개
TARGET_PER_CATEGORY = 17  # 카테고리당 목표 상품 수


def generate_hmac(method: str, url: str) -> str:
    """쿠팡 파트너스 HMAC 인증 헤더 생성"""
    path, *query = url.split("?")
    dt_gmt = strftime('%y%m%d', gmtime()) + 'T' + strftime('%H%M%S', gmtime()) + 'Z'
    message = dt_gmt + method + path + (query[0] if query else "")
    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return (
        f"CEA algorithm=HmacSHA256, "
        f"access-key={ACCESS_KEY}, "
        f"signed-date={dt_gmt}, "
        f"signature={signature}"
    )


def search_products(keyword: str, limit: int = 10) -> list:
    """키워드로 쿠팡 상품 검색"""
    encoded = urllib.parse.quote(keyword)
    url = (
        f"/v2/providers/affiliate_open_api/apis/openapi/products/search"
        f"?keyword={encoded}&limit={limit}"
    )
    auth = generate_hmac("GET", url)
    headers = {
        "Authorization": auth,
        "Content-Type": "application/json;charset=UTF-8",
    }

    try:
        resp = requests.get(DOMAIN + url, headers=headers, timeout=15)
        data = resp.json()
    except Exception as e:
        print(f"    ⚠ 요청 실패: {e}")
        return []

    if data.get("rCode") != "0":
        print(f"    ⚠ API 오류: {data.get('rMessage', '')}")
        return []

    products = []
    for p in data.get("data", {}).get("productData", []):
        products.append({
            "name":      p["productName"][:40],
            "price":     p["productPrice"],
            "image":     p["productImage"],
            "url":       p["productUrl"],
            "is_rocket": bool(p.get("isRocket", False)),
        })
    return products


def update_category(category: str, keywords: list, existing: list) -> list:
    """
    카테고리 상품 갱신
    - 여러 키워드를 순차 호출해 중복 없이 TARGET_PER_CATEGORY개 수집
    - API 제한(1h/10회)을 고려해 키워드 사이 1.5초 대기
    """
    seen_ids = set()
    products = []

    for keyword in keywords:
        if len(products) >= TARGET_PER_CATEGORY:
            break

        print(f"    🔍 '{keyword}' 검색 중...")
        results = search_products(keyword, LIMIT_PER_KEYWORD)

        for p in results:
            key = p["url"]
            if key not in seen_ids:
                seen_ids.add(key)
                products.append(p)
            if len(products) >= TARGET_PER_CATEGORY:
                break

        time.sleep(1.5)  # API 호출 제한 대비

    print(f"    ✅ {len(products)}개 수집")
    return products[:TARGET_PER_CATEGORY]


def main():
    parser = argparse.ArgumentParser(description="쿠팡 파트너스 상품 데이터 갱신")
    parser.add_argument(
        "--category", "-c",
        nargs="*",
        help="갱신할 카테고리 (미입력 시 전체). 예: --category travel camp"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="파일을 저장하지 않고 결과만 출력"
    )
    args = parser.parse_args()

    # 현재 JSON 로드
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            current_data = json.load(f)
        print(f"📂 기존 JSON 로드: {JSON_PATH}")
    else:
        current_data = {}
        print(f"📂 새 파일 생성 예정: {JSON_PATH}")

    # 갱신 대상 카테고리 결정
    target_categories = args.category if args.category else list(CATEGORY_KEYWORDS.keys())
    unknown = [c for c in target_categories if c not in CATEGORY_KEYWORDS]
    if unknown:
        print(f"⚠ 알 수 없는 카테고리: {unknown}")
        print(f"  사용 가능: {list(CATEGORY_KEYWORDS.keys())}")
        sys.exit(1)

    print(f"\n🚀 갱신 시작: {len(target_categories)}개 카테고리")
    print(f"   {target_categories}\n")

    updated = 0
    for cat in target_categories:
        keywords = CATEGORY_KEYWORDS[cat]
        existing = current_data.get(cat, [])
        print(f"📦 [{cat}] (현재 {len(existing)}개 → 목표 {TARGET_PER_CATEGORY}개)")

        new_products = update_category(cat, keywords, existing)

        if new_products:
            current_data[cat] = new_products
            updated += 1
        else:
            print(f"    ⚠ 상품 없음 — 기존 데이터 유지")

    # 저장
    if args.dry_run:
        print("\n[dry-run] 저장 생략")
        print(json.dumps({k: len(v) for k, v in current_data.items()}, ensure_ascii=False))
    else:
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(current_data, f, ensure_ascii=False, indent=2)
        print(f"\n💾 저장 완료: {JSON_PATH}")
        print(f"   갱신된 카테고리: {updated}개")
        print(f"   총 상품: {sum(len(v) for v in current_data.values())}개")

    print(f"\n✅ 완료: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
