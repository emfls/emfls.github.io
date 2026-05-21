"""
쿠팡 파트너스 블록 3위치 주입 (상단 / 중간 / 하단)
────────────────────────────────────────────────────
전략:
  - 카테고리당 API 최대 3회 호출 (상단·중간·하단 다른 키워드)
  - 같은 블록 HTML을 카테고리 전체 페이지에 재사용 (API 절약)
  - 게임 페이지 자동 제외 (nikke / maplestory / sevenknights / mabinogi)
  - 이미 3위치 모두 처리된 페이지 스킵
  - Rate limit 감지 시 나머지 카테고리 중단
"""

import re
import time
import os as _os
import json
from pathlib import Path

REPO_ROOT = Path(_os.environ.get("SITE_ROOT", str(Path(__file__).parent.parent)))

from coupang_api import products_html, COUPANG_STYLE, is_rate_limited

# 마커: 위치별로 구분
MARKER_TOP = "cp-injected-top"
MARKER_MID = "cp-injected-mid"
MARKER_BOT = "cp-injected-bot"

# 실제 플레이어블 게임 페이지 폴더 (제외) — /game/, /vn/game/, /ae/game/ 등
GAME_DIR_PATTERN = re.compile(r'[\\/]game[\\/]')

# ── 카테고리별 상단/중간/하단 키워드 정의 ─────────────────────────────
# 형식: "경로": (상단키워드, 중간키워드, 하단키워드, 상단제목, 중간제목, 하단제목)
CATEGORIES = {
    # ── 한국어 여행 (5411개) ──────────────────────────────────────
    "kor/report/travel": (
        ("여행 캐리어 추천",     "✈️ 여행 준비 필수품"),
        ("여행 파우치 소품",     "🧳 여행 소품 모음"),
        ("여권 지갑 여행용품",   "💼 여행 마무리 아이템"),
    ),
    # ── 암호화폐 (510개) ─────────────────────────────────────────
    "kor/report/coin": (
        ("암호화폐 하드웨어 지갑", "🔐 코인 보안 지갑"),
        ("재테크 투자 책",        "📚 투자 도서 추천"),
        ("노트북 추천 가성비",    "💻 투자자 필수 기기"),
    ),
    # ── 비자·해외 (186개) ────────────────────────────────────────
    "kor/report/visa": (
        ("여권 지갑 여행",        "✈️ 해외여행 필수품"),
        ("여행 캐리어 추천",      "🧳 캐리어 추천"),
        ("여행 보험 필수 용품",   "💊 해외여행 상비약"),
    ),
    # ── 캠핑 (169개) ─────────────────────────────────────────────
    "kor/report/camp": (
        ("캠핑 텐트 추천",        "⛺ 캠핑 텐트 추천"),
        ("캠핑 의자 테이블",      "🪑 캠핑 가구"),
        ("캠핑 랜턴 버너",        "🔦 캠핑 조명·취사"),
    ),
    # ── PC·윈도우 (127개) ────────────────────────────────────────
    "kor/report/window": (
        ("노트북 추천 가성비",    "💻 노트북 추천"),
        ("무선 키보드 마우스",    "⌨️ 키보드·마우스"),
        ("모니터 추천 가성비",    "🖥️ 모니터 추천"),
    ),
    # ── 한국 주식 (110개) ────────────────────────────────────────
    "kor/report/stock": (
        ("주식 투자 책 추천",     "📈 투자 도서"),
        ("재테크 책 경제",        "💰 재테크 도서"),
        ("태블릿 추천 업무",      "📱 투자자 필수 기기"),
    ),
    "kor/report/stock/2025": (
        ("주식 투자 책 추천",     "📈 투자 도서"),
        ("재테크 책 경제",        "💰 재테크 도서"),
        ("태블릿 추천 업무",      "📱 투자자 필수 기기"),
    ),
    # ── 미국 주식 한국어 (30개) ───────────────────────────────────
    "kor/report/stock/us": (
        ("미국 주식 투자 책",     "🇺🇸 미국주식 도서"),
        ("영어 경제 도서",        "📖 경제 원서"),
        ("재테크 책 경제",        "💰 재테크 도서"),
    ),
    # ── 반려동물 (35개) ──────────────────────────────────────────
    "kor/report/animal": (
        ("강아지 사료 추천",      "🐶 반려견 용품"),
        ("고양이 사료 장난감",    "🐱 반려묘 용품"),
        ("반려동물 간식",         "🐾 반려동물 간식"),
    ),
    # ── 재테크 (16개) ────────────────────────────────────────────
    "kor/report/finance": (
        ("재테크 책 투자",        "💰 재테크 도서"),
        ("가계부 추천",           "📒 가계부 추천"),
        ("주식 투자 책 추천",     "📈 투자 도서"),
    ),
    # ── 자동차 (15개) ────────────────────────────────────────────
    "kor/report/car": (
        ("차량 방향제 추천",      "🚗 차량 용품"),
        ("블랙박스 추천",         "📹 블랙박스"),
        ("차량 청소 용품",        "🧹 차량 청소"),
    ),
    # ── 캠핑기어 (11개) ──────────────────────────────────────────
    "kor/report/camp-gear": (
        ("캠핑 용품 추천",        "⛺ 캠핑 용품"),
        ("캠핑 침낭 매트",        "🛏️ 침낭·매트"),
        ("캠핑 버너 코펠",        "🍳 취사 용품"),
    ),
    # ── 정부지원 (10개) ──────────────────────────────────────────
    "kor/report/gov": (
        ("생활 용품 추천 가성비", "🏠 생활 필수품"),
        ("가성비 주방용품",       "🍽️ 주방 용품"),
        ("청소 용품 추천",        "🧹 청소 용품"),
    ),
    # ── 계절 (8개) ───────────────────────────────────────────────
    "kor/report/seasonal": (
        ("여름 냉방 용품",        "🌡️ 냉방 용품"),
        ("제습기 추천",           "💧 제습기"),
        ("선풍기 에어컨 추천",    "❄️ 냉방 가전"),
    ),
    # ── 건강 (8개) ───────────────────────────────────────────────
    "kor/report/health": (
        ("혈압계 가정용",         "🩺 건강 측정기"),
        ("혈당계 추천",           "💊 혈당 관리"),
        ("영양제 추천",           "🌿 건강 보조제"),
    ),
    # ── 비교 리뷰 (8개) ──────────────────────────────────────────
    "kor/report/compare": (
        ("생활 가전 추천",        "🔍 추천 가전"),
        ("가성비 가전 제품",      "📦 가성비 제품"),
        ("스마트홈 추천",         "🏠 스마트홈"),
    ),
    # ── IT (7개) ─────────────────────────────────────────────────
    "kor/report/it": (
        ("와이파이 공유기 추천",  "📡 공유기 추천"),
        ("게이밍 마우스 추천",    "🖱️ 마우스 추천"),
        ("SSD 추천 가성비",       "💾 SSD 추천"),
    ),
    # ── 선물 (6개) ───────────────────────────────────────────────
    "kor/report/gift": (
        ("스승의날 선물 추천",    "🎁 선생님 선물"),
        ("부모님 선물 추천",      "🎀 부모님 선물"),
        ("친구 생일 선물",        "🎊 생일 선물"),
    ),
    # ── 피트니스 (6개) ───────────────────────────────────────────
    "kor/report/fitness": (
        ("요가매트 추천",         "🧘 요가매트"),
        ("덤벨 홈트 추천",        "💪 홈트 용품"),
        ("폼롤러 스트레칭",       "🏋️ 스트레칭 용품"),
    ),
    # ── 여름 패션 (6개) ──────────────────────────────────────────
    "kor/report/fashion": (
        ("남성 반팔 티셔츠",      "👕 남성 여름 의류"),
        ("여성 여름 원피스",      "👗 여성 여름 의류"),
        ("슬리퍼 샌들 추천",      "👡 여름 신발"),
    ),
    # ── 다이소 (6개) ─────────────────────────────────────────────
    "kor/report/daiso": (
        ("생활 용품 추천 가성비", "🛒 생활 용품"),
        ("수납 정리 용품",        "📦 수납 용품"),
        ("청소 용품 추천",        "🧹 청소 용품"),
    ),
    # ── 코스트코 (6개) ───────────────────────────────────────────
    "kor/report/costco": (
        ("견과류 대용량 추천",    "🥜 건강 식품"),
        ("생활 용품 대용량",      "🏠 생활 대용량"),
        ("프로틴 단백질 보충제",  "💪 단백질 보충"),
    ),
    # ── AI (6개) ─────────────────────────────────────────────────
    "kor/report/ai": (
        ("AI 인공지능 책 추천",   "🤖 AI 도서"),
        ("노트북 추천 가성비",    "💻 AI 작업용 노트북"),
        ("태블릿 추천 업무",      "📱 태블릿 추천"),
    ),
    # ── 육아 (4개) ───────────────────────────────────────────────
    "kor/report/parenting": (
        ("아기 장난감 교육",      "👶 유아 장난감"),
        ("유아 침구 추천",        "🛏️ 유아 침구"),
        ("아기 이유식 용품",      "🍼 이유식 용품"),
    ),
    # ── 니케 가이드 (10개) ───────────────────────────────────────
    "kor/report/nikke": (
        ("게이밍 의자 추천",      "🎮 게이밍 의자"),
        ("게이밍 헤드셋 추천",    "🎧 게이밍 헤드셋"),
        ("게이밍 마우스 추천",    "🖱️ 게이밍 마우스"),
    ),
    # ── 메이플스토리 가이드 (12개) ───────────────────────────────
    "kor/report/maple": (
        ("게이밍 의자 추천",      "🎮 게이밍 의자"),
        ("게이밍 키보드 추천",    "⌨️ 게이밍 키보드"),
        ("게이밍 헤드셋 추천",    "🎧 게이밍 헤드셋"),
    ),
    # ── 절약/저축 ────────────────────────────────────────────────
    "kor/report/saving": (
        ("가계부 추천",           "📒 가계부"),
        ("재테크 책 투자",        "💰 재테크 도서"),
        ("생활 용품 추천 가성비", "🏠 가성비 생활용품"),
    ),
    # ── 칼럼 (14개) ──────────────────────────────────────────────
    "kor/column": (
        ("재테크 책 투자",        "💰 재테크 도서"),
        ("노트북 추천 가성비",    "💻 추천 상품"),
        ("영양제 추천",           "🛒 관련 추천 상품"),
    ),
    # ── 영문 주식 (60개) ─────────────────────────────────────────
    "report/stock": (
        ("주식 투자 책 추천",     "📈 Investor Picks"),
        ("재테크 책 경제",        "📚 Finance Books"),
        ("태블릿 추천 업무",      "💻 Productivity Gear"),
    ),
    # ── 영문 암호화폐 (38개) ─────────────────────────────────────
    "report/crypto": (
        ("암호화폐 하드웨어 지갑", "🔐 Crypto Wallet"),
        ("재테크 투자 책",         "📚 Investment Books"),
        ("노트북 추천 가성비",     "💻 Trading Setup"),
    ),
    # ── 영문 SEC (29개) ──────────────────────────────────────────
    "report/sec": (
        ("주식 투자 책 추천",     "📋 Investor Picks"),
        ("재테크 책 경제",        "📚 Finance Books"),
        ("태블릿 추천 업무",      "💼 Business Gear"),
    ),
    # ── 영문 여행 (5384개) ───────────────────────────────────────
    "report/travel": (
        ("여행 캐리어 추천",      "✈️ Travel Essentials"),
        ("여행 파우치 소품",      "🧳 Travel Accessories"),
        ("여권 지갑 여행용품",    "💼 Travel Gear"),
    ),
    # ── 일문 여행 (5384개) ───────────────────────────────────────
    "jp/report/travel": (
        ("여행 캐리어 추천",      "✈️ 旅行おすすめ"),
        ("여행 파우치 소품",      "🧳 旅行グッズ"),
        ("여행 용품 추천",        "💼 旅行必需品"),
    ),
}


