const FIRST_ROTH_YEAR = 1998;
const CLOCK_YEARS = 5;
const AGE_THRESHOLD = 59.5;
const HOME_LIMIT = 1_000_000; // Cents
const MAX_DOLLARS = 1_000_000_000;
const EXCEPTIONS = ['none', 'first_home_10k', 'disability', 'qualified_education'];
const BUCKET_KEYS = ['contributions', 'aged', 'recentTaxable', 'recentNontaxable', 'earnings'];

function decimal(value, label, max) {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > max ||
      Math.abs(value * 100 - cents) > 0.0001) {
    throw new RangeError(`${label} must be between 0 and ${max.toLocaleString('en-US')}, with up to two decimal places.`);
  }
  return cents;
}

function year(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be a whole year from ${min} to ${max}.`);
  }
  return value;
}

const money = (value, label) => decimal(value, label, MAX_DOLLARS);
const dollars = cents => cents / 100;
const clearDate = start => `${start + CLOCK_YEARS}-01-01`;

function allocate(amount, layers) {
  const buckets = Object.fromEntries(BUCKET_KEYS.map(key => [key, 0]));
  for (const { key, balance } of layers) {
    const drawn = Math.min(amount, balance);
    buckets[key] += drawn;
    amount -= drawn;
  }
  return buckets;
}

// Balances are remaining owner Roth IRA basis across all accounts, before the modeled distribution.
export function calculateRothDistribution(input) {
  const age = decimal(input.age, 'Age', 130) / 100;
  const withdrawalYear = year(input.withdrawalYear, 'Withdrawal year', FIRST_ROTH_YEAR, 9994);
  const firstYear = year(input.firstRothTaxYear, 'First Roth tax year', FIRST_ROTH_YEAR, withdrawalYear);
  const withdrawal = money(input.withdrawal, 'Planned withdrawal');
  const contributions = money(input.contributions, 'Regular contributions');
  const aged = money(input.agedConversions, 'Aged conversions');
  const earnings = money(input.earnings, 'Earnings balance');
  const rate = decimal(input.marginalRate, 'Marginal tax rate', 100);
  const { exception } = input;
  if (!EXCEPTIONS.includes(exception)) throw new RangeError('Select a supported penalty exception.');

  const overallClockMet = withdrawalYear - firstYear >= CLOCK_YEARS;
  if (aged > 0 && !overallClockMet) {
    throw new RangeError('Aged conversions require a first Roth tax year at least five years before withdrawal.');
  }

  const home = exception === 'first_home_10k';
  const disability = exception === 'disability';
  const education = exception === 'qualified_education';
  const expenses = home || education ? money(input.qualifiedExpenses, 'Qualified expenses') : 0;
  const priorHome = home ? decimal(input.priorHomeDistributions ?? 0, 'Prior first-home distributions', 10000) : 0;
  const homeCap = home ? Math.min(expenses, HOME_LIMIT - priorHome) : 0;
  const oldEnough = age >= AGE_THRESHOLD;
  const fullyQualified = overallClockMet && (oldEnough || disability);
  const earlyPenaltyApplies = !oldEnough && !disability;

  const layers = [{ key: 'contributions', balance: contributions }, { key: 'aged', balance: aged }];
  const conversionClocks = [];
  const rows = input.conversions.map(entry => ({
    year: year(entry.year, 'Conversion year', firstYear, withdrawalYear),
    taxable: money(entry.taxable, 'Taxable conversion balance'),
    nontaxable: money(entry.nontaxable, 'Nontaxable conversion balance')
  })).sort((a, b) => a.year - b.year);

  for (const conversionYear of new Set(rows.map(row => row.year))) {
    const conversionAged = withdrawalYear - conversionYear >= CLOCK_YEARS;
    const sameYear = rows.filter(row => row.year === conversionYear);
    const taxable = sameYear.reduce((sum, row) => sum + row.taxable, 0);
    const nontaxable = sameYear.reduce((sum, row) => sum + row.nontaxable, 0);
    layers.push(
      { key: conversionAged ? 'aged' : 'recentTaxable', balance: taxable },
      { key: conversionAged ? 'aged' : 'recentNontaxable', balance: nontaxable }
    );
    conversionClocks.push({ year: conversionYear, clearDate: clearDate(conversionYear), aged: conversionAged });
  }
  layers.push({ key: 'earnings', balance: earnings });
  const balance = layers.reduce((sum, layer) => sum + layer.balance, 0);

  function assess(amount) {
    // Form 8606 subtracts eligible first-home distributions on line 20 before applying basis.
    const qualifiedHome = overallClockMet && !fullyQualified ? Math.min(amount, homeCap) : 0;
    const reporting = allocate(amount - qualifiedHome, layers);
    const taxable = fullyQualified ? 0 : reporting.earnings;
    const recapture = earlyPenaltyApplies ? reporting.recentTaxable : 0;
    const earlyEarnings = earlyPenaltyApplies ? taxable : 0;
    // When line 20 applies, the home amount was already removed. Do not apply it a second time.
    const exceptionLimit = education ? expenses : overallClockMet ? 0 : homeCap;
    const recaptureBase = Math.max(0, recapture - exceptionLimit);
    const earningsBase = Math.max(0, earlyEarnings - Math.max(0, exceptionLimit - recapture));
    return { qualifiedHome, reporting, taxable, recaptureBase, earningsBase };
  }

  const distributed = Math.min(withdrawal, balance);
  const gross = allocate(distributed, layers);
  const { qualifiedHome, reporting, taxable, recaptureBase, earningsBase } = assess(distributed);

  // Taxable and penalty bases are nondecreasing with distributed dollars, including capped exceptions.
  let low = 0;
  let high = balance;
  while (low < high) {
    const candidate = Math.ceil((low + high) / 2);
    const test = assess(candidate);
    if (test.taxable === 0 && test.recaptureBase === 0 && test.earningsBase === 0) {
      low = candidate;
    } else {
      high = candidate - 1;
    }
  }

  const penaltyBase = recaptureBase + earningsBase;
  const penalty = Math.round(penaltyBase / 10);
  const recapturePenalty = Math.round(recaptureBase / 10);
  return {
    buckets: BUCKET_KEYS.map(key => ({
      key, withdrawn: dollars(gross[key]), reportingAmount: dollars(reporting[key])
    })),
    balance: dollars(balance),
    distributed: dollars(distributed),
    unallocated: dollars(withdrawal - distributed),
    maxSafeWithdrawal: dollars(low),
    taxableEarnings: dollars(taxable),
    incomeTax: dollars(Math.round(taxable * rate / 10000)),
    penaltyBase: dollars(penaltyBase),
    penalty: dollars(penalty),
    recapturePenalty: dollars(recapturePenalty),
    earningsPenalty: dollars(penalty - recapturePenalty),
    qualifiedHomeAmount: dollars(qualifiedHome),
    earningsClearDate: clearDate(firstYear),
    overallClockMet,
    conversionClocks,
    form8606Required: distributed > 0 && !fullyQualified
  };
}
