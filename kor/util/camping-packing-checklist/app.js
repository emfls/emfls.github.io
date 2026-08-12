(function (root) {
  function buildCampingList(options) {
    const people = Math.min(12, Math.max(1, Number(options.people) || 1));
    const season = ['spring', 'summer', 'autumn', 'winter'].includes(options.season) ? options.season : 'spring';
    const type = ['auto', 'backpacking', 'glamping'].includes(options.type) ? options.type : 'auto';
    const rows = [
      ['수면', `${people}인용 이상 텐트`], ['수면', '침낭 또는 이불'], ['수면', '매트와 베개'],
      ['취사', '식수와 식재료'], ['취사', '식기와 쓰레기봉투'], ['안전', '구급함과 상비약'],
      ['생활', '랜턴과 여분 배터리'], ['위생', '세면도구와 휴지']
    ];
    if (season === 'winter') rows.push(['수면', '겨울용 침낭 또는 이불'], ['안전', '방한 장갑과 핫팩']);
    if (season === 'summer') rows.push(['안전', '자외선 차단제와 벌레 기피제'], ['생활', '휴대용 선풍기']);
    if (season === 'spring' || season === 'autumn') rows.push(['의류', '일교차 대비 겉옷']);
    if (type === 'auto') rows.push(['전기', '전기 릴선과 방수 커버'], ['생활', '테이블과 의자']);
    if (type === 'backpacking') rows.push(['안전', '등산 지도 또는 오프라인 GPS'], ['수면', '경량 방수포']);
    if (type === 'glamping') rows.push(['확인', '숙소 제공 비품 목록']);
    const seen = new Set();
    return rows.filter((row) => !seen.has(row[1]) && seen.add(row[1])).map(([category, item]) => ({ category, item }));
  }
  root.buildCampingList = buildCampingList;
  if (typeof module !== 'undefined') module.exports = { buildCampingList };
})(typeof window !== 'undefined' ? window : globalThis);
