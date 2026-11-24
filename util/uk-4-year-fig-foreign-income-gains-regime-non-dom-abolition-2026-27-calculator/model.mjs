export const MAX_AMOUNT = 1_000_000_000;
export const MONEY_FIELDS = Object.freeze([
  'ukIncome', 'foreignIncome', 'ukGains', 'foreignGains', 'foreignIncomeTax', 'foreignGainsTax',
]);

const PENNIES = 100;
const MAX_PENNIES = MAX_AMOUNT * PENNIES;
// Use half-pennies for the taper and integer percentage rates for exact comparisons.
const TAX_UNITS_PER_POUND = 20_000;
const PERSONAL_ALLOWANCE = 12_570 * PENNIES;
const TAPER_START = 100_000 * PENNIES;
const BASIC_BAND = 37_700 * PENNIES;
const GAINS_EXEMPTION = 3_000 * PENNIES;
const INCOME_BANDS = {
  main: [[37_700, 20], [125_140, 40], [Infinity, 45]],
  scotland: [[3_967, 19], [16_956, 20], [31_092, 21], [62_430, 42], [125_140, 45], [Infinity, 48]],
};

export function eligibility({ ukResident, nonResidentYears, residenceWindowYear }) {
  if (typeof ukResident !== 'boolean' ||
      !Number.isSafeInteger(nonResidentYears) || nonResidentYears < 0 ||
      !Number.isSafeInteger(residenceWindowYear) || residenceWindowYear < 1) {
    throw new RangeError('Enter valid whole tax years and a UK residence status.');
  }
  if (!ukResident) return 'INELIGIBLE_NOT_UK_RESIDENT';
  if (nonResidentYears < 10) return 'INELIGIBLE_10YR_RULE';
  if (residenceWindowYear > 4) return 'EXPIRED_YEAR_5+';
  return 'ELIGIBLE_4YR_FIG';
}

function grossTaxes(income, gains, bands, keepAllowances) {
  const allowance = keepAllowances
    ? Math.max(0, 2 * PERSONAL_ALLOWANCE - Math.max(0, income - TAPER_START))
    : 0;
  const taxableIncome = Math.max(0, 2 * income - allowance);
  let incomeTax = 0;
  let lower = 0;
  for (const [upperPounds, rate] of bands) {
    const upper = upperPounds * (2 * PENNIES);
    incomeTax += Math.max(0, Math.min(taxableIncome, upper) - lower) * rate;
    lower = upper;
  }

  const taxableGains = 2 * Math.max(0, gains - (keepAllowances ? GAINS_EXEMPTION : 0));
  const gainsAt18 = Math.min(taxableGains, Math.max(0, 2 * BASIC_BAND - taxableIncome));
  const gainsTax = gainsAt18 * 18 + (taxableGains - gainsAt18) * 24;
  return { incomeTax, gainsTax, allowance };
}

function arisingTaxes(data, bands, foreignIncome, foreignGains) {
  const totalIncome = data.ukIncome + foreignIncome;
  const gross = grossTaxes(totalIncome, data.ukGains + foreignGains, bands, true);
  const withoutForeignIncome = grossTaxes(data.ukIncome, 0, bands, true);
  const withoutForeignGains = grossTaxes(totalIncome, data.ukGains, bands, true);
  const incomeCredit = Math.min(200 * data.foreignIncomeTax, gross.incomeTax - withoutForeignIncome.incomeTax);
  const gainsCredit = Math.min(200 * data.foreignGainsTax, gross.gainsTax - withoutForeignGains.gainsTax);
  return {
    incomeTax: gross.incomeTax - incomeCredit,
    gainsTax: gross.gainsTax - gainsCredit,
    incomeCredit,
    gainsCredit,
    allowance: gross.allowance,
  };
}

function total({ incomeTax, gainsTax }) {
  return incomeTax + gainsTax;
}

function pounds(units) {
  return units / TAX_UNITS_PER_POUND;
}

function summarize(taxes) {
  return {
    incomeTax: pounds(taxes.incomeTax),
    gainsTax: pounds(taxes.gainsTax),
    total: pounds(total(taxes)),
    personalAllowance: taxes.allowance / (2 * PENNIES),
    incomeCredit: pounds(taxes.incomeCredit ?? 0),
    gainsCredit: pounds(taxes.gainsCredit ?? 0),
  };
}

function minimumToMatch(savingsAt) {
  if (savingsAt(MAX_PENNIES) < 0) return null;
  let low = 0;
  let high = MAX_PENNIES;
  // Net tax is non-decreasing on both axes, including when a credit is capped.
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (savingsAt(mid) >= 0) high = mid;
    else low = mid + 1;
  }
  return low / PENNIES;
}

export function calculate(inputs) {
  const status = eligibility(inputs);
  if (!Object.hasOwn(INCOME_BANDS, inputs.region)) throw new RangeError('Choose a UK income tax region.');
  const data = {};
  for (const field of MONEY_FIELDS) {
    const amount = inputs[field];
    const pennies = Math.round(amount * PENNIES);
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT || pennies / PENNIES !== amount) {
      throw new RangeError('Enter amounts from £0 to £1 billion with up to two decimal places.');
    }
    data[field] = pennies;
  }

  const result = {
    status,
    arising: null,
    fig: null,
    netSavings: null,
    allowanceCost: null,
    breakEven: null,
    hasClaimAmounts: data.foreignIncome > 0 || data.foreignGains > 0,
  };
  if (!inputs.ukResident) return result;

  const bands = INCOME_BANDS[inputs.region];
  const arising = arisingTaxes(data, bands, data.foreignIncome, data.foreignGains);
  result.arising = summarize(arising);
  if (status !== 'ELIGIBLE_4YR_FIG') return result;

  const fig = grossTaxes(data.ukIncome, data.ukGains, bands, false);
  const ukWithAllowances = grossTaxes(data.ukIncome, data.ukGains, bands, true);
  const savingsAt = (income, gains) => total(arisingTaxes(data, bands, income, gains)) - total(fig);

  result.fig = summarize(fig);
  result.netSavings = pounds(total(arising) - total(fig));
  result.allowanceCost = pounds(total(fig) - total(ukWithAllowances));
  result.breakEven = {
    foreignIncome: minimumToMatch(income => savingsAt(income, data.foreignGains)),
    foreignGains: minimumToMatch(gains => savingsAt(data.foreignIncome, gains)),
  };
  return result;
}
