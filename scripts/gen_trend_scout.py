"""
Google Trends 트렌드 탐색기
- 한국(geo=KR) 꾸준한 검색 키워드 발굴
- 결과를 scripts/data/trend_topics.json 에 저장
- 이미 등록된 슬러그는 재탐색하지 않음
"""
import json
import time
import re
import unicodedata
from pathlib import Path
from datetime import datetime

from pytrends.request import TrendReq

REPO_ROOT = Path(__file__).parent.parent
DATA_PATH = REPO_ROOT / "scripts/data/trend_topics.json"

# 카테고리별 시드 키워드
SEED_GROUPS = {
    "camping": [
        "노지캠핑", "차박", "글램핑", "오토캠핑", "백패킹",
        "1인캠핑", "겨울캠핑", "봄캠핑", "여름캠핑", "가을캠핑",
    ],
    "finance": [
        "ETF 추천", "배당주 추천", "재테크 방법", "적금 금리",
        "주식 투자 방법", "부동산 투자", "비트코인 전망",
        "달러 환율", "금 투자", "ISA 계좌",
    ],
    "lifestyle": [
        "주말 여행지 추천", "혼자 여행", "국내 여행", "데이트 코스",
        "맛집 추천", "카페 추천", "등산 코스 추천",
        "드라이브 코스", "당일치기 여행", "힐링 여행",
    ],
    "niche": [
        "전기차 추천", "반려동물 여행", "취미 추천", "자취방 인테리어",
        "건강 식단", "홈트레이닝", "영어 공부 방법",
        "부업 추천", "프리랜서", "원격근무",
    ],
}

# 카테고리 → 페이지 타입 매핑
CATEGORY_PAGE_TYPE = {
    "camping": "camp_theme",
    "finance": "finance_guide",
    "lifestyle": "lifestyle_hub",
    "niche": "niche_guide",
}

EVERGREEN_MIN_AVG = 15       # 평균 관심도 최소값 (0~100)
EVERGREEN_MAX_CV  = 0.65     # 변동계수(std/mean) 최대값 — 낮을수록 꾸준함


def slugify(text):
    text = text.lower().strip()
    text = unicodedata.normalize("NFKD", text)
    text = re.sub(r"[^\w\s가-힣-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    return text[:50]


def load_existing():
    if DATA_PATH.exists():
        with open(DATA_PATH, encoding="utf-8") as f:
            return json.load(f)
    return []


def is_evergreen(df, kw):
    if kw not in df.columns:
        return False, 0, 0
    series = df[kw].dropna()
    if len(series) < 4:
        return False, 0, 1
    avg = series.mean()
    cv = series.std() / avg if avg > 0 else 99
    return avg >= EVERGREEN_MIN_AVG and cv <= EVERGREEN_MAX_CV, avg, cv


def scan_category(pytrends, category, seeds, existing_slugs):
    found = []
    batch_size = 5  # pytrends 한 번에 최대 5개

    for i in range(0, len(seeds), batch_size):
        batch = seeds[i : i + batch_size]
        try:
            pytrends.build_payload(batch, cat=0, timeframe="today 12-m", geo="KR")
            time.sleep(3)
            df = pytrends.interest_over_time()
            if df.empty:
                continue

            for kw in batch:
                slug = slugify(kw)
                if slug in existing_slugs:
                    print(f"    [스킵] {kw} (이미 존재)")
                    continue
                ok, avg, cv = is_evergreen(df, kw)
                if ok:
                    found.append({
                        "slug": slug,
                        "keyword": kw,
                        "category": category,
                        "page_type": CATEGORY_PAGE_TYPE[category],
                        "avg_interest": round(float(avg), 1),
                        "consistency": round(1 - float(cv), 2),
                        "discovered_date": datetime.now().strftime("%Y-%m-%d"),
                        "generated": False,
                    })
                    print(f"    ✓ [{category}] {kw} | avg={avg:.0f} cv={cv:.2f}")
                else:
                    print(f"    ✗ [{category}] {kw} | avg={avg:.0f} cv={cv:.2f}")

            # related queries 탐색
            try:
                time.sleep(3)
                rel = pytrends.related_queries()
                for kw in batch:
                    top = rel.get(kw, {}).get("top")
                    if top is None or top.empty:
                        continue
                    for _, row in top.head(5).iterrows():
                        rq = str(row["query"])
                        rslug = slugify(rq)
                        if rslug in existing_slugs or any(f["slug"] == rslug for f in found):
                            continue
                        # 관련 쿼리는 avg 체크 없이 후보로만 등록
                        found.append({
                            "slug": rslug,
                            "keyword": rq,
                            "category": category,
                            "page_type": CATEGORY_PAGE_TYPE[category],
                            "avg_interest": round(float(row.get("value", 0)), 1),
                            "consistency": 0.5,  # 미검증
                            "discovered_date": datetime.now().strftime("%Y-%m-%d"),
                            "generated": False,
                        })
                        print(f"    + 관련쿼리: {rq}")
            except Exception as e:
                print(f"    [관련쿼리 오류] {e}")

            time.sleep(4)

        except Exception as e:
            print(f"  [오류] {category} batch {i}: {e}")
            time.sleep(30)

    return found


def main():
    print("=" * 50)
    print("📊 Google Trends 탐색 시작")
    print("=" * 50)

    existing = load_existing()
    existing_slugs = {t["slug"] for t in existing}
    print(f"기존 토픽: {len(existing)}개")

    pytrends = TrendReq(hl="ko", tz=540, retries=3, backoff_factor=1.5)

    new_topics = []
    for category, seeds in SEED_GROUPS.items():
        print(f"\n[{category}] 탐색 중... ({len(seeds)}개 시드)")
        found = scan_category(pytrends, category, seeds, existing_slugs)
        new_topics.extend(found)
        time.sleep(5)

    all_topics = existing + new_topics
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(all_topics, f, ensure_ascii=False, indent=2)

    print(f"\n완료: 신규 {len(new_topics)}개 발굴, 총 {len(all_topics)}개 저장")
    return new_topics


if __name__ == "__main__":
    main()
