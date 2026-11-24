export const STATUTORY_RATE = 0.25;
export const IRELAND_PENSION_EXEMPTION = 12_000;
export const SURTAX = 0.48;
export const FEDERAL_BRACKETS = Object.freeze([
  [58_523, 0.14], [117_045, 0.205], [181_440, 0.26], [258_482, 0.29], [Infinity, 0.33],
].map(Object.freeze));

const domestic = Object.freeze({
  dividends: STATUTORY_RATE,
  corporate: STATUTORY_RATE,
  voting: null,
  pension: STATUTORY_RATE,
  nonPeriodicRrif: STATUTORY_RATE,
  rrsp: STATUTORY_RATE,
  social: STATUTORY_RATE,
  royalties: STATUTORY_RATE,
  software: STATUTORY_RATE,
});

const treaty = {
  ...domestic, dividends: 0.15, corporate: 0.05, voting: 10, royalties: 0.10, software: 0.10,
};

export const PRESETS = Object.freeze({
  US: { ...treaty, pension: 0.15, social: 0, software: 0 },
  UK: { ...treaty, pension: 0, social: 0, software: 0 },
  AU: { ...treaty, pension: 0.15, nonPeriodicRrif: 0.15, rrsp: 0.15, social: 0.15 },
  DE: { ...treaty, pension: 0.15, social: 0.15, software: 0 },
  JP: { ...treaty, voting: 25 },
  FR: { ...treaty, software: 0 },
  IE: { ...treaty, pension: 0.15, social: 0.15, software: 0 },
  NONE: domestic,
});
for (const rates of Object.values(PRESETS)) Object.freeze(rates);

export const INCOME = Object.freeze({
  dividends: 'Canadian dividends',
  pension: 'Periodic employer pension',
  rrif: 'RRIF withdrawals',
  rrsp: 'Lump-sum RRSP withdrawal',
  social: 'Periodic CPP / OAS',
  interest: 'Ordinary arm’s-length interest',
  royalties: 'Royalties',
});

const cents = (amount) => Math.round(amount * 100 + Number.EPSILON * Math.abs(amount * 100));
const money = (amount) => cents(amount) / 100;

function amount(value, label, max = 1_000_000_000) {
  if (!Number.isFinite(value) || value < 0 || value > max || Math.abs(value - money(value)) > 1e-9) {
    throw new RangeError(`${label} must be between 0 and ${max.toLocaleString('en-CA')}, with up to two decimal places.`);
  }
  return value;
}

