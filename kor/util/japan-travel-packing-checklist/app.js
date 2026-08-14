(function (root) {
  function buildJapanPackingList(options) {
    const season = ['spring', 'summer', 'autumn', 'winter'].includes(options.season) ? options.season : 'spring';
    const rows = [
      ['D-30', '서류', '여권 유효기간 확인'], ['D-30', '예약', '항공권과 숙소 예약 확인'],
      ['D-7', '입국', 'Visit Japan Web 최신 안내 확인'], ['D-7', '통신', 'eSIM·유심·로밍 선택'],
      ['D-7', '결제', '엔화 현금과 해외결제 수단 준비'], ['D-1', '전자기기', '110V 대응 충전기와 A형 플러그 확인'],
      ['D-1', '안전', '여행자보험 증서와 비상 연락처'], ['D-1', '의류', `${Math.max(1, Number(options.days) || 1)}일 일정 의류`]
    ];
    if (season === 'winter') rows.push(['D-1', '의류', '방한 외투와 보온 내의']);
    if (season === 'summer') rows.push(['D-1', '의류', '통풍되는 옷과 자외선 차단제']);
    if (season === 'spring' || season === 'autumn') rows.push(['D-1', '의류', '일교차 대비 얇은 겉옷']);
    if (options.checkedBag) rows.push(['D-7', '수하물', '위탁수하물 규정 확인']);
    if (options.children) rows.push(['D-1', '어린이', '어린이 상비약과 보호자 연락처']);
    const seen = new Set();
    return rows.filter((row) => !seen.has(row[2]) && seen.add(row[2])).map(([phase, category, item]) => ({ phase, category, item }));
  }
  root.buildJapanPackingList = buildJapanPackingList;
  if (typeof module !== 'undefined') module.exports = { buildJapanPackingList };
  if (typeof document !== 'undefined') {
    const analytics = document.createElement('script');
    analytics.src = '/kor/util/tool-analytics.js';
    document.head.appendChild(analytics);
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('make')?.addEventListener('click', () => {
        if (typeof root.trackToolCompletion === 'function') root.trackToolCompletion('japan_packing', 'generated');
      });
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