# ── 컴팩트 쿠팡 블록 HTML 생성 (로테이션 지원) ──────────────────────

COMPACT_STYLE = """<style id="cp3s">
.cp3-wrap{max-width:860px;margin:10px auto;padding:0 10px}
.cp3-box{background:#161b22;border:1px solid #30363d;border-radius:8px;
  padding:10px 14px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.cp3-title{font-size:.8rem;font-weight:700;color:#8b949e;margin-bottom:8px;
  border-left:3px solid #e8231a;padding-left:7px}
.cp3-row{display:flex;flex-wrap:nowrap;justify-content:center;gap:8px;
  overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}
.cp3-row::-webkit-scrollbar{height:3px}
.cp3-row::-webkit-scrollbar-thumb{background:#30363d;border-radius:2px}
.cp3-card{flex:0 0 clamp(72px,18vw,100px);text-decoration:none;color:inherit;
  transition:opacity 0.4s ease-in-out}
.cp3-card.hidden{opacity:0;pointer-events:none;position:absolute}
.cp3-card img{width:100%;aspect-ratio:1;object-fit:contain;border-radius:5px;
  background:#0d1117;display:block;border:1px solid #21262d}
.cp3-name{font-size:.68rem;color:#c9d1d9;line-height:1.3;margin-top:4px;text-align:center;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cp3-price{font-size:.72rem;color:#ff6b6b;font-weight:700;margin-top:2px;text-align:center}
.cp3-rocket{font-size:.6rem;background:#e8231a;color:#fff;padding:1px 4px;
  border-radius:3px;margin-left:2px}
.cp3-notice{font-size:.62rem;color:#484f58;margin-top:6px}
@media(max-width:480px){
  .cp3-box{padding:8px 10px}
  .cp3-card{flex:0 0 clamp(64px,20vw,80px)}
}
</style>"""

