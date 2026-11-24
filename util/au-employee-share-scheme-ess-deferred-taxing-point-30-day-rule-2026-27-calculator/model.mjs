const DAY_MS = 86_400_000;
const MODEL_YEAR = '2026–27';
const CGT_REFORM_START = '2027-07-01';

const BRACKETS = [
  [18_200, 45_000, 0.15],
  [45_000, 135_000, 0.30],
  [135_000, 190_000, 0.37],
  [190_000, Infinity, 0.45],
];

function dollars(value) {
  return Math.round(value * 100) / 100 || 0;
}

function nonnegative(value, label, maximum = 1e12) {
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new RangeError(`Enter a valid ${label} between 0 and ${maximum.toLocaleString('en-AU')}.`);
  }
  return value;
}

function progressiveTax(income) {
  return BRACKETS.reduce((total, [lower, upper, rate]) =>
    total + Math.max(0, Math.min(income, upper) - lower) * rate, 0);
}

export function residentIncomeTax(income) {
  return dollars(progressiveTax(nonnegative(income, 'taxable income')));
}

export function residentTaxWithLevy(income) {
  nonnegative(income, 'taxable income');
  return dollars(progressiveTax(income) + income * 0.02);
}

function additionalTax(base, amount) {
  const total = base + amount;
  return dollars(progressiveTax(total) - progressiveTax(base) + amount * 0.02);
}

function parseDate(value, label) {
  const date = new Date(`${value}T00:00:00Z`);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`Enter a valid ${label}.`);
  }
  return date;
}

export function financialYear(value) {
  const date = parseDate(value, 'date');
  const start = date.getUTCFullYear() - (date.getUTCMonth() < 6 ? 1 : 0);
  return `${start}–${String(start + 1).slice(-2)}`;
}

function firstDiscountDate(startDate) {
  const next = new Date(startDate);
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  // Clamp a leap-day anniversary to the last day of February.
  if (next.getUTCMonth() !== startDate.getUTCMonth()) next.setUTCDate(0);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function calculateEss(input) {
  const { scheme, shares, saleDate } = input;
  if (!['deferred', 'upfront', 'startup'].includes(scheme)) {
    throw new RangeError('Choose an ESS scheme.');
  }
  if (!Number.isInteger(shares) || shares <= 0 || shares > 1e8) {
    throw new RangeError('Enter a whole number of shares from 1 to 100,000,000.');
  }

  const amountPaid = nonnegative(input.amountPaid, 'amount paid per share', 1e6);
  const salePrice = nonnegative(input.salePrice, 'sale price per share', 1e6);
  const sale = parseDate(saleDate, 'sale date');
  const isDeferred = scheme === 'deferred';
  const isStartup = scheme === 'startup';
  const originalDate = isDeferred ? input.taxingPointDate : input.grantDate;
  const original = parseDate(originalDate, isDeferred ? 'original deferred taxing point date' : 'grant date');
  if (sale < original) throw new RangeError('The sale date cannot be before the starting date.');

  const originalYear = financialYear(originalDate);
  const saleYear = financialYear(saleDate);
  const otherEssIncome = isStartup ? 0 : nonnegative(input.otherEssIncome, 'other ESS-year taxable income');
  const otherSaleIncome = !isStartup && originalYear === saleYear
    ? otherEssIncome
    : nonnegative(input.otherSaleIncome, 'other sale-year taxable income');

  const marketValue = isStartup ? amountPaid : nonnegative(
    isDeferred ? input.fmvAtTaxingPoint : input.fmvAtGrant,
    'market value per share', 1e6
  );
  const soldWithin30Days = isDeferred && (sale - original) / DAY_MS <= 30;
  const grossProceeds = dollars(salePrice * shares);
  const employeeCost = dollars(amountPaid * shares);
  const originalDiscount = isStartup ? 0 : Math.max(0, dollars((marketValue - amountPaid) * shares));

  let upfrontReduction = 0;
  if (scheme === 'upfront' && nonnegative(input.adjustedTaxableIncome, 'adjusted taxable income') <= 180_000) {
    upfrontReduction = Math.min(1_000, originalDiscount);
  }

  const assessableEssDiscount = soldWithin30Days
    ? Math.max(0, dollars((salePrice - amountPaid) * shares))
    : dollars(originalDiscount - upfrontReduction);
  const essTaxDate = isStartup ? null : soldWithin30Days ? saleDate : originalDate;
  const essTaxYear = isStartup ? null : soldWithin30Days ? saleYear : originalYear;
  const essBaseline = soldWithin30Days ? otherSaleIncome : otherEssIncome;
  const essTax = additionalTax(essBaseline, assessableEssDiscount);
  const cgtCostBase = soldWithin30Days ? null : dollars(marketValue * shares);
  const rawCapitalGain = soldWithin30Days ? 0 : dollars((salePrice - marketValue) * shares);
  const earliestDiscountDate = soldWithin30Days ? null : firstDiscountDate(original);
  const discountEligible = earliestDiscountDate !== null && saleDate >= earliestDiscountDate;
  const positiveGain = Math.max(0, rawCapitalGain);
  const taxableCapitalGain = discountEligible ? dollars(positiveGain / 2) : positiveGain;
  const saleBaseline = otherSaleIncome + (essTaxYear === saleYear ? assessableEssDiscount : 0);
  const cgtTax = additionalTax(saleBaseline, taxableCapitalGain);

  let crashProtectionSaved = null;
  if (soldWithin30Days) {
    // Compare at the same price with the ESS discount assessed at the original point.
    // On a price fall the hypothetical capital loss generates no current tax credit.
    crashProtectionSaved = salePrice < marketValue
      ? Math.max(0, dollars(additionalTax(otherEssIncome, originalDiscount) - essTax))
      : 0;
  }

  const discountSavings = positiveGain > 0 && saleDate < CGT_REFORM_START &&
    earliestDiscountDate < CGT_REFORM_START
    ? dollars(additionalTax(saleBaseline, positiveGain) -
      additionalTax(saleBaseline, dollars(positiveGain / 2)))
    : null;

  return {
    soldWithin30Days, essTaxDate, essTaxYear, saleYear, earliestDiscountDate,
    assessableEssDiscount, upfrontReduction, cgtCostBase, rawCapitalGain,
    discountEligible, taxableCapitalGain, essTax, cgtTax, crashProtectionSaved,
    discountSavings, grossProceeds, employeeCost,
    netProceeds: dollars(grossProceeds - employeeCost - essTax - cgtTax),
    usesBenchmark: saleYear !== MODEL_YEAR || (essTaxYear !== null && essTaxYear !== MODEL_YEAR),
  };
}
