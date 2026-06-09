#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
트렌드 주제 기반 자동 글 발행 스크립트
- 최신 트렌드 주제를 검색해서 가져옴
- 주제별 추천형 HTML 글 생성
- 쿠팡 파트너스 API 실제 상품 삽입
- git push 자동화

사용: python3 generate_articles.py [--count N]
"""

import hmac, hashlib, requests, json, urllib.parse, time, os, sys, re, argparse, subprocess
from datetime import datetime
from time import gmtime, strftime

# ── 설정 ──────────────────────────────────────────────────────────
COUPANG_ACCESS = "537242c1-60a4-4c60-ac25-b34f8dc73bc7"
COUPANG_SECRET = "06ab79657985589a7797bd6a53d994d387633822"
COUPANG_DOMAIN = "https://api-gateway.coupang.com"

TELEGRAM_TOKEN   = "8595780602:AAF1mlorCVtSVcwisQQUBD66RWRQFrgVC4Q"
TELEGRAM_CHAT_ID = "124378681"

REPO_DIR = os.path.dirname(os.path.abspath(__file__))
GA_ID    = "G-QP5Q67GE5B"
ADSENSE  = "ca-pub-8830524482034754"
SITE_URL = "https://emfls.com"

GIT_TOKEN  = "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"
GIT_REMOTE = f"https://emfls:{GIT_TOKEN}@github.com/emfls/emfls.github.io.git"
GIT_WORK   = "/tmp/repo_auto"   # config.lock 없는 별도 클론 디렉토리

# ── 트렌드 주제 데이터베이스 ────────────────────────────────────────
# 프리한19 최근 방영 주제에서 추출한 독립 키워드들 (프로그램명 미포함)
def send_telegram(message):
    """텔레그램 메시지 전송"""
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": message,
                                 "parse_mode": "HTML", "disable_web_page_preview": False},
                      timeout=8)
    except Exception as e:
        print(f"  ⚠ 텔레그램 전송 실패: {e}")


TOPIC_BANK = [
    # 가성비/소비
    {"title": "만원 한 장으로 이걸 산다고? 진짜 쓸만한 생활용품 19가지", "slug": "best-1man-won-items-2026",
     "cat": "general", "keyword": "가성비 생활용품", "theme": "green",
     "desc": "고물가 시대, 만 원으로 살 수 있는 진짜 쓸모 있는 생활용품 19가지를 모았습니다.",
     "tags": ["가성비", "생활용품", "절약", "1만원"], "icon": "💰"},

    {"title": "외국인들이 한국 오면 꼭 사가는 것들 19가지, 우리가 모르던 것도 있다", "slug": "korean-souvenir-foreigners-2026",
     "cat": "travel", "keyword": "한국 기념품", "theme": "blue",
     "desc": "한국을 방문한 외국인이 가장 많이 구매하는 기념품과 쇼핑 아이템 19가지입니다.",
     "tags": ["한국기념품", "외국인쇼핑", "K-상품"], "icon": "🇰🇷"},

    # 요리/주방
    {"title": "요리 못해도 맛집 될 수 있는 주방 비밀 아이템 19가지", "slug": "kitchen-must-have-2026",
     "cat": "general", "keyword": "주방용품", "theme": "orange",
     "desc": "요리 실력보다 도구가 더 중요할 때가 있습니다. 주방 고수들이 실제 쓰는 아이템 19가지.",
     "tags": ["주방용품", "요리", "조리도구", "홈쿡"], "icon": "🍳"},

    {"title": "에어프라이어 하나로 19가지 요리 다 되는 거 알고 계셨나요?", "slug": "airfryer-ingredient-guide-2026",
     "cat": "general", "keyword": "에어프라이어 식재료", "theme": "red",
     "desc": "에어프라이어 하나로 19가지 요리를 완성하는 데 필요한 재료와 도구 쇼핑 가이드입니다.",
     "tags": ["에어프라이어", "간편요리", "주방"], "icon": "🥘"},

    # 건강/뷰티
    {"title": "우리가 잘못 알고 있던 건강 상식 19가지, 이 영양제가 정답이었다", "slug": "health-supplement-facts-2026",
     "cat": "health", "keyword": "건강 영양제", "theme": "green",
     "desc": "잘못된 건강 상식 때문에 놓쳤던 영양제들, 2026년 기준 올바른 선택 가이드입니다.",
     "tags": ["영양제", "건강기능식품", "비타민"], "icon": "💊"},

    {"title": "피부과 안 가도 되는 이유, 집에서 되는 뷰티 아이템 19가지", "slug": "home-beauty-care-2026",
     "cat": "health", "keyword": "홈케어 뷰티", "theme": "pink",
     "desc": "피부과·미용실 안 가도 집에서 전문가 수준 케어가 가능한 뷰티 아이템 19가지.",
     "tags": ["홈케어", "뷰티", "피부관리", "셀프케어"], "icon": "✨"},

    # 여름 시즌
    {"title": "캠핑 처음인데 뭐 사야 할지 모르겠다면? 2026 여름 필수 장비 19", "slug": "summer-camping-gear-2026",
     "cat": "camp", "keyword": "여름 캠핑 장비", "theme": "forest",
     "desc": "여름 캠핑에서 없으면 후회하는 장비 19가지. 더위·벌레·습기 해결까지 완벽 준비.",
     "tags": ["여름캠핑", "캠핑용품", "아웃도어"], "icon": "⛺"},

    {"title": "전기세 폭탄 없이 여름 이기는 쿨링 아이템 19가지", "slug": "summer-cool-items-2026",
     "cat": "health", "keyword": "여름 냉방 용품", "theme": "sky",
     "desc": "전기세 걱정 없이 여름을 시원하게 보내는 쿨링 아이템 19가지를 소개합니다.",
     "tags": ["여름용품", "쿨링", "더위해소"], "icon": "❄️"},

    # IT/전자
    {"title": "재택근무 3년차가 말하는 '이거 없으면 못 살겠다' IT 템 19가지", "slug": "home-office-it-2026",
     "cat": "it", "keyword": "홈오피스 IT 용품", "theme": "dark",
     "desc": "재택·하이브리드 근무 시대, 집 사무실을 업그레이드하는 IT 아이템 19가지.",
     "tags": ["재택근무", "홈오피스", "IT용품"], "icon": "💻"},

    {"title": "스마트폰 100% 활용하고 있나요? 모르면 손해인 액세서리 19", "slug": "smartphone-accessories-2026",
     "cat": "it", "keyword": "스마트폰 액세서리", "theme": "purple",
     "desc": "스마트폰 활용도를 극대화하는 액세서리 19가지. 충전, 보호, 생산성 모두 커버.",
     "tags": ["스마트폰", "액세서리", "IT"], "icon": "📱"},

    # 피트니스
    {"title": "헬스장 끊고 나서 오히려 더 좋아진 이유, 홈트 기구 19가지", "slug": "home-workout-equipment-2026",
     "cat": "fitness", "keyword": "홈 운동 기구", "theme": "red",
     "desc": "월 회비 아끼고 집에서 전신 운동하는 홈트레이닝 기구 19가지 추천.",
     "tags": ["홈트", "운동기구", "다이어트", "피트니스"], "icon": "💪"},

    # 여행
    {"title": "일본 여행 다녀온 사람들이 '이거 안 챙겼다'고 후회한 것들 19", "slug": "japan-travel-checklist-2026",
     "cat": "travel", "keyword": "일본 여행 준비물", "theme": "red",
     "desc": "일본 여행 경험자들이 꼭 챙기라는 준비물 19가지. 안 챙기면 현지서 후회하는 것들.",
     "tags": ["일본여행", "여행준비물", "여행용품"], "icon": "✈️"},

    {"title": "동남아 여행 첫날 '이거 왜 안 샀지' 싶은 아이템 19가지", "slug": "southeast-asia-travel-2026",
     "cat": "travel", "keyword": "동남아 여행 준비물", "theme": "tropical",
     "desc": "태국·베트남·발리 여행 전 반드시 챙겨야 할 준비물과 현지에서 살 것들 19가지.",
     "tags": ["동남아여행", "여행준비", "해외여행"], "icon": "🌴"},

    # 가전
    {"title": "자취 1년차가 뒤늦게 깨달은 '이거 진작 살걸' 소형 가전 19", "slug": "small-appliance-best-2026",
     "cat": "it", "keyword": "소형 가전", "theme": "gray",
     "desc": "1인 가구·신혼·자취생 필수 소형 가전 19가지. 가성비와 실용성을 모두 잡았습니다.",
     "tags": ["소형가전", "가성비가전", "1인가구"], "icon": "🏠"},

    # 패션
    {"title": "올여름 이거 입으면 눈에 띄는 거 보장, 2026 패션 트렌드 아이템 19", "slug": "summer-fashion-trend-2026",
     "cat": "fashion", "keyword": "여름 패션", "theme": "summer",
     "desc": "2026년 여름 SNS에서 가장 핫한 패션 아이템 19가지. 스타일링 팁 포함.",
     "tags": ["여름패션", "트렌드", "패션추천"], "icon": "👗"},

    # 육아/선물
    {"title": "아이가 진짜 좋아했던 선물 vs 포장만 뜯고 방치된 것, 장난감 19가지", "slug": "kids-gift-toy-2026",
     "cat": "general", "keyword": "어린이 장난감 선물", "theme": "yellow",
     "desc": "나이별로 딱 맞는 어린이 선물, 이제 고민하지 마세요. 연령별 장난감 19가지 추천.",
     "tags": ["어린이선물", "장난감", "육아"], "icon": "🎁"},

    # 자동차
    {"title": "차 10년 넘게 탄 사람이 말하는 '이거 없으면 차 망가진다' 19가지", "slug": "car-essential-items-2026",
     "cat": "car", "keyword": "차량용품", "theme": "dark",
     "desc": "차량 관리비 줄이고 오래 타는 비결, 차량용품 19가지로 해결하세요.",
     "tags": ["차량용품", "자동차관리", "드라이빙"], "icon": "🚗"},

    # 반려동물
    {"title": "수의사가 몰래 쓰는 반려동물 건강 관리 아이템 19가지", "slug": "pet-care-items-2026",
     "cat": "health", "keyword": "반려동물 용품", "theme": "warm",
     "desc": "수의사가 추천하는 반려동물 건강 관리용품 19가지. 밥그릇부터 영양제까지.",
     "tags": ["반려동물", "펫용품", "반려견", "반려묘"], "icon": "🐾"},

    # 코인/재테크
    {"title": "재테크 시작했다가 실패한 사람들의 공통점, 이 책 19권이 막아줬다", "slug": "investment-beginner-2026",
     "cat": "coin", "keyword": "재테크 투자 책", "theme": "gold",
     "desc": "주식·부동산·코인 입문자를 위한 재테크 도서 및 관련 용품 19가지 추천.",
     "tags": ["재테크", "투자", "경제책"], "icon": "📈"},

    # 미신/풍수
    {"title": "미신인지 과학인지 모르지만 집에 두면 좋은 기운 아이템 19가지", "slug": "feng-shui-interior-2026",
     "cat": "general", "keyword": "풍수 인테리어", "theme": "gold",
     "desc": "미신인지 과학인지 모르지만 실제로 많이 구매하는 행운 인테리어 아이템 19가지.",
     "tags": ["풍수", "인테리어", "행운아이템"], "icon": "🍀"},
]

THEME_COLORS = {
    "green":   {"h1bg": "#1b5e20", "h1end": "#43a047", "accent": "#43a047", "light": "#e8f5e9", "border": "#66bb6a"},
    "blue":    {"h1bg": "#0d47a1", "h1end": "#1976d2", "accent": "#1976d2", "light": "#e3f2fd", "border": "#64b5f6"},
    "orange":  {"h1bg": "#e65100", "h1end": "#fb8c00", "accent": "#fb8c00", "light": "#fff3e0", "border": "#ffa726"},
    "red":     {"h1bg": "#b71c1c", "h1end": "#e53935", "accent": "#e53935", "light": "#ffebee", "border": "#ef9a9a"},
    "pink":    {"h1bg": "#880e4f", "h1end": "#e91e63", "accent": "#e91e63", "light": "#fce4ec", "border": "#f48fb1"},
    "forest":  {"h1bg": "#1b5e20", "h1end": "#2e7d32", "accent": "#388e3c", "light": "#f1f8e9", "border": "#aed581"},
    "sky":     {"h1bg": "#006064", "h1end": "#00acc1", "accent": "#00acc1", "light": "#e0f7fa", "border": "#80deea"},
    "dark":    {"h1bg": "#212121", "h1end": "#424242", "accent": "#616161", "light": "#f5f5f5", "border": "#bdbdbd"},
    "purple":  {"h1bg": "#4a148c", "h1end": "#7b1fa2", "accent": "#ab47bc", "light": "#f3e5f5", "border": "#ce93d8"},
    "tropical":{"h1bg": "#004d40", "h1end": "#00897b", "accent": "#26a69a", "light": "#e0f2f1", "border": "#80cbc4"},
    "gray":    {"h1bg": "#37474f", "h1end": "#546e7a", "accent": "#78909c", "light": "#eceff1", "border": "#b0bec5"},
    "summer":  {"h1bg": "#f57f17", "h1end": "#fbc02d", "accent": "#f9a825", "light": "#fffde7", "border": "#fff176"},
    "yellow":  {"h1bg": "#f57f17", "h1end": "#ff8f00", "accent": "#ffa000", "light": "#fff8e1", "border": "#ffe082"},
    "warm":    {"h1bg": "#bf360c", "h1end": "#e64a19", "accent": "#ff7043", "light": "#fbe9e7", "border": "#ffab91"},
    "gold":    {"h1bg": "#795548", "h1end": "#a1887f", "accent": "#ff8f00", "light": "#fff8e1", "border": "#ffe082"},
}

CAT_TO_DIR = {
    "general": "general", "travel": "travel", "health": "health",
    "camp": "camp", "it": "it", "fitness": "fitness",
    "fashion": "fashion", "car": "car", "coin": "coin",
}


# ── 쿠팡 API ──────────────────────────────────────────────────────
def coupang_auth(url_path):
    path, *q = url_path.split("?")
    dt = strftime('%y%m%d', gmtime()) + 'T' + strftime('%H%M%S', gmtime()) + 'Z'
    msg = dt + "GET" + path + (q[0] if q else "")
    sig = hmac.new(COUPANG_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()
    return f"CEA algorithm=HmacSHA256, access-key={COUPANG_ACCESS}, signed-date={dt}, signature={sig}"

def fetch_products(keyword, limit=10):
    url = f"/v2/providers/affiliate_open_api/apis/openapi/products/search?keyword={urllib.parse.quote(keyword)}&limit={limit}"
    try:
        resp = requests.get(COUPANG_DOMAIN + url,
                            headers={"Authorization": coupang_auth(url),
                                     "Content-Type": "application/json;charset=UTF-8"},
                            timeout=12)
        data = resp.json()
        if data.get("rCode") != "0":
            return []
        out = []
        for p in data["data"].get("productData", []):
            out.append({
                "name":   p["productName"][:38],
                "price":  f"{p['productPrice']:,}원",
                "image":  p["productImage"],
                "url":    p["productUrl"],
                "rocket": bool(p.get("isRocket")),
            })
        return out
    except Exception as e:
        print(f"  ⚠ 쿠팡 API 오류: {e}")
        return []


# ── HTML 생성 ──────────────────────────────────────────────────────
def product_cards_html(products):
    if not products:
        return ""
    cards = ""
    for p in products[:5]:
        rocket = '<span class="cp3-rocket">로켓</span>' if p["rocket"] else ""
        cards += f'''<a class="cp3-card" href="{p['url']}" target="_blank" rel="noopener sponsored">
      <img src="{p['image']}" alt="{p['name']}" loading="lazy">
      <div class="cp3-name">{p['name']}{rocket}</div>
      <div class="cp3-price">{p['price']}</div>
    </a>'''
    return cards

def ad_block_html(title, products):
    if not products:
        return ""
    return f"""<div class="cp3-wrap">
  <div class="cp3-box">
    <div class="cp3-title">{title}</div>
    <div class="cp3-row">{product_cards_html(products)}</div>
    <div class="cp3-notice">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</div>
  </div>
