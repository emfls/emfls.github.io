export const TFSA_LIMITS = Object.freeze({
  2009: 5000, 2010: 5000, 2011: 5000, 2012: 5000,
  2013: 5500, 2014: 5500, 2015: 10000, 2016: 5500, 2017: 5500, 2018: 5500,
  2019: 6000, 2020: 6000, 2021: 6000, 2022: 6000,
  2023: 6500, 2024: 7000, 2025: 7000, 2026: 7000
});

const FIRST_YEAR = 2009;
const TAX_YEAR = 2026;
export const PROJECTED_2027_LIMIT = 7000;
export const MAX_AMOUNT = 1_000_000_000;
const yearListError = 'Enter years from 2009 to 2026, separated by commas. Ranges like 2017–2019 are allowed.';

function integerInRange(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function toCents(value, label) {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT || value !== cents / 100) {
    throw new RangeError(`${label} must be a non-negative amount up to $1 billion with at most two decimal places.`);
  }
  return cents;
}

export function parseNonResidentYears(value) {
  if (!value.trim()) return [];
  const years = new Set();
  for (const item of value.split(',')) {
    const match = /^(\d{4})(?:\s*[-–]\s*(\d{4}))?$/.exec(item.trim());
    if (!match) throw new RangeError(yearListError);
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < FIRST_YEAR || last > TAX_YEAR || first > last) throw new RangeError(yearListError);
    for (let year = first; year <= last; year++) years.add(year);
  }
  return [...years].sort((a, b) => a - b);
}

// Sum 1% of each month's peak and round the total once, to the cent.
export function excessTax(monthlyPeaks) {
  if (!Array.isArray(monthlyPeaks) || monthlyPeaks.length > 12) {
    throw new RangeError('Enter up to 12 monthly peaks for one calendar year.');
  }
  let totalCents = 0;
  for (const peak of monthlyPeaks) totalCents += toCents(peak, 'Monthly peak');
  return Math.round(totalCents / 100) / 100;
}

export function calculateTfsa({
  birthYear,
  becameCanadianResidentYear,
  nonResidentYears = [],
  lifetimePriorContributions = 0,
  priorYearsWithdrawalsBefore2026 = 0,
  currentYear2026Contributions = 0,
  withdrawalsIn2026 = 0,
  excessRemovedIn2026 = 0,
  monthsExcessRemains = 1
}) {
  integerInRange(birthYear, 1900, TAX_YEAR, 'Birth year');
  integerInRange(becameCanadianResidentYear, 1900, TAX_YEAR + 1, 'First Canadian resident year');
  integerInRange(monthsExcessRemains, 1, 12, 'Months with excess');
  const excluded = new Set(nonResidentYears.map(year =>
    integerInRange(year, FIRST_YEAR, TAX_YEAR, 'Non-resident year')));
  const firstEligibleYear = Math.max(FIRST_YEAR, birthYear + 18, becameCanadianResidentYear);
  let cumulativeEligibleRoom = 0;
  const breakdown = Object.entries(TFSA_LIMITS).map(([yearKey, limit]) => {
    const year = Number(yearKey);
    let reason = 'Eligible';
    if (year < birthYear + 18) reason = 'Under 18';
    else if (year < becameCanadianResidentYear) reason = 'Before residency';
    else if (excluded.has(year)) reason = 'Non-resident all year';
    const eligible = reason === 'Eligible';
    const earned = eligible ? limit : 0;
    cumulativeEligibleRoom += earned;
    return { year, limit, eligible, reason, earned, cumulative: cumulativeEligibleRoom };
  });

  const priorContributions = toCents(lifetimePriorContributions, 'Contributions through 2025');
  const priorWithdrawals = toCents(priorYearsWithdrawalsBefore2026, 'Withdrawals through 2025');
  const currentContributions = toCents(currentYear2026Contributions, '2026 contributions');
  const currentWithdrawals = toCents(withdrawalsIn2026, '2026 withdrawals');
  const correction = toCents(excessRemovedIn2026, '2026 withdrawals that removed excess');
  const grossBalance = cumulativeEligibleRoom * 100 - priorContributions + priorWithdrawals - currentContributions;
  if (correction > currentWithdrawals || correction > Math.max(0, -grossBalance)) {
    throw new RangeError('The correction cannot exceed total 2026 withdrawals or the excess before corrections.');
  }

  const balance = grossBalance + correction;
  const excessAmount = Math.max(0, -balance) / 100;
  const ordinaryWithdrawals = currentWithdrawals - correction;
  const annual2027 = firstEligibleYear <= TAX_YEAR + 1 ? PROJECTED_2027_LIMIT * 100 : 0;
  return {
    firstEligibleYear, cumulativeEligibleRoom, breakdown,
    eligibleIn2026: breakdown.at(-1).eligible,
    available2026Room: balance / 100,
    excessAmount,
    withdrawToCorrect: excessAmount,
    estimatedTax: Math.round(Math.max(0, -balance) * monthsExcessRemains / 100) / 100,
    recontribution2027: ordinaryWithdrawals / 100,
    projected2027Room: (Math.max(0, balance) + ordinaryWithdrawals + annual2027) / 100,
    projected2027RoomIfUncorrected: Math.max(0, balance + ordinaryWithdrawals + annual2027) / 100
  };
}
