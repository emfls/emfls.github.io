export const TAX_BANDS = Object.freeze({ 20: 1000, 40: 500, 45: 0 });

export const DEFAULTS = Object.freeze({
  investment: 50000, price: 94.5, coupon: 0.25, years: 1.5,
  band: 40, psa: 500, fee: 15, feeUnit: 'gbp', benchmark: 4.5,
});

export const PRESETS = Object.freeze([
  Object.freeze({ years: 1, coupon: 0.125, price: 96.25 }),
  Object.freeze({ years: 2, coupon: 0.25, price: 93 }),
  Object.freeze({ years: 3, coupon: 0.625, price: 92 }),
]);

function inRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
}

function holdingPeriods(years) {
  const fullYears = Math.floor(years);
  const finalPeriod = years - fullYears;
  const periods = Array(fullYears).fill(1);
  if (finalPeriod > 0) periods.push(finalPeriod);
  return periods;
}

function incomeTax(interest, taxRate, psa) {
  return Math.max(0, interest - psa) * taxRate;
}

// AER is a percentage, taxRate is a fraction, and PSA is in GBP per period.
export function savingsProfit(investment, aer, years, taxRate, psa) {
  const annualLogGrowth = Math.log1p(aer / 100);
  let profit = 0;
  for (const period of holdingPeriods(years)) {
    const interest = (investment + profit) * Math.expm1(annualLogGrowth * period);
    profit += interest - incomeTax(interest, taxRate, psa);
  }
  return profit;
}

function breakEven(investment, targetProfit, years, taxRate, psa) {
  if (targetProfit <= 0) return targetProfit === 0 ? 0 : null;

  const netYield = Math.expm1(Math.log1p(targetProfit / investment) / years) * 100;
  let low = 0;
  // The upper bound assumes zero PSA and taxes each period's interest in full.
  // For a fractional period, (1 + a)^t - 1 is concave in a.
  let high = netYield / (1 - taxRate);
  for (let i = 0; i < 64; i++) {
    const midpoint = (low + high) / 2;
    if (savingsProfit(investment, midpoint, years, taxRate, psa) < targetProfit) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }
  return (low + high) / 2;
}

export function calculateGilt({ investment, price, coupon, years, band, psa, fee, feeUnit, benchmark }) {
  inRange(investment, 0.01, 100_000_000, 'Investment amount (£)');
  inRange(price, 0.01, 1000, 'Clean price (£ per £100 nominal)');
  inRange(coupon, 0, 100, 'Annual coupon (%)');
  inRange(years, 0.01, 50, 'Years to maturity');
  if (!Number.isFinite(band) || !Object.hasOwn(TAX_BANDS, band)) {
    throw new RangeError('Select a 2026/27 savings tax band.');
  }
  inRange(psa, 0, TAX_BANDS[band], 'Remaining PSA (£)');
  if (feeUnit !== 'gbp' && feeUnit !== 'percent') {
    throw new RangeError('Select a platform fee unit.');
  }
  inRange(fee, 0, feeUnit === 'gbp' ? 100_000_000 : 100, 'Total platform fees');
  inRange(benchmark, 0, 100, 'Benchmark AER (%)');

  const taxRate = band / 100;
  const nominal = investment / (price / 100);
  const capitalGain = nominal - investment;
  const annualCoupon = nominal * coupon / 100;
  const couponTotal = annualCoupon * years;
  let couponTax = 0;
  for (const period of holdingPeriods(years)) {
    couponTax += incomeTax(annualCoupon * period, taxRate, psa);
  }
  const fees = feeUnit === 'gbp' ? fee : investment * fee / 100;
  const netProfit = capitalGain + couponTotal - couponTax - fees;
  const netYield = netProfit >= -investment
    ? Math.expm1(Math.log1p(netProfit / investment) / years) * 100
    : null;
  const benchmarkProfit = savingsProfit(investment, benchmark, years, taxRate, psa);
  return {
    nominal, capitalGain, couponTotal, couponTax, fees, netProfit, netYield,
    noPsaEquivalent: netProfit >= 0 ? netYield / (1 - taxRate) : null,
    breakEvenAer: breakEven(investment, netProfit, years, taxRate, psa),
    benchmarkProfit, advantage: netProfit - benchmarkProfit,
  };
}
