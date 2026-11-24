// ATO published 2026–27 repayment table. Income inputs use whole AUD.
export const PROJECTION_YEARS = 50;
const FIRST_YEAR = 2026;
const MAX_AMOUNT = 10_000_000;

// Each lower bound is inclusive. Rates are stored in half-percentage-point units.
const HISTORICAL_BRACKETS = [
  [159664, 20], [150627, 19], [142101, 18], [134057, 17],
  [126468, 16], [119310, 15], [112557, 14], [106186, 13],
  [100175, 12], [94504, 11], [89155, 10], [84108, 9],
  [79347, 8], [74856, 7], [70619, 6], [66621, 5],
  [62851, 4], [54435, 2], [0, 0],
];

function amount(value, label, min, max, wholeDollars = false) {
  if (!Number.isFinite(value) || value < min || value > max ||
      (wholeDollars && !Number.isInteger(value))) {
    throw new RangeError(`Invalid ${label}`);
  }
  return value;
}

function getIncomeParts({
  taxableIncome = 0, investmentLosses = 0, fringeBenefits = 0,
  superContributions = 0, foreignEmploymentIncome = 0,
}) {
  const taxable = amount(taxableIncome, 'taxable income', 0, MAX_AMOUNT, true);
  const addBacks = [investmentLosses, fringeBenefits, superContributions, foreignEmploymentIncome]
    .reduce((sum, value) => sum + amount(value, 'repayment income add-back', 0, MAX_AMOUNT, true), 0);
  return { taxable, addBacks };
}

export function repaymentIncome(options) {
  const { taxable, addBacks } = getIncomeParts(options);
  return taxable + addBacks;
}

function marginalCents(income) {
  if (income <= 69528) return 0;
  if (income <= 129717) return 15 * (income - 69528);
  if (income <= 186050) return 902800 + 17 * (income - 129717);
  return 10 * income;
}

export function marginalRepayment(income) {
  return marginalCents(amount(income, 'repayment income', 0, MAX_AMOUNT * 5, true)) / 100;
}

export function historicalRepayment(income) {
  amount(income, 'repayment income', 0, MAX_AMOUNT * 5, true);
  const [, rate] = HISTORICAL_BRACKETS.find(([lowerBound]) => income >= lowerBound);
  return Math.round(income * rate / 2) / 100;
}

function project({ taxable, addBacks, balanceCents, voluntaryCents, wageGrowth, indexationRate }) {
  const schedule = [];
  let remaining = balanceCents;
  let yearsToPayoff = remaining === 0 ? 0 : null;

  for (let offset = 0; offset < PROJECTION_YEARS && remaining > 0; offset += 1) {
    const opening = remaining;
    const income = Math.round(taxable * (1 + wageGrowth / 100) ** offset) + addBacks;
    const payment = offset === 0 ? Math.min(voluntaryCents, opening) : 0;
    const indexedBalance = opening - payment;
    const indexation = Math.round(indexedBalance * indexationRate / 100);
    const repayment = Math.min(marginalCents(income), indexedBalance + indexation);
    remaining = indexedBalance + indexation - repayment;

    schedule.push({
      year: FIRST_YEAR + offset, income, openingBalance: opening / 100,
      voluntaryPayment: payment / 100, indexation: indexation / 100,
      repayment: repayment / 100, closingBalance: remaining / 100,
    });

    if (remaining === 0) yearsToPayoff = indexedBalance === 0 ? 0 : offset + 1;
  }
  return { schedule, yearsToPayoff };
}

export function calculateHelp(options) {
  const {
    balance = 0, voluntaryPayment = 0, wageGrowth = 0, indexationRate = 0,
  } = options;
  const parts = getIncomeParts(options);
  const income = parts.taxable + parts.addBacks;
  const balanceCents = Math.round(amount(balance, 'HELP balance', 0, MAX_AMOUNT) * 100);
  const voluntaryCents = Math.round(amount(voluntaryPayment, 'voluntary payment', 0, MAX_AMOUNT) * 100);
  amount(wageGrowth, 'wage growth', -100, 25);
  amount(indexationRate, 'indexation rate', 0, 25);

  const inputs = { ...parts, balanceCents, wageGrowth, indexationRate };
  const scenario = project({ ...inputs, voluntaryCents });
  const baseline = voluntaryCents > 0 ? project({ ...inputs, voluntaryCents: 0 }) : scenario;
  const firstYear = scenario.schedule[0];
  const annual = firstYear?.repayment ?? 0;
  const annualCents = Math.round(annual * 100);
  const historical = historicalRepayment(income);
  const incomeBasedCents = marginalCents(income);
  const baselineIndexation = baseline.schedule[0]?.indexation ?? 0;

  return {
    ...scenario,
    income,
    incomeBasedRepayment: incomeBasedCents / 100,
    annual,
    monthly: Math.round(annualCents / 12) / 100,
    fortnightly: Math.round(annualCents / 26) / 100,
    weekly: Math.round(annualCents / 52) / 100,
    effectiveRate: income > 0 ? annualCents / income : 0,
    historicalRepayment: historical,
    historicalSavings: (Math.round(historical * 100) - incomeBasedCents) / 100,
    indexationAvoided: (Math.round(baselineIndexation * 100) - Math.round((firstYear?.indexation ?? 0) * 100)) / 100,
    yearsWithoutVoluntary: baseline.yearsToPayoff,
  };
}
