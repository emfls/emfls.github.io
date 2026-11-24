import assert from 'node:assert/strict';
import {test} from 'node:test';
import {calculate} from './model.mjs';

test('low income dividends are covered by Personal Allowance', () => {
  const result = calculate({ordinary: 0, dividends: 12570});
  assert.equal(result.dividendTax, 0);
  assert.equal(result.allowanceOnDividends, 12570);
});
test('the first £500 after Personal Allowance is charged at zero', () => {
  assert.equal(calculate({ordinary: 12570, dividends: 500}).dividendTax, 0);
  assert.equal(calculate({ordinary: 12570, dividends: 501}).dividendTax, 0.11);
});
test('HMRC wage and dividend example uses the 2026/27 basic rate', () => {
  const result = calculate({ordinary: 29570, dividends: 3000});
  assert.equal(result.dividendTax, 268.75);
  assert.equal(result.totalTax, 3668.75);
});
test('the dividend allowance occupies taxable band space', () => {
  const result = calculate({ordinary: 50000, dividends: 1000});
  assert.deepEqual(result.bands, [0, 230, 0]);
  assert.equal(result.dividendAllowanceUsed, 500);
  assert.equal(result.dividendTax, 82.23);
});
test('dividends can use both basic and higher taxable bands', () => {
  const result = calculate({ordinary: 48870, dividends: 2000});
  assert.deepEqual(result.bands, [900, 600, 0]);
  assert.equal(result.dividendTax, 311.25);
});
test('Personal Allowance taper begins above £100k in £2 increments', () => {
  for (const [dividends, allowance] of [[1000, 12570], [1001.99, 12570], [1002, 12569], [11000, 7570]]) {
    assert.equal(calculate({ordinary: 99000, dividends}).allowance, allowance);
  }
});
test('£125,140 removes the last pound of Personal Allowance', () => {
  assert.equal(calculate({ordinary: 124000, dividends: 1139.99}).allowance, 1);
  assert.equal(calculate({ordinary: 124000, dividends: 1140}).allowance, 0);
});
test('dividends spill across the £125,140 additional-rate boundary', () => {
  const result = calculate({ordinary: 124640, dividends: 1500});
  assert.deepEqual(result.bands, [0, 0, 1000]);
  assert.equal(result.dividendTax, 393.50);
});
test('dividends alone can occupy all three taxable bands', () => {
  const result = calculate({ordinary: 0, dividends: 126140});
  assert.deepEqual(result.bands, [37200, 87440, 1000]);
  assert.equal(result.dividendTax, 35652.30);
});
test('allocate Personal Allowance across both incomes when it reduces total tax', () => {
  const result = calculate({ordinary: 50000, dividends: 771});
  assert.equal(result.allowanceOnDividends, 270);
  assert.equal(result.dividendTax, 0.36);
  assert.equal(result.totalTax, 7540.36);
});
test('negative and nonnumber inputs fail', () => {
  for (const ordinary of [-1, -0.01, NaN, Infinity, null, '0']) {
    assert.throws(() => calculate({ordinary, dividends: 0}), RangeError);
  }
});
test('blank, excess precision and out-of-range dividends fail', () => {
  for (const dividends of ['', 0.001, 10000000.01, undefined]) {
    assert.throws(() => calculate({ordinary: 0, dividends}), RangeError);
  }
});