ROTATION_SCRIPT = """<script>
(function() {
  const rotators = document.querySelectorAll('[data-cp3-products]');
  if (rotators.length === 0) return;

  rotators.forEach(wrapper => {
    const products = JSON.parse(wrapper.getAttribute('data-cp3-products'));
    if (!products || products.length === 0) return;

    const cards = wrapper.querySelectorAll('.cp3-card');
    const numCards = cards.length;
    const numSets = Math.ceil(products.length / numCards);
    let currentSet = 0;

    if (numSets <= 1) return; // 1세트만 있으면 로테이션 불필요

    function updateDisplay() {
      const startIdx = currentSet * numCards;
      cards.forEach((card, i) => {
        const product = products[startIdx + i];
        if (!product) {
          card.classList.add('hidden');
          return;
        }
        card.classList.remove('hidden');
        const img = card.querySelector('img');
        const name = card.querySelector('.cp3-name');
        const price = card.querySelector('.cp3-price');
        const href = card.getAttribute('href');

        if (img) {
          img.src = product.image;
          img.alt = product.name;
        }
        if (name) {
          let nameText = product.name.substring(0, 30);
          if (product.name.length > 30) nameText += '…';
          name.innerHTML = nameText;
          if (product.is_rocket) {
            name.innerHTML += '<span class="cp3-rocket">로켓</span>';
          }
        }
        if (price) {
          price.textContent = product.price ? product.price.toLocaleString('ko-KR') + '원' : '';
        }
        if (href) {
          card.setAttribute('href', product.url);
        }
      });
    }

    updateDisplay();

    // 5초마다 다음 세트로 전환
    setInterval(() => {
      currentSet = (currentSet + 1) % numSets;
      updateDisplay();
    }, 5000);
  });
})();
</script>"""


