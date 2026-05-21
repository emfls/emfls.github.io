/**
 * 쿠팡 파트너스 중앙 로더 (3초 랜덤 로테이션)
 * 간단하고 안정적한 구현
 */

(function() {
  // 페이지의 카테고리 감지
  function detectCategory() {
    const categoryAttr = document.body.getAttribute('data-coupang-category');
    if (categoryAttr) return categoryAttr;

    const metaCategory = document.querySelector('meta[name="category"]');
    if (metaCategory) return metaCategory.getAttribute('content');

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

  // 스타일 주입
  function injectStyle() {
    if (document.getElementById('cp-loader-style')) return;

    const style = document.createElement('style');
    style.id = 'cp-loader-style';
    style.textContent = `
.cp-section{max-width:860px;margin:20px auto;padding:0 10px}
.cp-box{background:#161b22;border:1px solid #30363d;border-radius:8px;
  padding:10px 14px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.cp-title{font-size:.8rem;font-weight:700;color:#8b949e;margin-bottom:8px;
  border-left:3px solid #e8231a;padding-left:7px}
.cp-products{display:flex;flex-wrap:nowrap;justify-content:center;gap:8px;
  overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;min-height:140px}
.cp-products::-webkit-scrollbar{height:3px}
.cp-products::-webkit-scrollbar-thumb{background:#30363d;border-radius:2px}
.cp-card{flex:0 0 clamp(72px,18vw,100px);text-decoration:none;color:inherit;
  transition:opacity 0.4s ease-in-out;display:inline-flex;flex-direction:column;align-items:center;justify-content:flex-start;opacity:1}
.cp-card img{width:100%;aspect-ratio:1;object-fit:contain;border-radius:5px;
  background:#0d1117;border:1px solid #21262d;flex-shrink:0}
.cp-card-name{font-size:.68rem;color:#c9d1d9;line-height:1.3;margin-top:4px;text-align:center;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;width:100%}
.cp-card-price{font-size:.72rem;color:#ff6b6b;font-weight:700;margin-top:2px;text-align:center}
.cp-rocket{font-size:.6rem;background:#e8231a;color:#fff;padding:1px 4px;
  border-radius:3px;margin-left:2px;display:inline-block}
.cp-notice{font-size:.62rem;color:#484f58;margin-top:6px}
@media(max-width:480px){
  .cp-box{padding:8px 10px}
  .cp-card{flex:0 0 clamp(64px,20vw,80px)}
}`;
    document.head.appendChild(style);
  }

  // 상품 블록 HTML 생성
  function createProductCard(product) {
    const name = (product.name || '').substring(0, 30) + (product.name?.length > 30 ? '…' : '');
    const price = product.price ? product.price.toLocaleString('ko-KR') + '원' : '';
    const rocket = product.is_rocket ? '<span class="cp-rocket">로켓</span>' : '';
    const img = product.image ? `<img src="${product.image}" alt="" loading="lazy">` : '';

    return `<a class="cp-card" href="${product.url}" target="_blank" rel="noopener sponsored">
      ${img}
      <div class="cp-card-name">${name}${rocket}</div>
      <div class="cp-card-price">${price}</div>
    </a>`;
  }

  // 블록 생성 및 주입
  function createAndInjectBlock(products, position, title) {
    if (!products || products.length < 3) return null;

    // 초기 3개 상품으로 카드 생성
    const initialCards = [products[0], products[1], products[2]];
    const cardsHtml = initialCards.map(p => createProductCard(p)).join('');

    const blockHtml = `<div class="cp-section cp-${position}">
      <div class="cp-box">
        <div class="cp-title">${title}</div>
        <div class="cp-products" data-position="${position}">${cardsHtml}</div>
        <div class="cp-notice">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</div>
      </div>
    </div>`;

    // 위치별 주입
    let inserted = false;
    if (position === 'top') {
      const body = document.querySelector('body');
      if (body) {
        body.insertAdjacentHTML('afterbegin', blockHtml);
        inserted = true;
      }
    } else if (position === 'mid') {
      const main = document.querySelector('main');
      if (main) {
        main.insertAdjacentHTML('beforeend', blockHtml);
        inserted = true;
      } else {
        const container = document.querySelector('.container');
        if (container) {
          container.insertAdjacentHTML('beforeend', blockHtml);
          inserted = true;
        }
      }
    } else if (position === 'bot') {
      const body = document.querySelector('body');
      if (body) {
        body.insertAdjacentHTML('beforeend', blockHtml);
        inserted = true;
      }
    }

    if (!inserted) return null;

    return {
      position,
      products,
      selector: `.cp-products[data-position="${position}"]`,
    };
  }

  // 로테이션 시작
  function startRotation(blockInfo) {
    if (!blockInfo) return;

    const container = document.querySelector(blockInfo.selector);
    if (!container) return;

    const cards = container.querySelectorAll('.cp-card');
    if (cards.length === 0) return;

    // 3초마다 새로운 랜덤 상품으로 업데이트
    setInterval(() => {
      cards.forEach((card) => {
        // 전체 상품에서 랜덤 선택
        const randomProduct = blockInfo.products[
          Math.floor(Math.random() * blockInfo.products.length)
        ];

        // 페이드 아웃
        card.style.opacity = '0';

        setTimeout(() => {
          const img = card.querySelector('img');
          const name = card.querySelector('.cp-card-name');
          const price = card.querySelector('.cp-card-price');

          if (img) {
            img.src = randomProduct.image;
            img.alt = randomProduct.name;
          }

          if (name) {
            let nameText = randomProduct.name.substring(0, 30);
            if (randomProduct.name.length > 30) nameText += '…';
            name.innerHTML = nameText;
            if (randomProduct.is_rocket) {
              name.innerHTML += '<span class="cp-rocket">로켓</span>';
            }
          }

          if (price) {
            price.textContent = randomProduct.price
              ? randomProduct.price.toLocaleString('ko-KR') + '원'
              : '';
          }

          card.href = randomProduct.url;

          // 페이드 인
          card.style.opacity = '1';
        }, 200);
      });
    }, 3000);
  }

  // 메인 함수
  async function init() {
    const products = await loadProducts();
    if (!products) return;

    const category = detectCategory();
    const categoryProducts = products[category];
    if (!categoryProducts || categoryProducts.length < 3) return;

    injectStyle();

    // 상단/중간/하단에 블록 생성 및 로테이션 시작
    const topBlock = createAndInjectBlock(categoryProducts, 'top', '추천 상품');
    const midBlock = createAndInjectBlock(categoryProducts, 'mid', '함께 보기');
    const botBlock = createAndInjectBlock(categoryProducts, 'bot', '관심 상품');

    if (topBlock) startRotation(topBlock);
    if (midBlock) startRotation(midBlock);
    if (botBlock) startRotation(botBlock);
  }

  // DOM 준비 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