</div>"""

def build_items_html(topic, products):
    """상품 기반 19개 아이템 섹션 생성"""
    items_html = ""
    emojis = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟",
              "1️⃣1️⃣","1️⃣2️⃣","1️⃣3️⃣","1️⃣4️⃣","1️⃣5️⃣","1️⃣6️⃣","1️⃣7️⃣","1️⃣8️⃣","1️⃣9️⃣"]

    for i, p in enumerate(products[:19]):
        num = emojis[i] if i < len(emojis) else f"{i+1}."
        rocket_badge = '<span class="rank-rocket">로켓배송</span>' if p["rocket"] else ""
        items_html += f"""
    <div class="rank-item">
      <div class="rank-num">{num}</div>
      <div class="rank-content">
        <a href="{p['url']}" target="_blank" rel="noopener sponsored" class="rank-name">
          {p['name']}{rocket_badge}
        </a>
        <div class="rank-price">{p['price']}</div>
      </div>
      <a href="{p['url']}" target="_blank" rel="noopener sponsored" class="rank-img-link">
        <img src="{p['image']}" alt="{p['name']}" loading="lazy" class="rank-img">
      </a>
    </div>"""
    return items_html

def generate_html(topic, products_top, products_mid, products_all):
    c = THEME_COLORS.get(topic["theme"], THEME_COLORS["blue"])
    today = datetime.now().strftime("%Y년 %m월 %d일")
    year  = datetime.now().year
    canonical = f"{SITE_URL}/kor/report/{CAT_TO_DIR.get(topic['cat'], 'general')}/{topic['slug']}.html"
    tags_str = " ".join(f"#{t}" for t in topic["tags"])
    items_html = build_items_html(topic, products_all)
    ad_top = ad_block_html(f"{topic['icon']} 지금 인기 상품", products_top)
    ad_mid = ad_block_html("🛒 함께 보면 좋은 상품", products_mid)
    ad_bot = ad_block_html("✅ 오늘의 추천", products_top[:5])

    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','{GA_ID}');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE}" crossorigin="anonymous"></script>
<title>{topic['title']} | {year} 최신 추천</title>
<meta name="description" content="{topic['desc']} {tags_str}">
<meta name="keywords" content="{', '.join(topic['tags'])}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{topic['title']}">
<meta property="og:description" content="{topic['desc']}">
<meta property="og:url" content="{canonical}">
<meta property="og:type" content="article">
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"Article","headline":"{topic['title']}",
"description":"{topic['desc']}","datePublished":"{datetime.now().strftime('%Y-%m-%d')}",
"dateModified":"{datetime.now().strftime('%Y-%m-%d')}","url":"{canonical}"}}
</script>
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f0f4f8;color:#333;line-height:1.7;}}
.wrap{{max-width:860px;margin:0 auto;padding:16px 14px 40px;}}
header{{background:linear-gradient(135deg,{c['h1bg']},{c['h1end']});color:#fff;text-align:center;
  padding:48px 20px 36px;border-radius:14px;margin-bottom:24px;box-shadow:0 4px 20px rgba(0,0,0,.2);}}
header h1{{font-size:1.65rem;line-height:1.35;margin-bottom:10px;letter-spacing:-.3px;}}
header .sub{{opacity:.88;font-size:.93rem;margin-bottom:14px;}}
.badges{{display:flex;justify-content:center;flex-wrap:wrap;gap:7px;}}
.badge{{background:rgba(255,255,255,.18);border-radius:20px;padding:4px 13px;font-size:.78rem;}}
.intro{{background:#fff;border-radius:12px;padding:20px 22px;margin-bottom:20px;
  box-shadow:0 2px 8px rgba(0,0,0,.07);border-left:5px solid {c['accent']};
  font-size:.95rem;color:#444;line-height:1.8;}}
.section{{background:#fff;border-radius:12px;padding:22px;margin-bottom:20px;
  box-shadow:0 2px 8px rgba(0,0,0,.07);}}
.section h2{{font-size:1.1rem;color:{c['h1bg']};margin-bottom:14px;
  border-bottom:2px solid {c['light']};padding-bottom:9px;}}
.rank-item{{display:flex;align-items:center;gap:12px;padding:12px 0;
  border-bottom:1px solid #f0f0f0;}}
.rank-item:last-child{{border-bottom:none;}}
.rank-num{{font-size:1.3rem;min-width:36px;text-align:center;}}
.rank-content{{flex:1;min-width:0;}}
.rank-name{{font-size:.92rem;font-weight:600;color:#333;text-decoration:none;display:block;
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}}
.rank-name:hover{{color:{c['accent']};}}
.rank-price{{font-size:.85rem;color:#e8231a;font-weight:700;margin-top:3px;}}
.rank-rocket{{font-size:.65rem;background:#e8231a;color:#fff;padding:1px 5px;
  border-radius:3px;margin-left:5px;vertical-align:middle;}}
.rank-img-link{{flex-shrink:0;}}
.rank-img{{width:70px;height:70px;object-fit:contain;border-radius:8px;
  background:#f9f9f9;border:1px solid #eee;}}
.tip-box{{background:{c['light']};border-radius:10px;padding:16px 18px;margin-bottom:14px;
  border-left:4px solid {c['border']};font-size:.9rem;color:#444;line-height:1.7;}}
.tip-box strong{{color:{c['h1bg']};}}
.breadcrumb{{font-size:.8rem;color:#999;margin-bottom:14px;}}
.breadcrumb a{{color:{c['accent']};text-decoration:none;}}
footer{{text-align:center;padding:20px;color:#aaa;font-size:.8rem;}}
footer a{{color:{c['accent']};text-decoration:none;}}
.cp3-wrap{{margin:18px 0;}}
.cp3-box{{background:#fff;border:1px solid #e8e8e8;border-radius:10px;padding:14px 16px;
  box-shadow:0 1px 6px rgba(0,0,0,.06);}}
.cp3-title{{font-size:.88rem;font-weight:700;color:#555;margin-bottom:10px;
  border-left:3px solid #e8231a;padding-left:8px;}}
.cp3-row{{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;}}
.cp3-row::-webkit-scrollbar{{height:4px;}}
.cp3-row::-webkit-scrollbar-thumb{{background:#ddd;border-radius:2px;}}
.cp3-card{{flex:0 0 110px;text-decoration:none;color:inherit;}}
.cp3-card img{{width:110px;height:110px;object-fit:contain;border-radius:6px;
  background:#f9f9f9;display:block;border:1px solid #eee;}}
.cp3-name{{font-size:.72rem;color:#333;line-height:1.3;margin-top:5px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}}
.cp3-price{{font-size:.8rem;color:#e8231a;font-weight:700;margin-top:3px;}}
.cp3-rocket{{font-size:.63rem;background:#e8231a;color:#fff;padding:1px 4px;
  border-radius:3px;margin-left:3px;}}
.cp3-notice{{font-size:.67rem;color:#ccc;margin-top:8px;}}
@media(max-width:600px){{
  header h1{{font-size:1.25rem;}}
  .rank-img{{width:56px;height:56px;}}
}}
</style>
</head>
<body>
<div class="wrap">
  <div class="breadcrumb">
    <a href="{SITE_URL}">홈</a> › <a href="{SITE_URL}/kor/report/{CAT_TO_DIR.get(topic['cat'],'general')}/index.html">{topic['cat'].upper()}</a> › {topic['title'][:30]}…
  </div>

  <header>
    <h1>{topic['icon']} {topic['title']}</h1>
    <div class="sub">{topic['desc']}</div>
    <div class="badges">
      {''.join(f'<span class="badge">#{t}</span>' for t in topic["tags"])}
      <span class="badge">📅 {today} 업데이트</span>
    </div>
  </header>

  {ad_top}

  <div class="intro">{topic['desc']} 실제 구매자 리뷰와 쿠팡 인기 순위를 기반으로 엄선했습니다. 아래 목록을 참고해 현명한 쇼핑을 즐기세요.</div>

  <div class="section">
    <h2>📋 {year} 추천 BEST 19</h2>
    {items_html}
  </div>

  {ad_mid}

  <div class="section">
    <h2>💡 구매 전 체크포인트</h2>
    <div class="tip-box"><strong>✅ 리뷰 확인</strong> — 최근 3개월 내 리뷰가 많은 상품일수록 현재 품질을 신뢰할 수 있습니다.</div>
    <div class="tip-box"><strong>✅ 로켓배송 여부</strong> — 급하게 필요하다면 로켓배송 상품을 우선 선택하세요.</div>
    <div class="tip-box"><strong>✅ 가격 비교</strong> — 쿠팡 내에서도 판매자마다 가격이 다를 수 있으니 옵션을 꼼꼼히 확인하세요.</div>
    <div class="tip-box"><strong>✅ 반품 정책</strong> — 사이즈·컬러가 있는 상품은 반품 조건을 미리 확인하세요.</div>
  </div>

  {ad_bot}

  <p style="font-size:.76rem;color:#bbb;text-align:center;margin-top:8px;">
    이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
  </p>
</div>
<script src="/js/coupang-loader.js" defer></script>
</body>
</html>"""


