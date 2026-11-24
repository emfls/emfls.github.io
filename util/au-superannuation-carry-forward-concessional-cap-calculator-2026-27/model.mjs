export const CURRENT_CAP = 32_500;
export const TSB_THRESHOLD = 500_000;
export const DIVISION_293_THRESHOLD = 250_000;
export const EXPIRY_DATE = '2027-06-30';
export const HISTORICAL_CAPS = Object.freeze([
  Object.freeze({ year: '2021–22', cap: 27_500 }),
  Object.freeze({ year: '2022–23', cap: 27_500 }),
  Object.freeze({ year: '2023–24', cap: 27_500 }),
  Object.freeze({ year: '2024–25', cap: 30_000 }),
  Object.freeze({ year: '2025–26', cap: 30_000 }),
]);

const MAX_AMOUNT = 1_000_000_000;
const RESIDENT_BANDS = [[18_200, 0], [45_000, 15], [135_000, 30], [190_000, 37], [Infinity, 45]];
const dollars = cents => cents / 100;

function toCents(amount, max = MAX_AMOUNT) {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || amount > max || dollars(cents) !== amount) {
    throw new RangeError('Enter a non-negative amount within the input limit, to the nearest cent.');
  }
  return cents;
}

function residentTaxCents(income) {
  let lower = 0;
  let taxNumerator = 0;
  for (const [limit, rate] of RESIDENT_BANDS) {
    const upper = Math.min(income, limit * 100);
    taxNumerator += (upper - lower) * rate;
    if (upper === income) break;
    lower = upper;
  }
  return Math.round(taxNumerator / 100);
}

function levyCents(income) {
  return Math.round(income * 2 / 100);
}

function division293Cents(income, contributions) {
  const overThreshold = Math.max(0, income + contributions - DIVISION_293_THRESHOLD * 100);
  return Math.round(Math.min(contributions, overThreshold) * 15 / 100);
}

export function residentIncomeTax(income) {
  return dollars(residentTaxCents(toCents(income)));
}

export function standardMedicareLevy(income) {
  return dollars(levyCents(toCents(income)));
}

export function division293Tax(income, contributions) {
  return dollars(division293Cents(toCents(income), toCents(contributions)));
}

export function estimateContribution({
  tsbJune30, taxableIncome, existingConcessional, plannedContribution, unusedByYear,
}) {
  const eligible = toCents(tsbJune30) < TSB_THRESHOLD * 100;
  const income = toCents(taxableIncome);
  const existing = toCents(existingConcessional);
  const planned = toCents(plannedContribution);
  if (!Array.isArray(unusedByYear) || unusedByYear.length !== HISTORICAL_CAPS.length) {
    throw new RangeError('Enter the five ATO carry-forward balances.');
  }

  const unused = HISTORICAL_CAPS.map(({ cap }, index) => toCents(unusedByYear[index], cap));
  const carryForward = eligible ? unused.reduce((sum, amount) => sum + amount, 0) : 0;
  const current = CURRENT_CAP * 100;
  const totalCap = current + carryForward;
  const total = existing + planned;
  const room = Math.max(0, totalCap - existing);
  let aboveCurrent = Math.max(0, total - current);
  const years = HISTORICAL_CAPS.map(({ year, cap }, index) => {
    const balance = unused[index];
    const used = eligible ? Math.min(balance, aboveCurrent) : 0;
    aboveCurrent -= used;
    return { year, cap, unused: dollars(balance), used: dollars(used), remaining: dollars(balance - used) };
  });

  // Compare the baseline with the in-cap deductible amount under the same tax assumptions.
  const modelled = Math.min(planned, room, income);
  const afterIncome = income - modelled;
  const incomeTaxSaved = residentTaxCents(income) - residentTaxCents(afterIncome);
  const medicareSaved = levyCents(income) - levyCents(afterIncome);
  const contributionsTax = Math.round(modelled * 15 / 100);
  const baselineContributions = Math.min(existing, totalCap);
  const divBefore = division293Cents(income, baselineContributions);
  const divAfter = division293Cents(afterIncome, baselineContributions + modelled);
  const divAdded = divAfter - divBefore;

  return {
    eligible,
    carryForward: dollars(carryForward),
    totalCap: dollars(totalCap),
    totalConcessional: dollars(total),
    currentUsed: dollars(Math.min(current, total)),
    additionalRoom: dollars(room),
    remainingRoom: dollars(Math.max(0, totalCap - total)),
    excess: dollars(aboveCurrent),
    years,
    expiringUnused: years[0].remaining,
    modelledContribution: dollars(modelled),
    incomeTaxSaved: dollars(incomeTaxSaved),
    medicareSaved: dollars(medicareSaved),
    personalTaxSaved: dollars(incomeTaxSaved + medicareSaved),
    contributionsTax: dollars(contributionsTax),
    division293Before: dollars(divBefore),
    division293After: dollars(divAfter),
    division293Added: dollars(divAdded),
    netTaxBenefit: dollars(incomeTaxSaved + medicareSaved - contributionsTax - divAdded),
    superBoost: dollars(modelled - contributionsTax),
  };
}

export function daysUntilExpiry(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new RangeError('Supply a calendar date in YYYY-MM-DD format.');
  }
  const day = Date.parse(isoDate);
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== isoDate) {
    throw new RangeError('Supply a valid calendar date.');
  }
  return (Date.parse(EXPIRY_DATE) - day) / 86_400_000;
}