def _build_block(keyword: str, title: str, position: str) -> str:
    """키워드로 컴팩트 쿠팡 블록 생성 (9개 상품 → 3개 세트로 로테이션)"""
    items = []
    try:
        from coupang_api import search_products
        items = search_products(keyword, limit=9)
    except Exception:
        pass
    if not items:
        return ""

    # 첫 3개 상품으로 초기 카드 생성
    cards = ""
    for i, p in enumerate(items[:3]):
        name = (p["name"] or "")[:30] + ("…" if len(p.get("name", "")) > 30 else "")
        price = f"{p['price']:,}원" if p.get("price") else ""
        img = f'<img src="{p["image"]}" alt="" loading="lazy">' if p.get("image") else ""
        rocket = '<span class="cp3-rocket">로켓</span>' if p.get("is_rocket") else ""
        cards += f"""<a class="cp3-card" href="{p['url']}" target="_blank" rel="noopener sponsored" data-idx="{i}">
      {img}
      <div class="cp3-name">{name}{rocket}</div>
      <div class="cp3-price">{price}</div>
    </a>"""

    # JSON으로 모든 18개 상품 저장 (클라이언트측 로테이션용)
    products_json = json.dumps([{
        "name": p["name"],
        "price": p["price"],
        "image": p["image"],
        "url": p["url"],
        "is_rocket": p.get("is_rocket", False)
    } for p in items], ensure_ascii=False)

    return f"""
<!-- {position} -->
<div class="cp3-wrap" data-cp3-products='{products_json}'><div class="cp3-box">
  <div class="cp3-title">{title}</div>
  <div class="cp3-row">{cards}</div>
  <div class="cp3-notice">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</div>
</div></div>"""


