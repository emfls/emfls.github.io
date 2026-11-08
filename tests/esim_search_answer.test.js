const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateEsimUsage } = require('../kor/util/japan-esim-data-calculator/app.js');

const input = { days: 30, maps: 60, messaging: 60, social: 30, music: 30, video: 600, tethering: false };

test('valid long trips retain the displayed daily rates rather than a hidden output ceiling', () => {
  const dailyGb = (60 * .08 + 60 * .05 + 30 * 2 + 30 + 600 * 8) / 1024;
  for (const days of [20, 30, 60]) {
    const r = estimateEsimUsage({ ...input, days });
    assert.equal(r.dailyGb, dailyGb);
    assert.equal(r.baseGb, dailyGb * days);
    assert.equal(r.totalGb, Math.ceil(r.baseGb * 1.2 * 10) / 10);
  }
  assert.ok(estimateEsimUsage({ ...input, days: 60 }).totalGb > estimateEsimUsage({ ...input, days: 30 }).totalGb);
});

test('daily estimate reflects tethering while invalid inputs keep the existing bounds', () => {
  const plain = estimateEsimUsage(input);
  const shared = estimateEsimUsage({ ...input, tethering: true });
  assert.equal(shared.dailyGb, plain.dailyGb * 1.25);
  assert.deepEqual(estimateEsimUsage({ ...input, days: -1, video: 9999 }), estimateEsimUsage({ ...input, days: 1, video: 600 }));
});

test('small positive usage is not rounded to a zero trip before the buffer', () => {
  const r = estimateEsimUsage({ days: 5, maps: 60, messaging: 0, social: 0, music: 0, video: 0 });
  assert.equal(r.baseGb, 60 * .08 / 1024 * 5);
  assert.equal(r.totalGb, .1);
  assert.equal(estimateEsimUsage({ days: 5 }).totalGb, 0);
});