export function federalTax(income) {
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of FEDERAL_BRACKETS) {
    tax += Math.max(0, Math.min(income, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

export function basicPersonalAmount(income) {
  const phaseout = Math.max(0, Math.min(1, (income - 181_440) / (258_482 - 181_440)));
  return 16_452 - 1_623 * phaseout;
}

export function splitRrif(total, minimum, marketValue, payments) {
  const limit = Math.max(2 * cents(minimum), Math.floor(cents(marketValue) / 10));
  const totalCents = cents(total);
  const installment = Math.floor(totalCents / payments);
  // The last installment includes leftover cents. Each payment is classified in full.
  const regularCount = installment ? Math.min(payments - 1, Math.floor(limit / installment)) : 0;
  const periodic = totalCents <= limit ? totalCents : regularCount * installment;
  return { limit: Math.max(2 * minimum, marketValue / 10), periodic: periodic / 100, nonPeriodic: (totalCents - periodic) / 100 };
}

export function section217({ eligible, world, withholding, requiredTax = withholding }) {
  if (eligible <= 0) return null;
  const taxBase = Math.max(eligible, world);
  const fullCredits = cents(eligible) * 10 >= cents(taxBase) * 9;
  const basicCredit = basicPersonalAmount(taxBase) * FEDERAL_BRACKETS[0][1];
  const credit = fullCredits ? basicCredit : Math.min(basicCredit, eligible * FEDERAL_BRACKETS[0][1]);
  const taxBeforeAdjustment = Math.max(0, federalTax(taxBase) - credit) * (1 + SURTAX);
  const tax = money(taxBeforeAdjustment * (eligible / taxBase));
  const savings = money(Math.max(0, requiredTax - tax));
  return {
    fullCredits,
    incomeShare: eligible / taxBase,
    credit: money(credit),
    tax,
    savings,
    refund: savings > 0 ? money(Math.max(0, withholding - tax)) : 0,
    balanceDue: savings > 0 ? money(Math.max(0, tax - withholding)) : 0,
  };
}

export function calculate({
  country = 'US', documented = true, corporate = false, voting = 0,
  japanHoldingMet = false, royaltyType = 'general', irelandAuthorized = false,
  dividends = 0, pension = 0, rrif = 0, rrsp = 0, social = 0,
  interest = 0, royalties = 0, rrifMinimum = 0, rrifValue = 0,
  payments = 12, otherWorldIncome = 0, actualWithheld = null,
} = {}) {
  if (!Object.hasOwn(PRESETS, country)) throw new RangeError('Select a listed treaty residence.');
  if (!['general', 'copyright', 'software'].includes(royaltyType)) throw new RangeError('Select a listed royalty type.');
  const income = { dividends, pension, rrif, rrsp, social, interest, royalties };
  for (const [key, value] of Object.entries(income)) amount(value, INCOME[key]);
  if (corporate && (pension || rrif || rrsp || social)) {
    throw new RangeError('Clear personal retirement income to calculate corporate withholding.');
  }
  amount(voting, 'Voting ownership', 100);
  amount(rrifMinimum, 'RRIF minimum');
  amount(rrifValue, 'RRIF opening value');
  amount(otherWorldIncome, 'Other worldwide net income');
  if (actualWithheld !== null) amount(actualWithheld, 'Actual eligible NR4 tax withheld');
  if (!Number.isInteger(payments) || payments < 1 || payments > 365) throw new RangeError('Use 1 to 365 RRIF payments.');

  const rates = PRESETS[country];
  const plan = splitRrif(rrif, rrifMinimum, rrifValue, payments);
  const corporateRate = corporate && rates.voting !== null && voting >= rates.voting
    && (country !== 'JP' || japanHoldingMet);
  const dividendRate = corporateRate ? rates.corporate : rates.dividends;
  const statutory = Object.fromEntries(Object.entries(income).map(([key, value]) => [
    key, money(value * (key === 'interest' || (key === 'royalties' && royaltyType === 'copyright') ? 0 : STATUTORY_RATE)),
  ]));
  const treaty = {
    dividends: money(dividends * dividendRate),
    pension: money(pension * rates.pension),
    rrif: money(plan.periodic * rates.pension + plan.nonPeriodic * rates.nonPeriodicRrif),
    rrsp: money(rrsp * rates.rrsp),
    social: money(social * rates.social),
    interest: 0,
    royalties: money(royalties * (royaltyType === 'copyright' ? 0 : rates[royaltyType === 'software' ? 'software' : 'royalties'])),
  };
  const sum = (items) => money(Object.values(items).reduce((total, value) => total + value, 0));
  const statutoryTax = sum(statutory);
  const treatyTax = sum(treaty);
  const periodicIncome = money(pension + plan.periodic + social);
  const irishRelief = country === 'IE' ? money(Math.min(IRELAND_PENSION_EXEMPTION, periodicIncome) * rates.pension) : 0;
  const nr5Reduction = documented && irelandAuthorized ? irishRelief : 0;
  const appliedTax = documented ? money(treatyTax - nr5Reduction) : statutoryTax;
  const retirement = ['pension', 'rrif', 'rrsp', 'social'];
  const retirementTax = (table) => sum(retirement.map((key) => table[key]));
  const treatyExempt = (rates.pension === 0 ? pension + plan.periodic : 0) + (rates.social === 0 ? social : 0);
  const eligible = money(pension + rrif + rrsp + social - treatyExempt);
  const requiredTax = money(retirementTax(treaty) - irishRelief);
  const appliedRetirementTax = documented ? money(retirementTax(treaty) - nr5Reduction) : retirementTax(statutory);
  const withholding = actualWithheld ?? appliedRetirementTax;

  const sameAmountRrspTax = money(rrif * (documented ? rates.rrsp : STATUTORY_RATE));
  const sameAmountRrifTax = documented ? treaty.rrif : statutory.rrif;
  const extraIrishRelief = country === 'IE' && documented && irelandAuthorized
    ? money(Math.min(plan.periodic, Math.max(0, IRELAND_PENSION_EXEMPTION - pension - social)) * rates.pension)
    : 0;

  return {
    plan, statutoryTax, treatyTax, appliedTax, nr5Reduction, irishRelief,
    treatySavings: money(statutoryTax - treatyTax),
    rrifComparison: {
      lumpTax: sameAmountRrspTax,
      rrifTax: money(sameAmountRrifTax - extraIrishRelief),
      savings: money(sameAmountRrspTax - sameAmountRrifTax + extraIrishRelief),
    },
    lines: Object.keys(income).map((key) => ({
      key, amount: income[key], statutory: statutory[key], treaty: treaty[key],
    })),
    election: corporate ? null : section217({
      eligible, world: money(sum(income) + otherWorldIncome), withholding, requiredTax,
    }),
  };
}