def _build_category_blocks(cat_cfg: tuple) -> tuple:
    """카테고리 설정에서 상단/중간/하단 블록 HTML 생성"""
    top_kw,  top_title  = cat_cfg[0]
    mid_kw,  mid_title  = cat_cfg[1]
    bot_kw,  bot_title  = cat_cfg[2]

    time.sleep(0.4)
    top_html = _build_block(top_kw,  top_title,  MARKER_TOP)
    time.sleep(0.4)
    mid_html = _build_block(mid_kw,  mid_title,  MARKER_MID)
    time.sleep(0.4)
    bot_html = _build_block(bot_kw,  bot_title,  MARKER_BOT)

    return top_html, mid_html, bot_html


# ── HTML 주입 헬퍼 ───────────────────────────────────────────────────

def _update_style(content: str) -> str:
    """기존 구버전 cp3 스타일을 최신 반응형 버전으로 교체"""
    old_style_pattern = re.compile(r'<style id="cp3s">.*?</style>', re.DOTALL)
    if old_style_pattern.search(content):
        content = old_style_pattern.sub(COMPACT_STYLE, content, count=1)
    return content


def _inject(content: str, top_html: str, mid_html: str, bot_html: str) -> str:
    """상단/중간/하단 위치에 블록 주입. 스타일은 상단 블록에만 포함(id=cp3s로 중복 방지)."""

    # 기존 스타일이 있으면 최신 반응형으로 교체
    content = _update_style(content)

    # ── 상단: </header> 뒤, 없으면 첫 <h1> 뒤, 없으면 <body> 뒤
    if top_html and MARKER_TOP not in content:
        block = COMPACT_STYLE + top_html  # 상단에만 스타일 포함
        if "</header>" in content:
            content = content.replace("</header>", "</header>" + block, 1)
        elif "<h1" in content:
            content = re.sub(r'(<h1[^>]*>.*?</h1>)', r'\1' + block, content, count=1, flags=re.DOTALL)
        elif "<body" in content:
            content = re.sub(r'(<body[^>]*>)', r'\1' + block, content, count=1)

    # ── 중간: </section> 절반 → 없으면 중간 <h2> → 없으면 </main> → 없으면 </article>
    if mid_html and MARKER_MID not in content:
        block = mid_html  # 스타일 없음 (상단에서 이미 로드됨)
        section_ends = [m.end() for m in re.finditer(r'</section>', content)]
        h2_matches = list(re.finditer(r'<h2[\s>]', content))
        if len(section_ends) >= 2:
            pos = section_ends[len(section_ends) // 2]
            content = content[:pos] + block + content[pos:]
        elif len(h2_matches) >= 2:
            pos = h2_matches[len(h2_matches) // 2].start()
            content = content[:pos] + block + content[pos:]
        elif "</main>" in content:
            content = content.replace("</main>", block + "</main>", 1)
        elif "</article>" in content:
            content = content.replace("</article>", block + "</article>", 1)

    # ── 하단: </body> 바로 앞
    if bot_html and MARKER_BOT not in content:
        block = bot_html  # 스타일 없음
        content = content.replace("</body>", block + "\n</body>", 1)

    # ── 로테이션 스크립트: </body> 바로 앞 (한 번만 추가)
    if (top_html or mid_html or bot_html) and "data-cp3-products" in content and ROTATION_SCRIPT not in content:
        content = content.replace("</body>", ROTATION_SCRIPT + "\n</body>", 1)

    return content


def _is_game_page(path: Path) -> bool:
    """실제 플레이어블 게임 페이지인지 확인 (/game/ 폴더)"""
    return bool(GAME_DIR_PATTERN.search(str(path)))


def _needs_injection(content: str) -> bool:
    """아직 처리되지 않은 위치가 있는지 확인"""
    return not (MARKER_TOP in content and MARKER_MID in content and MARKER_BOT in content)


# ── 디렉토리별 주입 ─────────────────────────────────────────────────

def inject_directory(rel_path: str, cat_cfg: tuple) -> tuple:
    """
    디렉토리 내 모든 HTML에 3위치 블록 주입.
    반환: (주입파일수, 스킵파일수, API실패여부)
    """
    global _style_injected
    folder = REPO_ROOT / rel_path
    if not folder.exists():
        return 0, 0, False

    # HTML 파일 목록 (index 및 기타 제외)
    skip_names = {"index.html", "sitemap.html", "sitemap_test.html"}
    html_files = [
        f for f in sorted(folder.glob("*.html"))
        if f.name not in skip_names and not _is_game_page(f)
    ]
    if not html_files:
        return 0, 0, False

    # 처리 필요한 파일이 있는지 먼저 확인 (불필요한 API 호출 방지)
    needs_work = any(
        _needs_injection(f.read_text(encoding="utf-8", errors="ignore"))
        for f in html_files[:5]  # 샘플 5개만 체크
    )
    if not needs_work:
        return 0, len(html_files), False

    # API 호출 (카테고리당 1세트)
    _style_injected = False  # 카테고리 처음에 스타일 리셋
    top_html, mid_html, bot_html = _build_category_blocks(cat_cfg)
    if not top_html and not mid_html and not bot_html:
        return 0, 0, True  # API 실패

    injected = skipped = 0
    for f in html_files:
        try:
            content = f.read_text(encoding="utf-8", errors="ignore")
            if not _needs_injection(content):
                skipped += 1
                continue
            if "</body>" not in content:
                skipped += 1
                continue
            new_content = _inject(content, top_html, mid_html, bot_html)
            if new_content != content:
                f.write_text(new_content, encoding="utf-8")
                injected += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"    [오류] {f.name}: {e}")

    return injected, skipped, False


# ── 메인 ─────────────────────────────────────────────────────────────

def main():
    print("  [쿠팡 3위치 주입] 시작")
    total_injected = total_skipped = total_failed = 0

    for rel_path, cat_cfg in CATEGORIES.items():
        if is_rate_limited():
            print("    ⛔ Rate limit — 나머지 카테고리 중단")
            break

        injected, skipped, failed = inject_directory(rel_path, cat_cfg)
        total_injected += injected
        total_skipped  += skipped
        if failed:
            total_failed += 1

        if injected > 0:
            print(f"    ✅ {rel_path}: {injected}개 주입 ({skipped}개 스킵)")
        elif failed:
            print(f"    ⚠️  {rel_path}: API 실패")
        else:
            print(f"    ⏭️  {rel_path}: 모두 처리됨 ({skipped}개 스킵)")

    print(f"\n  → 총 {total_injected}개 주입 / {total_skipped}개 스킵 / {total_failed}개 API 실패")


if __name__ == "__main__":
    main()
