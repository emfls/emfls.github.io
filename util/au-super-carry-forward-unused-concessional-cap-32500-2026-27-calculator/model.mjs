export const STANDARD_CAP = 32_500;
export const TSB_LIMIT = 500_000;
export const DIVISION_293_THRESHOLD = 250_000;
export const MAX_AMOUNT = 1_000_000_000;
export const HISTORICAL_CAPS = Object.freeze([
  Object.freeze({ year: '2021–22', cap: 27_500 }),
  Object.freeze({ year: '2022–23', cap: 27_500 }),
  Object.freeze({ year: '2023–24', cap: 27_500 }),
  Object.freeze({ year: '2024–25', cap: 30_000 }),
  Object.freeze({ year: '2025–26', cap: 30_000 }),
]);

const TAX_BRACKETS = [
  [18_200, 45_000, 0.15],
  [45_000, 135_000, 0.30],
  [135_000, 190_000, 0.37],
  [190_000, Infinity, 0.45],
];
const MEDICARE_RATE = 0.02;
const CONTRIBUTIONS_TAX_RATE = 0.15;
const DIVISION_293_RATE = 0.15;

function cents(value, label) {
  const rounded = Math.round(value * 100);
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      value < 0 || value > MAX_AMOUNT || rounded / 100 !== value) {
    throw new RangeError(`${label} must be between 0 and ${MAX_AMOUNT}, to the nearest cent.`);
  }
  return rounded;
}

const dollars = value => value / 100;
const positive = value => Math.max(0, value);
const roundMoney = value => Math.round(value * 100) / 100;

function incomeTax(income) {
  return TAX_BRACKETS.reduce((tax, [lower, upper, rate]) =>
    tax + positive(Math.min(income, upper) - lower) * rate, 0);
}

export function residentIncomeTax(income) {
  return roundMoney(incomeTax(income));
}

function division293(income, contributions) {
  const aboveThreshold = positive(income + contributions - DIVISION_293_THRESHOLD);
  return Math.min(contributions, aboveThreshold) * DIVISION_293_RATE;
}

export function division293Tax(income, contributions) {
  return roundMoney(division293(income, contributions));
}

function estimateTax(income, planned, proposed, baselineExcess, totalExcess) {
  if (proposed > income) return null;

  // Compare the same taxpayer with and without the proposed deduction.
  // Excess concessional contributions are added back and receive a 15% offset.
  const incomeBefore = income + baselineExcess;
  const incomeAfter = income - proposed + totalExcess;
  const personalTaxBefore = incomeTax(incomeBefore) + incomeBefore * MEDICARE_RATE;
  const personalTaxAfter = incomeTax(incomeAfter) + incomeAfter * MEDICARE_RATE;
  const excessOffset = (totalExcess - baselineExcess) * CONTRIBUTIONS_TAX_RATE;
  const personalTaxSavings = roundMoney(personalTaxBefore - personalTaxAfter + excessOffset);

  // Division 293 uses taxable income plus in-cap concessional contributions.
  const division293Before = division293(incomeBefore, planned - baselineExcess);
  const division293After = division293(incomeAfter, planned + proposed - totalExcess);
  const extraDivision293 = roundMoney(division293After - division293Before);
  const fundTax = roundMoney(proposed * CONTRIBUTIONS_TAX_RATE);
  const superTax = roundMoney(fundTax + extraDivision293);
  return {
    personalTaxSavings,
    fundTax,
    division293: extraDivision293,
    superTax,
    netGain: roundMoney(personalTaxSavings - superTax),
  };
}

export function calculate({
  totalSuperBalance30Jun2026,
  taxableIncome,
  plannedContributions,
  priorContributions,
  proposedContribution,
}) {
  const eligible = cents(totalSuperBalance30Jun2026, 'totalSuperBalance30Jun2026') < TSB_LIMIT * 100;
  const income = cents(taxableIncome, 'taxableIncome');
  const planned = cents(plannedContributions, 'plannedContributions');
  const proposed = cents(proposedContribution, 'proposedContribution');
  if (!Array.isArray(priorContributions) || priorContributions.length !== HISTORICAL_CAPS.length) {
    throw new RangeError('priorContributions must contain five annual totals, oldest first.');
  }

  const history = [];
  let historyIsConservative = false;
  for (const [index, { year, cap }] of HISTORICAL_CAPS.entries()) {
    const contributions = cents(priorContributions[index], `priorContributions (${year})`);
    const unused = cap * 100 - contributions;
    if (unused < 0) {
      // Earlier balances or historical eligibility can reduce this draw.
      let draw = -unused;
      for (const bucket of history) {
        const used = Math.min(bucket.unused, draw);
        historyIsConservative ||= used > 0;
        bucket.unused -= used;
        draw -= used;
      }
    }
    history.push({ year, cap, unused: positive(unused), used: 0 });
  }

  const standard = STANDARD_CAP * 100;
  const carryForward = eligible ? history.reduce((total, bucket) => total + bucket.unused, 0) : 0;
  const totalCap = standard + carryForward;
  const total = planned + proposed;
  const expiringBeforeProposal = history[0].unused -
    (eligible ? Math.min(history[0].unused, positive(planned - standard)) : 0);
  let carryForwardNeeded = eligible ? positive(total - standard) : 0;
  for (const bucket of history) {
    bucket.used = Math.min(bucket.unused, carryForwardNeeded);
    carryForwardNeeded -= bucket.used;
  }

  const excess = positive(total - totalCap);
  const baselineExcess = positive(planned - totalCap);
  return {
    eligible,
    carryForward: dollars(carryForward),
    totalCap: dollars(totalCap),
    remainingBeforeProposal: dollars(positive(totalCap - planned)),
    expiringBeforeProposal: dollars(expiringBeforeProposal),
    expiringAtRisk: dollars(history[0].unused - history[0].used),
    currentCapUsed: dollars(Math.min(standard, total)),
    historyIsConservative,
    history: history.map(({ year, cap, unused, used }) => ({
      year, cap, unused: dollars(unused), used: dollars(used), remaining: dollars(unused - used),
    })),
    excess: dollars(excess),
    tax: estimateTax(dollars(income), dollars(planned), dollars(proposed), dollars(baselineExcess), dollars(excess)),
  };
}
