/**
 * 쿠팡 파트너스 중앙 로더
 * /kor/data/coupang-products.json에서 상품 로드 → 상단/중간/하단에 랜덤 표시
 */

(function() {
  // 페이지의 카테고리 감지
  function detectCategory() {
    // 우선순위 1: data-coupang-category 속성
    const categoryAttr = document.body.getAttribute('data-coupang-category');
    if (categoryAttr) return categoryAttr;

    // 우선순위 2: meta[name="category"] 태그
    const metaCategory = document.querySelector('meta[name="category"]');
    if (metaCategory) return metaCategory.getAttribute('content');

    // 우선순위 3: URL 경로 분석
    const path = window.location.pathname;
    if (path.includes('/column/')) return 'general';
    if (path.includes('/report/travel')) return 'travel';
    if (path.includes('/report/coin')) return 'coin';
    if (path.includes('/report/visa')) return 'visa';
    if (path.includes('/report/camp')) return 'camp';
    if (path.includes('/report/window')) return 'window';
    if (path.includes('/report/stock')) return 'stock';
    if (path.includes('/report/finance')) return 'finance';
    if (path.includes('/report/car')) return 'car';
    if (path.includes('/report/health')) return 'health';
    if (path.includes('/report/it')) return 'it';
    if (path.includes('/report/fashion')) return 'fashion';
    if (path.includes('/report/fitness')) return 'fitness';

    return 'general';
  }

  // JSON에서 상품 로드
  async function loadProducts() {
    try {
      const response = await fetch('/kor/data/coupang-products.json');
      if (!response.ok) throw new Error('Failed to load products');
      return await response.json();
    } catch (e) {
      console.error('[쿠팡] JSON 로드 실패:', e);
      return null;
    }
  }

  // 랜덤 선택 (중복 제거)
  function selectRandom(array, count) {
    if (!array || array.length === 0) return [];
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // 쿠팡 블록 HTML 생성
  function buildBlock(products, position, title) {
    if (!products || products.length === 0) return '';

    const cards = products.map(p => {
      const name = (p.name || '').substring(0, 30) + (p.name?.length > 30 ? '…' : '');
      const price = p.price ? p.price.toLocaleString('ko-KR') + '원' : '';
      const rocket = p.is_rocket ? '<span class="cp3-rocket">로켓</span>' : '';
      const img = p.image ? `<img src="${p.image}" alt="" loading="lazy">` : '';

      return `<a class="cp3-card" href="${p.url}" target="_blank" rel="noopener sponsored">
        ${img}
        <div class="cp3-name">${name}${rocket}</div>
        <div class="cp3-price">${price}</div>
      </a>`;
    }).join('');

    return `
<!-- ${position} -->
<div class="cp3-wrap"><div class="cp3-box">
  <div class="cp3-title">${title}</div>
  <div class="cp3-row">${cards}</div>
  <div class="cp3-notice">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</div>
</div></div>`;
  }

  // 스타일 주입 (한 번만)
  function injectStyle() {
    if (document.getElementById('cp-loader-style')) return;

    const style = document.createElement('style');
    style.id = 'cp-loader-style';
    style.textContent = `
.cp3-wrap{max-width:860px;margin:10px auto;padding:0 10px}
.cp3-box{background:#161b22;border:1px solid #30363d;border-radius:8px;
  padding:10px 14px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.cp3-title{font-size:.8rem;font-weight:700;color:#8b949e;margin-bottom:8px;
  border-left:3px solid #e8231a;padding-left:7px}
.cp3-row{display:flex;flex-wrap:nowrap;justify-content:center;gap:8px;
  overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}
.cp3-row::-webkit-scrollbar{height:3px}
.cp3-row::-webkit-scrollbar-thumb{background:#30363d;border-radius:2px}
.cp3-card{flex:0 0 clamp(72px,18vw,100px);text-decoration:none;color:inherit}
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
}`;
    document.head.appendChild(style);
  }

  // 블록 주입
  function injectBlock(html, position) {
    if (!html) return;

    if (position === 'top') {
      const header = document.querySelector('header');
      const h1 = document.querySelector('h1');
      if (header) {
        header.insertAdjacentHTML('afterend', html);
      } else if (h1) {
        h1.insertAdjacentHTML('afterend', html);
      } else {
        document.body.insertAdjacentHTML('afterbegin', html);
      }
    } else if (position === 'mid') {
      const sections = document.querySelectorAll('section');
      const h2s = document.querySelectorAll('h2');
      if (sections.length >= 2) {
        sections[Math.floor(sections.length / 2)].insertAdjacentHTML('afterend', html);
      } else if (h2s.length >= 2) {
        h2s[Math.floor(h2s.length / 2)].insertAdjacentHTML('afterend', html);
      } else {
        const main = document.querySelector('main');
        if (main) {
          main.insertAdjacentHTML('beforeend', html);
        }
      }
    } else if (position === 'bot') {
      const article = document.querySelector('article');
      if (article) {
        article.insertAdjacentHTML('afterend', html);
      } else {
        document.body.insertAdjacentHTML('beforeend', html);
      }
    }
  }

  // 메인 로직
  async function init() {
    const products = await loadProducts();
    if (!products) return;

    const category = detectCategory();
    const categoryProducts = products[category];
    if (!categoryProducts || categoryProducts.length === 0) return;

    injectStyle();

    // 상단/중간/하단에 각각 3개씩 랜덤
    const top3 = selectRandom(categoryProducts, 3);
    const mid3 = selectRandom(categoryProducts, 3);
    const bot3 = selectRandom(categoryProducts, 3);

    const topHtml = buildBlock(top3, 'cp-injected-top', '추천 상품');
    const midHtml = buildBlock(mid3, 'cp-injected-mid', '함께 보기');
    const botHtml = buildBlock(bot3, 'cp-injected-bot', '관심 상품');

    injectBlock(topHtml, 'top');
    injectBlock(midHtml, 'mid');
    injectBlock(botHtml, 'bot');
  }

  // DOM 준비 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
