const realPropertyRates = Object.freeze({
  2021: 5.10, 2022: 5.35, 2023: 8.85, 2024: 9.35, 2025: 8.95, 2026: 9.35
});

export const CURRENT_RATE = realPropertyRates[2026];
export const PRIOR_RATE = realPropertyRates[2025];
const NALI_RATE = 0.45;
const MAX_LVR = 0.70;
const MAX_TERM_MONTHS = 180;
const MAX_FIXED_MONTHS = 60;
const MAX_AMOUNT = 1e12;

function requireNumber(value, minimum, maximum, label) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum.toLocaleString('en-AU')} and ${maximum.toLocaleString('en-AU')}.`);
  }
}

function requireChoice(value, options, label) {
  if (!options.includes(value)) throw new RangeError(`Select ${label}.`);
}

function termMonths(years, minimum, maximum, label) {
  requireNumber(years, minimum, maximum, label);
  const months = Math.round(years * 12);
  if (Math.abs(years * 12 - months) > 0.00001) {
    throw new RangeError(`${label} must resolve to whole months. For example, use 5.5 for 5 years and 6 months.`);
  }
  return months;
}

function parseDate(value, label) {
  const date = new Date(`${value}T00:00:00Z`);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`Enter a valid ${label}.`);
  }
  return date;
}

function addMonths(date, months) {
  const first = new Date(date.getTime());
  first.setUTCDate(1);
  first.setUTCMonth(first.getUTCMonth() + months);
  const last = new Date(first.getTime());
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  first.setUTCDate(Math.min(date.getUTCDate(), last.getUTCDate()));
  return first;
}

export function monthlyPayment(principal, annualRate, months) {
  requireNumber(principal, 0, MAX_AMOUNT, 'Principal');
  requireNumber(annualRate, 0, 100, 'Annual rate');
  if (!Number.isSafeInteger(months) || months < 1) {
    throw new RangeError('Repayment months must be a positive whole number.');
  }
  const monthlyRate = annualRate / 1200;
  if (monthlyRate === 0) return principal / months;
  return principal * (monthlyRate / -Math.expm1(-months * Math.log1p(monthlyRate)));
}

export function calculate(input) {
  const {
    propertyValue, originalLoan, balance, remainingYears, elapsedYears, actualRate,
    repayment, property, rateType, registeredMortgage, executedAgreement,
    rentalIncome, capitalGain, discountEligible, phase
  } = input;
  requireNumber(propertyValue, 0.01, MAX_AMOUNT, 'Property value at borrowing');
  requireNumber(originalLoan, 0.01, MAX_AMOUNT, 'Combined loan amount at borrowing');
  requireNumber(balance, 0.01, MAX_AMOUNT, 'Outstanding balance');
  requireNumber(actualRate, 0, 100, 'Actual annual interest rate');
  requireNumber(rentalIncome, -MAX_AMOUNT, MAX_AMOUNT, 'Annual net rental income');
  requireNumber(capitalGain, -MAX_AMOUNT, MAX_AMOUNT, 'Projected capital gain');
  requireChoice(repayment, ['monthly_pi', 'interest_only', 'other'], 'a repayment type');
  requireChoice(property, [
    'pre_10_aug_2026_transitional', 'business_real_property', 'new_residential_post_10_aug_2026'
  ], 'a property and timing category');
  requireChoice(rateType, ['variable', 'fixed'], 'an interest-rate type');
  requireChoice(phase, ['accumulation_15pct', 'pension_0pct'], 'a fund phase');
  requireChoice(registeredMortgage, [true, false], 'the registered mortgage status');
  requireChoice(executedAgreement, [true, false], 'the executed loan agreement status');
  requireChoice(discountEligible, [true, false], 'the CGT discount status');

  const remainingMonths = termMonths(remainingYears, 1, 20, 'Remaining term in years');
  const elapsedMonths = termMonths(elapsedYears, 0, 100, 'Elapsed term in years');
  const totalMonths = remainingMonths + elapsedMonths;
  const ratio = originalLoan / propertyValue;
  const propertyEligible = property !== 'new_residential_post_10_aug_2026';
  const failedGates = [];
  let expectedRate = CURRENT_RATE;

  if (rateType === 'fixed') {
    const { fixedStart, fixedMonths, assessmentDate, fixedAtCommencement } = input;
    requireChoice(fixedAtCommencement, [true, false], 'whether the fixed terms meet the commencement and reversion checks');
    const start = parseDate(fixedStart, 'fixed-rate start date');
    const assessed = parseDate(assessmentDate, 'assessment date');
    if (assessmentDate < '2026-07-01' || assessmentDate > '2027-06-30') {
      throw new RangeError('Choose an assessment date from 1 July 2026 to 30 June 2027.');
    }
    if (!Number.isInteger(fixedMonths) || fixedMonths < 1 || fixedMonths > 240) {
      throw new RangeError('Enter a fixed period from 1 to 240 whole months.');
    }

    const startYear = start.getUTCFullYear() - Number(start.getUTCMonth() < 6);
    const end = addMonths(start, fixedMonths);
    const active = start <= assessed && assessed < end;
    if (active) expectedRate = realPropertyRates[startYear] ?? null;
    if (!fixedAtCommencement || !active || fixedMonths > MAX_FIXED_MONTHS
        || end > addMonths(assessed, remainingMonths)) {
      failedGates.push('fixed_window');
    }
  }

  if (expectedRate === null || Math.abs(actualRate - expectedRate) > 1e-9) failedGates.push('rate');
  if (ratio > MAX_LVR) failedGates.push('lvr');
  if (totalMonths > MAX_TERM_MONTHS) failedGates.push('term');
  if (repayment !== 'monthly_pi') failedGates.push('repayment');
  if (!registeredMortgage) failedGates.push('mortgage');
  if (!executedAgreement) failedGates.push('agreement');
  if (!propertyEligible) failedGates.push('property');

  const currentPayment = monthlyPayment(balance, CURRENT_RATE, remainingMonths);
  const priorPayment = monthlyPayment(balance, PRIOR_RATE, remainingMonths);
  const ordinaryRate = phase === 'pension_0pct' ? 0 : 0.15;
  const taxableRent = Math.max(rentalIncome, 0);
  const taxableGain = Math.max(capitalGain, 0) * (discountEligible ? 2 : 3) / 3;
  const ordinaryRent = taxableRent * ordinaryRate;
  const naliRent = taxableRent * NALI_RATE;
  const ordinarySale = taxableGain * ordinaryRate;
  const naliSale = taxableGain * NALI_RATE;

  return {
    verdict: failedGates.length ? 'NALI_RISK' : 'COMPLIANT',
    failedGates, propertyEligible, expectedRate, lvr: ratio * 100, totalYears: totalMonths / 12,
    currentPayment, priorPayment, paymentIncrease: currentPayment - priorPayment,
    tax: {
      ordinaryRent, naliRent, rentIncrease: naliRent - ordinaryRent,
      taxableGain, ordinarySale, naliSale, saleIncrease: naliSale - ordinarySale
    }
  };
}