# ── git push ──────────────────────────────────────────────────────
def ensure_git_work():
    """GIT_WORK 디렉토리 준비 (없으면 클론, 있으면 pull)"""
    if not os.path.exists(GIT_WORK):
        print("  📦 git 클론 중...")
        subprocess.run(["git", "clone", GIT_REMOTE, GIT_WORK],
                       check=True, capture_output=True)
    else:
        subprocess.run(["git", "-C", GIT_WORK, "pull", "--rebase"],
                       capture_output=True)
    subprocess.run(["git", "-C", GIT_WORK, "config", "user.email", "qordltkr124@gmail.com"],
                   check=True, capture_output=True)
    subprocess.run(["git", "-C", GIT_WORK, "config", "user.name", "emfls"],
                   check=True, capture_output=True)

def git_push(rel_files, message):
    """rel_files: REPO_DIR 기준 상대경로 목록"""
    try:
        ensure_git_work()
        # 파일 복사
        for rel in rel_files:
            src = os.path.join(REPO_DIR, rel)
            dst = os.path.join(GIT_WORK, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if os.path.exists(src):
                import shutil
                shutil.copy2(src, dst)
        # add / commit / push
        subprocess.run(["git", "-C", GIT_WORK, "add", "-A"],
                       check=True, capture_output=True)
        subprocess.run(["git", "-C", GIT_WORK, "commit", "-m", message],
                       check=True, capture_output=True)
        subprocess.run(["git", "-C", GIT_WORK, "push"],
                       check=True, capture_output=True)
        print(f"  ✅ git push 완료: {message}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ⚠ git 오류: {e.stderr.decode() if e.stderr else e}")
        return False


# ── 상태 파일 (이미 발행한 슬러그 추적) ──────────────────────────
STATE_FILE = os.path.join(REPO_DIR, ".published_slugs.json")

def load_published():
    if os.path.exists(STATE_FILE):
        return set(json.load(open(STATE_FILE)))
    return set()

def save_published(slugs):
    json.dump(list(slugs), open(STATE_FILE, "w"))


# ── 메인 ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="트렌드 주제 자동 글 발행")
    parser.add_argument("--count", "-n", type=int, default=3, help="발행할 글 수 (기본 3)")
    parser.add_argument("--reset", action="store_true", help="발행 이력 초기화 후 전체 재발행")
    parser.add_argument("--dry-run", action="store_true", help="파일 저장/push 없이 테스트")
    args = parser.parse_args()

    published = load_published()
    if args.reset:
        published = set()
        print("🔄 발행 이력 초기화")

    # 미발행 주제 선택
    pending = [t for t in TOPIC_BANK if t["slug"] not in published]
    if not pending:
        print("✅ 모든 주제 발행 완료. --reset 으로 재시작하세요.")
        return

    targets = pending[:args.count]
    print(f"\n🚀 발행 시작: {len(targets)}개 주제\n")

    new_files = []
    for topic in targets:
        print(f"📝 [{topic['slug']}] {topic['title']}")

        # 쿠팡 상품 가져오기
        print(f"  🔍 쿠팡 상품 검색: {topic['keyword']}")
        products = fetch_products(topic["keyword"], 10)
        time.sleep(1.5)

        if not products:
            print("  ⚠ 상품 없음, 건너뜀")
            continue

        products_all = products
        products_top = products[:5]
        products_mid = products[5:10]

        # HTML 생성
        html = generate_html(topic, products_top, products_mid, products_all)

        # 저장 경로
        cat_dir = CAT_TO_DIR.get(topic["cat"], "general")
        out_dir = os.path.join(REPO_DIR, "kor", "report", cat_dir)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"{topic['slug']}.html")

        if args.dry_run:
            print(f"  [dry-run] 저장 생략: {out_path}")
        else:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"  💾 저장: {out_path}")
            new_files.append(os.path.relpath(out_path, REPO_DIR))
            published.add(topic["slug"])

        print()

    # git push + 텔레그램 알림
    if new_files and not args.dry_run:
        save_published(published)
        new_files.append(".published_slugs.json")
        article_count = len(new_files) - 1
        commit_msg = f"자동 발행: 추천형 글 {article_count}개 ({datetime.now().strftime('%Y-%m-%d %H:%M')})"
        pushed = git_push(new_files, commit_msg)

        if pushed:
            # 텔레그램 알림 전송
            url_lines = ""
            for topic in targets:
                if topic["slug"] in published:
                    cat_dir = CAT_TO_DIR.get(topic["cat"], "general")
                    url = f"{SITE_URL}/kor/report/{cat_dir}/{topic['slug']}.html"
                    url_lines += f"\n• <a href='{url}'>{topic['title'][:35]}…</a>"

            tg_msg = (
                f"✅ <b>새 글 {article_count}개 발행 완료</b>\n"
                f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
                f"{url_lines}\n\n"
                f"📊 남은 주제: {len(pending) - len(targets)}개"
            )
            send_telegram(tg_msg)

    print(f"\n✅ 완료 — {len(new_files)-1 if new_files else 0}개 발행")
    print(f"   남은 주제: {len(pending) - len(targets)}개")


if __name__ == "__main__":
    main()
