const BASIC_LIMIT = 37_700;
const ADDITIONAL_THRESHOLD = 125_140;
const STANDARD_ALLOWANCE = 12_570;
const ANNUAL_EXEMPT_AMOUNT = 3_000;
const INCOME_BANDS = [[BASIC_LIMIT, 0.20], [ADDITIONAL_THRESHOLD, 0.40], [Infinity, 0.45]];
const DIVIDEND_BANDS = [[BASIC_LIMIT, 0.1075], [ADDITIONAL_THRESHOLD, 0.3575], [Infinity, 0.3935]];
const MAX_AMOUNT = 10_000_000_000;

const pennies = value => Math.round((value + Number.EPSILON) * 100) / 100;

function amount(value) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) {
    throw new RangeError('Enter a pound amount from 0 to 10 billion.');
  }
  return value;
}

function years(value, min) {
  if (!Number.isInteger(value) || value < min || value > 120) {
    throw new RangeError('Enter a valid whole number of tax years.');
  }
  return value;
}

function bandTax(start, end, bands) {
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of bands) {
    tax += Math.max(0, Math.min(end, upper) - Math.max(start, lower)) * rate;
    lower = upper;
  }
  return tax;
}

function leastIncomeTax(ordinary, savings, dividends, taxableIncome) {
  const savingsAllowance = taxableIncome <= BASIC_LIMIT ? 1_000 :
    taxableIncome <= ADDITIONAL_THRESHOLD ? 500 : 0;
  // Half-penny units preserve the allowance taper and exact feasibility at
  // allocation boundaries when the input contains pennies.
  const units = pounds => Math.round(pounds * 200);
  const basicLimit = units(BASIC_LIMIT);
  const additionalThreshold = units(ADDITIONAL_THRESHOLD);
  const savingsStart = units(5_000);
  const savingsNil = units(savingsAllowance);
  const dividendNil = units(500);
  const taxable = units(taxableIncome);
  const ordinaryMax = units(ordinary);
  const savingsMax = units(savings);
  const dividendMax = units(dividends);
  const tax = (ordinaryEnd, savingsEnd) =>
    bandTax(0, ordinaryEnd / 200, INCOME_BANDS) +
    bandTax((Math.max(ordinaryEnd, savingsStart) + savingsNil) / 200, savingsEnd / 200, INCOME_BANDS) +
    bandTax((savingsEnd + dividendNil) / 200, taxable / 200, DIVIDEND_BANDS);

  // Allocate the Personal Allowance where it gives the lowest income tax.
  // The tax is piecewise linear in the ends of the ordinary and savings slices.
  // Its minimum is at an intersection of a rate boundary or an allocation limit.
  const fixedSavingsEnds = [
    taxable - dividendMax, taxable, taxable - dividendNil, basicLimit, additionalThreshold,
    basicLimit - dividendNil, additionalThreshold - dividendNil, savingsStart + savingsNil
  ];
  const offsets = [0, savingsMax, savingsNil];
  const ordinaryEnds = [
    0, ordinaryMax, savingsStart, basicLimit, additionalThreshold,
    basicLimit - savingsNil, additionalThreshold - savingsNil,
    ...fixedSavingsEnds.flatMap(end => offsets.map(offset => end - offset))
  ];
  let minimum = Infinity;
  for (const ordinaryEnd of ordinaryEnds) {
    if (ordinaryEnd < 0 || ordinaryEnd > ordinaryMax) continue;
    const low = Math.max(ordinaryEnd, taxable - dividendMax);
    const high = Math.min(ordinaryEnd + savingsMax, taxable);
    if (low > high) continue;
    const candidates = [...fixedSavingsEnds, ordinaryEnd + savingsNil];
    minimum = Math.min(minimum, tax(ordinaryEnd, low), tax(ordinaryEnd, high));
    for (const savingsEnd of candidates) {
      if (savingsEnd >= low && savingsEnd <= high) {
        minimum = Math.min(minimum, tax(ordinaryEnd, savingsEnd));
      }
    }
  }
  return pennies(minimum);
}

