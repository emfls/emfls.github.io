"""Coupang Partners product search without source-embedded credentials."""

import hashlib
import hmac
import os
import sys
from pathlib import Path
from time import gmtime, strftime
from urllib.parse import quote

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from automation_security import require_automation_enabled


DOMAIN = "https://api-gateway.coupang.com"
SEARCH_URL = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search"
_cache: dict = {}
_rate_limited: bool = False


def _auth(method: str, url_path_with_query: str) -> str:
    access_key = os.environ.get("COUPANG_PARTNERS_ACCESS_KEY", "").strip()
    secret_key = os.environ.get("COUPANG_PARTNERS_SECRET_KEY", "").strip()
    if not access_key or not secret_key:
        raise RuntimeError("Missing Coupang Partners API environment variables")
    path, *qs = url_path_with_query.split("?")
    dt = strftime("%y%m%d", gmtime()) + "T" + strftime("%H%M%S", gmtime()) + "Z"
    message = dt + method + path + (qs[0] if qs else "")
    signature = hmac.new(
        secret_key.encode("utf-8"), message.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return f"CEA algorithm=HmacSHA256, access-key={access_key}, signed-date={dt}, signature={signature}"


def is_rate_limited() -> bool:
    return _rate_limited


def search_products(keyword: str, limit: int = 4) -> list:
    global _rate_limited
    if _rate_limited:
        return []
    cache_key = f"{keyword}:{limit}"
    if cache_key in _cache:
        return _cache[cache_key]
    url_with_query = f"{SEARCH_URL}?keyword={quote(keyword)}&limit={limit}"
    auth = _auth("GET", url_with_query)

    try:
        response = requests.get(
            DOMAIN + url_with_query,
            headers={"Authorization": auth, "Content-Type": "application/json"},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        rcode = str(data.get("rCode", "200"))
        message = data.get("rMessage", "")
        if rcode not in ("200", "0"):
            print(f"  [쿠팡API {rcode}] keyword={keyword}: {message[:120]}")
            if "시간당 사용 횟수" in message or "초과" in message:
                _rate_limited = True
                print("  ⛔ Rate limit 감지 → 이번 실행의 나머지 API 호출 중단")
            _cache[cache_key] = []
            return []

        products = []
        for item in data.get("data", {}).get("productData", []):
            products.append({
                "name": item.get("productName", ""),
                "price": int(item.get("productPrice", 0) or 0),
                "image": item.get("productImage", ""),
                "url": item.get("productUrl", ""),
                "is_rocket": item.get("isRocket", False),
            })
        _cache[cache_key] = products
        return products
    except Exception as error:
        print(f"  [쿠팡API 오류] keyword={keyword}: {error}")
        _cache[cache_key] = []
        return []


COUPANG_STYLE = """
<style>
.cp-section{background:#fff;border-radius:12px;padding:22px 24px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);}
.cp-section h2{font-size:1.05rem;color:#e8231a;border-bottom:2px solid #fff0f0;padding-bottom:8px;margin-bottom:6px;}
.cp-notice{font-size:.72rem;color:#aaa;margin-bottom:14px;}
.cp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}
.cp-card a{display:block;text-decoration:none;background:#fafafa;border:1px solid #eee;border-radius:8px;overflow:hidden;transition:box-shadow .15s;}
.cp-card a:hover{box-shadow:0 4px 12px rgba(0,0,0,.12);}
.cp-card img{width:100%;aspect-ratio:1;object-fit:contain;background:#f5f5f5;}
.cp-name{font-size:.78rem;color:#222;padding:8px 8px 4px;line-height:1.4;font-weight:600;min-height:44px;}
.cp-price{font-size:.85rem;color:#e8231a;font-weight:700;padding:0 8px 10px;}
.cp-rocket{font-size:.68rem;background:#e8231a;color:#fff;padding:2px 6px;border-radius:4px;margin-left:4px;}
</style>
"""


def products_html(keyword: str, limit: int = 4) -> str:
    items = search_products(keyword, limit)
    if not items:
        return ""

    cards = ""
    for product in items:
        name_short = product["name"][:36] + ("…" if len(product["name"]) > 36 else "")
        price_str = f"{product['price']:,}원" if product["price"] else ""
        img_tag = (
            f'<img src="{product["image"]}" alt="{product["name"][:20]}" loading="lazy">'
            if product["image"] else ""
        )
        rocket_tag = '<span class="cp-rocket">로켓</span>' if product["is_rocket"] else ""
        cards += f"""
    <div class="cp-card">
      <a href="{product['url']}" target="_blank" rel="noopener sponsored">
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
    require_automation_enabled()
    print("=== 쿠팡 파트너스 API 테스트 ===")
    for keyword in ["요가매트", "텐트", "덤벨"]:
        results = search_products(keyword, limit=3)
        if results:
            print(f"✅ '{keyword}': {len(results)}개")
            for result in results:
                rocket = "🚀" if result["is_rocket"] else "  "
                print(f"   {rocket} {result['name'][:35]} / {result['price']:,}원")
        else:
            print(f"❌ '{keyword}': 결과 없음")
        print()
