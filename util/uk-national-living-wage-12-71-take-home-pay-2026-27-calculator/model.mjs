export const WAGE_RATES = Object.freeze({
  '2026': Object.freeze({ adult: 12.71, young: 10.85, under18: 8, apprentice: 8 }),
  '2027': Object.freeze({ adult: 13.21, young: 11.27, under18: 8.31, apprentice: 8.31 }),
});

const WEEKS = 52;
const PERSONAL_ALLOWANCE = 12_570;
const NI_UPPER_LIMIT = 50_270;
const EMPLOYER_THRESHOLD = 5_000;
const PENSION_LOWER_LIMIT = 6_240;
const PENSION_UPPER_LIMIT = 50_270;

const TAX_BANDS = {
  restOfUK: [[37_700, 0.20], [125_140, 0.40], [Infinity, 0.45]],
  scotland: [
    [3_967, 0.19], [16_956, 0.20], [31_092, 0.21],
    [62_430, 0.42], [125_140, 0.45], [Infinity, 0.48],
  ],
};

function amountInBand(pay, lower, upper = Infinity) {
  return Math.max(0, Math.min(pay, upper) - lower);
}

function incomeTax(pay, bands) {
  const allowance = Math.max(0, PERSONAL_ALLOWANCE - amountInBand(pay, 100_000) / 2);
  const taxable = pay - allowance;
  let total = 0;
  let lower = 0;
  for (const [upper, rate] of bands) {
    total += amountInBand(taxable, lower, upper) * rate;
    lower = upper;
  }
  return total;
}

function payPeriods(annual) {
  return { annual, monthly: annual / 12, weekly: annual / WEEKS };
}

// Both wage scenarios are annualised with the same 2026/27 payroll rules.
export function comparePay({
  band, contractedHours, overtimeHours, multiplier, region, pension, apprenticeUnder25 = false,
}) {
  if (!Object.hasOwn(WAGE_RATES['2026'], band) || !Object.hasOwn(TAX_BANDS, region)) {
    throw new RangeError('Choose a wage band and tax region.');
  }
  if (![contractedHours, overtimeHours].every(hours => Number.isFinite(hours) && hours >= 0)
      || contractedHours + overtimeHours > 168) {
    throw new RangeError('Enter non-negative weekly hours totalling no more than 168.');
  }
  if (![1, 1.25, 1.5, 2].includes(multiplier)) {
    throw new RangeError('Choose an overtime multiplier from the list.');
  }
  if (typeof pension !== 'boolean' || typeof apprenticeUnder25 !== 'boolean') {
    throw new TypeError('Choose valid pension and apprentice settings.');
  }

  const weeklyHours = contractedHours + overtimeHours;
  const employerThreshold = band === 'young' || band === 'under18' || apprenticeUnder25
    ? NI_UPPER_LIMIT
    : EMPLOYER_THRESHOLD;

  function estimate(hourlyRate) {
    const annualGross = hourlyRate * (contractedHours + overtimeHours * multiplier) * WEEKS;
    const qualifyingPay = pension ? amountInBand(annualGross, PENSION_LOWER_LIMIT, PENSION_UPPER_LIMIT) : 0;
    const employeePension = qualifyingPay * 0.05;
    const employerPension = qualifyingPay * 0.03;
    const tax = incomeTax(annualGross - employeePension, TAX_BANDS[region]);
    const employeeNI = amountInBand(annualGross, PERSONAL_ALLOWANCE, NI_UPPER_LIMIT) * 0.08
      + amountInBand(annualGross, NI_UPPER_LIMIT) * 0.02;
    const employerNI = amountInBand(annualGross, employerThreshold) * 0.15;
    const annualNet = annualGross - tax - employeeNI - employeePension;
    return {
      hourlyRate,
      gross: payPeriods(annualGross),
      net: payPeriods(annualNet),
      effectiveHourlyNet: weeklyHours > 0 ? annualNet / (weeklyHours * WEEKS) : null,
      tax,
      employeeNI,
      employeePension,
      employerNI,
      employerPension,
      employerCost: annualGross + employerNI + employerPension,
    };
  }

  const april2026 = estimate(WAGE_RATES['2026'][band]);
  const april2027 = estimate(WAGE_RATES['2027'][band]);
  const hourlyRise = Math.round((april2027.hourlyRate - april2026.hourlyRate) * 100) / 100;
  return {
    april2026,
    april2027,
    hourlyRise,
    hourlyRisePercent: hourlyRise / april2026.hourlyRate * 100,
    annualNetRise: april2027.net.annual - april2026.net.annual,
  };
}
