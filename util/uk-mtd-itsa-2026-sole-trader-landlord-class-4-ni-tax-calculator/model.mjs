const PERSONAL_ALLOWANCE = 1_257_000;
const TAPER_START = 10_000_000;
const BASIC_BAND = 3_770_000;
const ADDITIONAL_START = 12_514_000;
const CLASS_4_UPPER_LIMIT = 5_027_000;
const SMALL_PROFITS_THRESHOLD = 710_500;
const CLASS_2_WEEKLY = 365;

function pence(value) {
  if (!Number.isFinite(value) || value < 0 || value > 100_000_000) {
    throw new RangeError('Enter amounts between £0 and £100,000,000.');
  }
  const rounded = Math.round(value * 100);
  if (rounded / 100 !== value) {
    throw new RangeError('Enter amounts to at most two decimal places.');
  }
  return rounded;
}

function taxBreakdown(income) {
  const allowance = Math.max(0, PERSONAL_ALLOWANCE - Math.max(0, income - TAPER_START) / 2);
  const taxable = Math.max(0, income - allowance);
  const basic = Math.min(taxable, BASIC_BAND);
  const higher = Math.max(0, Math.min(taxable, ADDITIONAL_START) - BASIC_BAND);
  const additional = Math.max(0, taxable - ADDITIONAL_START);
  const tax = Math.round((basic * 20 + higher * 40 + additional * 45) / 100);
  return { allowance: Math.round(allowance), tax };
}

function class4Charge(profit) {
  const main = Math.max(0, Math.min(profit, CLASS_4_UPPER_LIMIT) - PERSONAL_ALLOWANCE);
  const upper = Math.max(0, profit - CLASS_4_UPPER_LIMIT);
  return Math.round((main * 6 + upper * 2) / 100);
}

function instalment(assessed, deducted) {
  const relevant = assessed - deducted;
  // HMRC's tests use the amount after deductions and a strict one-fifth comparison.
  if (relevant < 100_000 || relevant * 5 < assessed) return 0;
  return Math.floor(relevant / 2);
}

export function incomeTax(income) {
  const { allowance, tax } = taxBreakdown(pence(income));
  return { allowance: allowance / 100, tax: tax / 100 };
}

export function class4NationalInsurance(tradingProfit) {
  return class4Charge(pence(tradingProfit)) / 100;
}

export function paymentsOnAccount(assessedTaxAndClass4, taxDeducted) {
  return instalment(pence(assessedTaxAndClass4), pence(taxDeducted)) / 100;
}

function rollout(earlierGross, previousGross, currentGross) {
  const phase = [
    { year: 2026, gross: earlierGross, threshold: 5_000_000 },
    { year: 2027, gross: previousGross, threshold: 3_000_000 },
    { year: 2028, gross: currentGross, threshold: 2_000_000 }
  ].find(({ gross, threshold }) => gross > threshold);

  if (!phase) return { startYear: null, quarterlyDates: [], finalReturnDate: null };

  const { year } = phase;
  return {
    startYear: year,
    quarterlyDates: [`${year}-08-07`, `${year}-11-07`, `${year + 1}-02-07`, `${year + 1}-05-07`],
    finalReturnDate: `${year + 2}-01-31`
  };
}

export function mtdRollout(earlierGross, previousGross, currentGross) {
  return rollout(pence(earlierGross), pence(previousGross), pence(currentGross));
}

export function calculate({
  earlierGross, previousGross, tradeGross, tradeExpenses, rentGross, rentExpenses,
  otherIncome, taxDeducted, priorPayments, savingMonths, voluntaryClass2
}) {
  if (!Number.isInteger(savingMonths) || savingMonths < 1 || savingMonths > 24) {
    throw new RangeError('Enter between 1 and 24 whole monthly deposits before January.');
  }
  if (typeof voluntaryClass2 !== 'boolean') {
    throw new RangeError('Choose whether to include voluntary Class 2.');
  }

  const tradeTurnover = pence(tradeGross);
  const tradeCosts = pence(tradeExpenses);
  const rentTurnover = pence(rentGross);
  const currentGross = tradeTurnover + rentTurnover;
  const tradeProfit = tradeTurnover - tradeCosts;
  const rentProfit = rentTurnover - pence(rentExpenses);
  // Loss relief depends on the taxpayer's circumstances. Estimate with zero taxable
  // profit for a loss-making activity and preserve the signed profit in the result.
  const taxableTrade = Math.max(0, tradeProfit);
  const taxableIncome = taxableTrade + Math.max(0, rentProfit) + pence(otherIncome);
  const { allowance, tax } = taxBreakdown(taxableIncome);
  const class4 = class4Charge(taxableTrade);
  const class2Eligible = (tradeTurnover > 0 || tradeCosts > 0) && taxableTrade < SMALL_PROFITS_THRESHOLD;
  const class2 = voluntaryClass2 && class2Eligible ? CLASS_2_WEEKLY * 52 : 0;

  const deducted = pence(taxDeducted);
  const earlierPayments = pence(priorPayments);
  const annualNet = tax + class4 + class2 - deducted;
  const balance = annualNet - earlierPayments;
  const july = instalment(tax + class4, deducted);
  const january = Math.max(0, balance + july);
  // Keep saving through July. Meet the January deadline as well as the combined total.
  const monthlySaving = Math.ceil(Math.max(january / savingMonths, (january + july) / (savingMonths + 6)));

  return {
    mtd: rollout(pence(earlierGross), pence(previousGross), currentGross),
    currentGross: currentGross / 100,
    tradeProfit: tradeProfit / 100,
    rentProfit: rentProfit / 100,
    allowance: allowance / 100,
    incomeTax: tax / 100,
    class4: class4 / 100,
    class2: class2 / 100,
    class2Eligible,
    balance: balance / 100,
    accountCredit: Math.max(0, -balance - july) / 100,
    january: january / 100,
    july: july / 100,
    monthlySaving: monthlySaving / 100,
    annualMonthlySaving: Math.ceil(Math.max(0, annualNet) / 12) / 100
  };
}
