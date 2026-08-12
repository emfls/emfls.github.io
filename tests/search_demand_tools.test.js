const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCampingList } = require('../kor/util/camping-packing-checklist/app.js');
const { estimateEsimUsage } = require('../kor/util/japan-esim-data-calculator/app.js');
const { buildJapanPackingList } = require('../kor/util/japan-travel-packing-checklist/app.js');

test('camping list adapts to winter family camping without duplicates', () => {
  const list = buildCampingList({ people: 4, nights: 2, season: 'winter', type: 'auto' });
  const names = list.map((entry) => entry.item);
  assert.ok(names.includes('4인용 이상 텐트'));
  assert.ok(names.includes('겨울용 침낭 또는 이불'));
  assert.ok(names.includes('전기 릴선과 방수 커버'));
  assert.equal(new Set(names).size, names.length);
});

test('esim estimate applies travel days, tethering and 20 percent buffer', () => {
  const result = estimateEsimUsage({ days: 5, maps: 60, messaging: 60, social: 30, music: 30, video: 20, tethering: true });
  assert.ok(result.baseGb > 1);
  assert.equal(result.totalGb, Math.ceil(result.baseGb * 1.2 * 10) / 10);
  assert.match(result.recommendation, /GB|무제한/);
});

test('esim estimate clamps invalid input', () => {
  const result = estimateEsimUsage({ days: -2, maps: -10, messaging: 9999, social: 0, music: 0, video: 0, tethering: false });
  assert.ok(result.baseGb >= 0);
  assert.ok(result.totalGb <= 100);
});

test('japan packing list includes winter, checked bag and child items without duplicates', () => {
  const list = buildJapanPackingList({ season: 'winter', days: 7, checkedBag: true, children: true });
  const names = list.map((entry) => entry.item);
  assert.ok(names.includes('방한 외투와 보온 내의'));
  assert.ok(names.includes('위탁수하물 규정 확인'));
  assert.ok(names.includes('어린이 상비약과 보호자 연락처'));
  assert.equal(new Set(names).size, names.length);
});