// England, Wales and Northern Ireland. Nil-rate slices still occupy tax bands.
export function calculateTax({
  ordinary = 0, savings = 0, dividends = 0, gains = 0, forfeitAllowances = false
} = {}) {
  [ordinary, savings, dividends, gains].forEach(amount);
  const adjustedNetIncome = ordinary + savings + dividends;
  const personalAllowance = forfeitAllowances ? 0 : Math.max(
    0, STANDARD_ALLOWANCE - Math.max(0, adjustedNetIncome - 100_000) / 2
  );
  const taxableIncome = Math.round(Math.max(0, adjustedNetIncome - personalAllowance) * 200) / 200;
  const incomeTax = leastIncomeTax(ordinary, savings, dividends, taxableIncome);
  const annualExemptAmount = forfeitAllowances ? 0 : ANNUAL_EXEMPT_AMOUNT;
  const taxableGains = Math.max(0, gains - annualExemptAmount);
  const basicRateGains = Math.min(taxableGains, Math.max(0, BASIC_LIMIT - taxableIncome));
  const cgt = pennies(basicRateGains * 0.18 + (taxableGains - basicRateGains) * 0.24);
  return { personalAllowance, annualExemptAmount, incomeTax, cgt, total: pennies(incomeTax + cgt) };
}

function arisingAmounts({
  ordinary = 0, savings = 0, dividends = 0, gains = 0,
  foreignOrdinary = 0, foreignSavings = 0, foreignDividends = 0, foreignGains = 0
}) {
  return {
    ordinary: amount(ordinary) + amount(foreignOrdinary),
    savings: amount(savings) + amount(foreignSavings),
    dividends: amount(dividends) + amount(foreignDividends),
    gains: amount(gains) + amount(foreignGains)
  };
}

export function compareFig({
  ukResident = false, yearsBeforeArrival = 0, windowYear = 1, ...amounts
} = {}) {
  const eligible = years(yearsBeforeArrival, 0) >= 10 && ukResident && years(windowYear, 1) <= 4;
  const arising = arisingAmounts(amounts);
  const standard = ukResident ? calculateTax(arising) : null;
  const hasClaim = ['foreignOrdinary', 'foreignSavings', 'foreignDividends', 'foreignGains']
    .some(key => amounts[key] > 0);
  const withClaim = eligible && hasClaim ? calculateTax({ ...amounts, forfeitAllowances: true }) : null;
  return { eligible, standard, withClaim, claimSavings: withClaim ? pennies(standard.total - withClaim.total) : null };
}

export function compareTrf({
  ukResident = false, formerUser = false, residentNextYear = false,
  legacyIncome = 0, legacyGains = 0, ...amounts
} = {}) {
  const capital = amount(legacyIncome) + amount(legacyGains);
  const taxNow = formerUser && ukResident ? pennies(capital * 0.12) : null;
  const taxLater = formerUser && residentNextYear ? pennies(capital * 0.15) : null;
  const arising = arisingAmounts(amounts);
  // HMRC HS264 applies normal income rates to remitted legacy dividends.
  const standardTax = formerUser && ukResident ? pennies(calculateTax({
    ...arising, ordinary: arising.ordinary + legacyIncome, gains: arising.gains + legacyGains
  }).total - calculateTax(arising).total) : null;
  const deadlineSavings = taxNow !== null && taxLater !== null ? pennies(taxLater - taxNow) : null;
  const standardSavings = standardTax !== null ? pennies(standardTax - taxNow) : null;
  return { taxNow, taxLater, standardTax, deadlineSavings, standardSavings };
}

export function checkIht(history) {
  if (!Array.isArray(history) || history.length !== 29 ||
      Array.from(history).some(resident => typeof resident !== 'boolean')) {
    throw new RangeError('Provide 29 completed UK tax years, newest first.');
  }
  const countResident = period => period.filter(Boolean).length;
  const previous20 = countResident(history.slice(0, 20));
  const reset = history.slice(0, 19).map(resident => resident ? '1' : '0').join('').includes('0000000000');
  const latestResidence = history.findIndex(Boolean);
  const atDeparture = latestResidence < 0 || latestResidence >= 10 ? 0 :
    countResident(history.slice(latestResidence, latestResidence + 20));
  const tail = !reset && atDeparture >= 10 ? Math.max(3, atDeparture - 10) : 0;
  const longTermResident = !reset && previous20 >= 10 && latestResidence < tail;
  return {
    previous20, longTermResident, tail,
    tailRemaining: longTermResident ? tail - latestResidence : 0
  };
}
