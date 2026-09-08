const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCampingList } = require('../kor/util/camping-packing-checklist/app.js');
const { estimateEsimUsage } = require('../kor/util/japan-esim-data-calculator/app.js');
const { buildJapanPackingList } = require('../kor/util/japan-travel-packing-checklist/app.js');
const { calculateRoadTripCost } = require('../kor/util/road-trip-cost-calculator/app.js');
const { calculatePowerBankWh } = require('../kor/util/power-bank-wh-calculator/app.js');

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

test('road trip calculator combines fuel, toll and parking then splits per person', () => {
  const result = calculateRoadTripCost({ distanceKm: 300, fuelEfficiency: 12, fuelPrice: 1800, toll: 18000, parking: 6000, people: 3, roundTrip: true });
  assert.equal(result.totalDistanceKm, 600);
  assert.equal(result.fuelLiters, 50);
  assert.equal(result.fuelCost, 90000);
  assert.equal(result.totalCost, 114000);
  assert.equal(result.perPersonCost, 38000);
});

test('road trip calculator clamps invalid inputs and never returns non-finite values', () => {
  const result = calculateRoadTripCost({ distanceKm: -1, fuelEfficiency: 0, fuelPrice: 'bad', toll: -2, parking: -3, people: 0, roundTrip: false });
  for (const value of Object.values(result)) assert.ok(Number.isFinite(value));
  assert.equal(result.totalCost, 0);
  assert.equal(result.perPersonCost, 0);
});

test('power bank calculator converts mAh and voltage to Wh at airline boundaries', () => {
  assert.deepEqual(calculatePowerBankWh({ mah: 27000, voltage: 3.7 }), { wh: 99.9, band: 'UNDER_OR_EQUAL_100' });
  assert.deepEqual(calculatePowerBankWh({ mah: 20000, voltage: 5 }), { wh: 100, band: 'UNDER_OR_EQUAL_100' });
  assert.deepEqual(calculatePowerBankWh({ mah: 32000, voltage: 5 }), { wh: 160, band: 'OVER_100_TO_160' });
  assert.deepEqual(calculatePowerBankWh({ mah: 43000, voltage: 3.7 }), { wh: 159.1, band: 'OVER_100_TO_160' });
  assert.deepEqual(calculatePowerBankWh({ mah: 50000, voltage: 3.7 }), { wh: 185, band: 'OVER_160' });
});

test('power bank calculator rejects missing, zero, negative and non-numeric input', () => {
  for (const input of [{}, { mah: 0, voltage: 3.7 }, { mah: -1, voltage: 3.7 }, { mah: 10000, voltage: 0 }, { mah: 'bad', voltage: 3.7 }]) {
    assert.deepEqual(calculatePowerBankWh(input), { wh: null, band: 'INVALID' });
  }
});
