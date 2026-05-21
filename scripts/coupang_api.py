"""
쿠팡 파트너스 Open API 모듈
- 키워드로 상품 검색 → 파트너스 링크 포함 상품 목록 반환
- 공식 문서 기준: message = datetime + method + path + query (개행 없음)
- Authorization header: access-key (access-id 아님)
"""
import hmac
import hashlib
import os
import requests
from time import gmtime, strftime
from urllib.parse import quote

ACCESS_KEY = os.environ.get("COUPANG_ACCESS_KEY", "537242c1-60a4-4c60-ac25-b34f8dc73bc7")
SECRET_KEY = os.environ.get("COUPANG_SECRET_KEY", "06ab79657985589a7797bd6a53d994d387633822")

DOMAIN     = "https://api-gateway.coupang.com"
SEARCH_URL = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search"

# 동일 키워드 반복 API 호출 방지 (런타임 캐시)
_cache: dict = {}

# rate limit 상태 플래그 (한 번 감지되면 더 이상 호출 안 함)
_rate_limited: bool = False


def _auth(method: str, url_path_with_query: str) -> str:
    """공식 문서 기준 HMAC 서명 생성"""
    path, *qs = url_path_with_query.split("?")
    dt = strftime("%y%m%d", gmtime()) + "T" + strftime("%H%M%S", gmtime()) + "Z"
    message = dt + method + path + (qs[0] if qs else "")
    sig = hmac.new(SECRET_KEY.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"CEA algorithm=HmacSHA256, access-key={ACCESS_KEY}, signed-date={dt}, signature={sig}"


def is_rate_limited() -> bool:
    """현재 rate limit 상태 반환"""
    return _rate_limited


def search_products(keyword: str, limit: int = 4) -> list:
    """키워드로 쿠팡 파트너스 상품 검색. 반환: [{"name", "price", "image", "url", "is_rocket"}, ...]"""
    global _rate_limited
    if _rate_limited:
        return []
    cache_key = f"{keyword}:{limit}"
    if cache_key in _cache:
        return _cache[cache_key]
    url_with_query = f"{SEARCH_URL}?keyword={quote(keyword)}&limit={limit}"
    auth = _auth("GET", url_with_query)

    try:
        resp = requests.get(
            DOMAIN + url_with_query,
            headers={"Authorization": auth, "Content-Type": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        # rCode 체크: "200"=정상, "0"=면책문구 경고(데이터 있음), 나머지=오류
        rcode = str(data.get("rCode", "200"))
        msg = data.get("rMessage", "")
        if rcode not in ("200", "0"):
            print(f"  [쿠팡API {rcode}] keyword={keyword}: {msg[:120]}")
            if "시간당 사용 횟수" in msg or "초과" in msg:
                _rate_limited = True
                print("  ⛔ Rate limit 감지 → 이번 실행의 나머지 API 호출 중단")
            _cache[cache_key] = []
            return []
        # rCode "0"은 면책문구 안내 경고이지만 데이터는 정상 포함 → 그대로 진행

        products = []
        for item in data.get("data", {}).get("productData", []):
            products.append({
                "name":      item.get("productName", ""),
                "price":     int(item.get("productPrice", 0) or 0),
                "image":     item.get("productImage", ""),
                "url":       item.get("productUrl", ""),
                "is_rocket": item.get("isRocket", False),
            })
        _cache[cache_key] = products
        return products
    except Exception as e:
        print(f"  [쿠팡API 오류] keyword={keyword}: {e}")
        _cache[cache_key] = []
        return []


COUPANG_STYLE = """
<style>
.cp-section{background:#fff;border-radius:12px;padding:22px 24px;margin-bottom:16px;
  box-shadow:0 2px 8px rgba(0,0,0,.06);}
.cp-section h2{font-size:1.05rem;color:#e8231a;border-bottom:2px solid #fff0f0;
  padding-bottom:8px;margin-bottom:6px;}
.cp-notice{font-size:.72rem;color:#aaa;margin-bottom:14px;}
.cp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}
.cp-card a{display:block;text-decoration:none;background:#fafafa;border:1px solid #eee;
  border-radius:8px;overflow:hidden;transition:box-shadow .15s;}
.cp-card a:hover{box-shadow:0 4px 12px rgba(0,0,0,.12);}
.cp-card img{width:100%;aspect-ratio:1;object-fit:contain;background:#f5f5f5;}
.cp-name{font-size:.78rem;color:#222;padding:8px 8px 4px;line-height:1.4;
  font-weight:600;min-height:44px;}
.cp-price{font-size:.85rem;color:#e8231a;font-weight:700;padding:0 8px 10px;}
.cp-rocket{font-size:.68rem;background:#e8231a;color:#fff;padding:2px 6px;
  border-radius:4px;margin-left:4px;}
</style>
"""


def products_html(keyword: str, limit: int = 4) -> str:
    """키워드로 검색해서 상품 카드 HTML 반환. 결과 없으면 빈 문자열."""
    items = search_products(keyword, limit)
    if not items:
        return ""

    cards = ""
    for p in items:
        name_short = p["name"][:36] + ("…" if len(p["name"]) > 36 else "")
        price_str  = f"{p['price']:,}원" if p["price"] else ""
        img_tag    = f'<img src="{p["image"]}" alt="{p["name"][:20]}" loading="lazy">' if p["image"] else ""
        rocket_tag = '<span class="cp-rocket">로켓</span>' if p["is_rocket"] else ""
        cards += f"""
    <div class="cp-card">
      <a href="{p['url']}" target="_blank" rel="noopener sponsored">
        {img_tag}
        <div class="cp-name">{name_short}{rocket_tag}</div>
        <div class="cp-price">{price_str}</div>
      </a>
    </div>"""

    return f"""
<div class="cp-section">
  <h2>🛒 추천 상품 — {keyword}</h2>
  <p class="cp-notice">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
  <div class="cp-grid">{cards}
  </div>
</div>"""


if __name__ == "__main__":
    print("=== 쿠팡 파트너스 API 테스트 ===")
    for kw in ["요가매트", "텐트", "덤벨"]:
        results = search_products(kw, limit=3)
        if results:
            print(f"✅ '{kw}': {len(results)}개")
            for r in results:
                rocket = "🚀" if r["is_rocket"] else "  "
                print(f"   {rocket} {r['name'][:35]} / {r['price']:,}원")
        else:
            print(f"❌ '{kw}': 결과 없음")
        print()
