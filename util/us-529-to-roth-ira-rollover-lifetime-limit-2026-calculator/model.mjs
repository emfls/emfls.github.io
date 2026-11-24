export const TAX_YEAR = 2026;
export const LAST_PROJECTION_YEAR = TAX_YEAR + 99;

const LIFETIME_CAP = 3_500_000;
const BASE_IRA_CAP = 750_000;
const CATCH_UP = 110_000;
const RETIREMENT_AGE = 65;
const WITHDRAWAL_PENALTY = 0.10;

function numberInRange(value, label, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function cents(value, label) {
  const scaled = numberInRange(value, label, 0, 1_000_000_000) * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 0.00002) {
    throw new RangeError(`${label} must use no more than two decimal places.`);
  }
  return rounded;
}

function dateParts(value, label) {
  const parts = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (parts) {
    const [year, month, day] = parts.slice(1).map(Number);
    const actual = new Date(Date.UTC(year, month - 1, day));
    if (year >= 1900 && actual.toISOString().slice(0, 10) === value) {
      return { year, month, day };
    }
  }
  throw new RangeError(`Enter a valid ${label}.`);
}

function inYear({ month, day }, year) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function iraRoom(age, compensation, used) {
  const cap = age >= 50 ? BASE_IRA_CAP + CATCH_UP : BASE_IRA_CAP;
  return Math.max(0, Math.min(cap, compensation) - used);
}

const dollars = amount => amount / 100;

function retirementComparison(schedule, age, earningsShare, incomeTaxRate, rate) {
  const retirementYear = TAX_YEAR + RETIREMENT_AGE - age;
  let gross = 0;
  let futureValue = 0;
  for (const { year, amount } of schedule) {
    if (year > retirementYear) break;
    const principal = Math.round(amount * 100);
    gross += principal;
    futureValue += principal * (1 + rate) ** (retirementYear - year);
  }
  if (gross === 0) return null;

  const taxableEarnings = Math.round(gross * earningsShare);
  const federalTax = Math.round(taxableEarnings * incomeTaxRate);
  const federalPenalty = Math.round(taxableEarnings * WITHDRAWAL_PENALTY);
  return {
    gross: dollars(gross),
    taxableEarnings: dollars(taxableEarnings),
    federalTax: dollars(federalTax),
    federalPenalty: dollars(federalPenalty),
    netCash: dollars(Math.max(0, gross - federalTax - federalPenalty)),
    rothAt65: dollars(Math.round(futureValue))
  };
}

export function calculateRollover(input) {
  const age = numberInRange(input.age, 'Year-end age', 0, 120);
  if (!Number.isInteger(age)) throw new RangeError('Enter age in whole years.');
  const opening = dateParts(input.openedOn, 'account opening date');
  const transfer = dateParts(input.transferOn, 'transfer date');
  if (transfer.year !== TAX_YEAR || input.openedOn > input.transferOn) {
    throw new RangeError('Choose a 2026 transfer date on or after the account opening date.');
  }
  if (typeof input.directTransfer !== 'boolean') throw new TypeError('Select a transfer method.');

  const balance = cents(input.balance, 'Total 529 balance');
  const recentFunds = cents(input.recentFunds, 'Recent contributions and earnings');
  const priorRollovers = cents(input.priorRollovers, 'Rollovers before 2026');
  const currentRollovers = cents(input.currentYearRollovers, 'Earlier 2026 rollovers');
  const compensation = cents(input.compensation, 'Taxable IRA compensation');
  const contributions = cents(input.otherContributions, 'Other 2026 IRA contributions');
  const futureContributions = cents(input.futureContributions, 'Future annual IRA contributions');
  const earningsShare = numberInRange(input.earningsPercent, 'Earnings share', 0, 100) / 100;
  const incomeTaxRate = numberInRange(input.federalTaxRate, 'Federal marginal tax rate', 0, 100) / 100;
  const rate = numberInRange(input.annualReturn, 'Annual return', -100, 100) / 100;

  const eligibleOn = inYear(opening, opening.year + 15);
  const accountEligible = input.transferOn >= eligibleOn;
  const eligiblePool = Math.max(0, balance - recentFunds);
  const remainingLifetimeCap = Math.max(0, LIFETIME_CAP - priorRollovers - currentRollovers);
  const target = Math.min(eligiblePool, remainingLifetimeCap);
  const room2026 = iraRoom(age, compensation, contributions + currentRollovers);
  const allowed2026 = input.directTransfer && accountEligible ? Math.min(room2026, target) : 0;
  const schedule = [{ year: TAX_YEAR, annualRoom: dollars(room2026), amount: dollars(allowed2026),
    cumulative: dollars(allowed2026) }];

  let scheduled = allowed2026;
  if (input.directTransfer && iraRoom(50, compensation, futureContributions) > 0) {
    for (let year = TAX_YEAR + 1; year <= LAST_PROJECTION_YEAR && scheduled < target; year++) {
      if (inYear(transfer, year) < eligibleOn) continue;
      const room = iraRoom(age + year - TAX_YEAR, compensation, futureContributions);
      if (room === 0) continue;
      const amount = Math.min(room, target - scheduled);
      scheduled += amount;
      schedule.push({ year, annualRoom: dollars(room), amount: dollars(amount), cumulative: dollars(scheduled) });
    }
  }

  return {
    accountEligible,
    eligibleOn,
    lookbackBefore: inYear(transfer, transfer.year - 5),
    eligiblePool: dollars(eligiblePool),
    remainingLifetimeCap: dollars(remainingLifetimeCap),
    room2026: dollars(room2026),
    allowed2026: dollars(allowed2026),
    schedule,
    unscheduledTarget: dollars(target - scheduled),
    comparison: retirementComparison(schedule, age, earningsShare, incomeTaxRate, rate)
  };
}
