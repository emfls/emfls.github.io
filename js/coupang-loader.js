/**
 * 쿠팡 파트너스 중앙 로더 (3초 로테이션)
 * /kor/data/coupang-products.json에서 상품 로드 → 상단/중간/하단에 3초마다 로테이션
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

  // 랜덤 선택 (중복 제거)
  function selectRandom(array, count) {
    if (!array || array.length === 0) return [];
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // 스타일 주입 (로테이션 포함)
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
  overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;min-height:140px}
.cp3-row::-webkit-scrollbar{height:3px}
.cp3-row::-webkit-scrollbar-thumb{background:#30363d;border-radius:2px}
.cp3-card{flex:0 0 clamp(72px,18vw,100px);text-decoration:none;color:inherit;
  transition:opacity 0.4s ease-in-out;display:flex;flex-direction:column;align-items:center;opacity:1}
.cp3-card.hidden{opacity:0;position:absolute;pointer-events:none}
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

  // 쿠팡 블록 생성 및 로테이션 시작
  function createRotatingBlock(allProducts, position, title) {
    if (!allProducts || allProducts.length === 0) return null;

    const containerId = `cp-${position}-container`;

    // 초기 3개 상품으로 카드 생성 (모두 포함, 나중에 숨길 예정)
    const cardsHtml = allProducts.map((p, idx) => {
      const name = (p.name || '').substring(0, 30) + (p.name?.length > 30 ? '…' : '');
      const price = p.price ? p.price.toLocaleString('ko-KR') + '원' : '';
      const rocket = p.is_rocket ? '<span class="cp3-rocket">로켓</span>' : '';
      const img = p.image ? `<img src="${p.image}" alt="" loading="lazy">` : '';
      const hidden = idx >= 3 ? 'hidden' : '';

      return `<a class="cp3-card ${hidden}" href="${p.url}" target="_blank" rel="noopener sponsored" data-idx="${idx}">
        ${img}
        <div class="cp3-name">${name}${rocket}</div>
        <div class="cp3-price">${price}</div>
      </a>`;
    }).join('');

    const blockHtml = `
<!-- ${position} -->
<div class="cp3-wrap"><div class="cp3-box">
  <div class="cp3-title">${title}</div>
  <div class="cp3-row" id="${containerId}">${cardsHtml}</div>
  <div class="cp3-notice">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</div>
</div></div>`;

    return { containerId, blockHtml, allProducts };
  }

  // 블록 주입
  function injectBlock(blockData, position) {
    if (!blockData) return blockData.containerId;

    const { blockHtml } = blockData;

    if (position === 'top') {
      const header = document.querySelector('header');
      const h1 = document.querySelector('h1');
      if (header) {
        header.insertAdjacentHTML('afterend', blockHtml);
      } else if (h1) {
        h1.insertAdjacentHTML('afterend', blockHtml);
      } else {
        document.body.insertAdjacentHTML('afterbegin', blockHtml);
      }
    } else if (position === 'mid') {
      const sections = document.querySelectorAll('section');
      const h2s = document.querySelectorAll('h2');
      if (sections.length >= 2) {
        sections[Math.floor(sections.length / 2)].insertAdjacentHTML('afterend', blockHtml);
      } else if (h2s.length >= 2) {
        h2s[Math.floor(h2s.length / 2)].insertAdjacentHTML('afterend', blockHtml);
      } else {
        const main = document.querySelector('main');
        if (main) {
          main.insertAdjacentHTML('beforeend', blockHtml);
        }
      }
    } else if (position === 'bot') {
      const article = document.querySelector('article');
      if (article) {
        article.insertAdjacentHTML('afterend', blockHtml);
      } else {
        document.body.insertAdjacentHTML('beforeend', blockHtml);
      }
    }

    return blockData.containerId;
  }

  // 로테이션 시작
  function startRotation(containerId, products) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cards = container.querySelectorAll('.cp3-card');
    const totalItems = products.length;
    const itemsPerPage = 3;
    const totalSets = Math.ceil(totalItems / itemsPerPage);

    if (totalSets <= 1) return; // 3개 이하면 로테이션 불필요

    let currentSet = 0;

    // 초기 상태: 처음 3개만 보임
    cards.forEach((card, idx) => {
      if (idx < itemsPerPage) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });

    // 3초마다 로테이션
    setInterval(() => {
      currentSet = (currentSet + 1) % totalSets;
      const startIdx = currentSet * itemsPerPage;

      cards.forEach((card, displayIdx) => {
        const productIdx = startIdx + displayIdx;
        const product = products[productIdx];

        if (product) {
          // 페이드 아웃
          card.style.opacity = '0';

          // 데이터 업데이트
          setTimeout(() => {
            const img = card.querySelector('img');
            const name = card.querySelector('.cp3-name');
            const price = card.querySelector('.cp3-price');

            if (img) {
              img.src = product.image;
              img.alt = product.name;
            }
            if (name) {
              let nameText = product.name.substring(0, 30);
              if (product.name.length > 30) nameText += '…';
              name.textContent = nameText;
              if (product.is_rocket) {
                name.innerHTML = nameText + '<span class="cp3-rocket">로켓</span>';
              }
            }
            if (price) {
              price.textContent = product.price ? product.price.toLocaleString('ko-KR') + '원' : '';
            }
            card.href = product.url;

            // 페이드 인
            card.style.opacity = '1';
          }, 200);
        }
      });
    }, 3000);
  }

  // 메인 로직
  async function init() {
    const products = await loadProducts();
    if (!products) return;

    const category = detectCategory();
    const categoryProducts = products[category];
    if (!categoryProducts || categoryProducts.length === 0) return;

    injectStyle();

    // 상단/중간/하단에 각각 충분한 상품 선택 (로테이션용)
    const topProducts = selectRandom(categoryProducts, Math.min(categoryProducts.length, 12));
    const midProducts = selectRandom(categoryProducts, Math.min(categoryProducts.length, 12));
    const botProducts = selectRandom(categoryProducts, Math.min(categoryProducts.length, 12));

    // 블록 생성
    const topBlock = createRotatingBlock(topProducts, 'cp-injected-top', '추천 상품');
    const midBlock = createRotatingBlock(midProducts, 'cp-injected-mid', '함께 보기');
    const botBlock = createRotatingBlock(botProducts, 'cp-injected-bot', '관심 상품');

    // 주입
    const topId = injectBlock(topBlock, 'top');
    const midId = injectBlock(midBlock, 'mid');
    const botId = injectBlock(botBlock, 'bot');

    // 로테이션 시작
    if (topId) startRotation(topId, topProducts);
    if (midId) startRotation(midId, midProducts);
    if (botId) startRotation(botId, botProducts);
  }

  // DOM 준비 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
