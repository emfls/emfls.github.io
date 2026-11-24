// Values enter and leave in GBP. Internal cash and band calculations use pence.
export const MAX_AMOUNT = 1_000_000_000;

const ALLOWANCE = 1_257_000;
const TAPER_START = 10_000_000;
const BASIC_LIMIT = 3_770_000;
const ADDITIONAL_THRESHOLD = 12_514_000;
const MAIN_RATES = [20, 40, 45];
const BUDGET_PROPERTY_RATES = [24, 44, 49];

function toPence(amount, name, minimum = 0) {
  if (!Number.isFinite(amount) || amount < minimum || amount > MAX_AMOUNT
      || Math.round(amount * 100) / 100 !== amount) {
    throw new RangeError(`${name} must be a supported amount in pounds and pence.`);
  }
  return Math.round(amount * 100);
}

function allowancePence(adjustedNetIncome) {
  return Math.max(0, ALLOWANCE - Math.max(0, adjustedNetIncome - TAPER_START) / 2);
}

export function personalAllowance(adjustedNetIncome) {
  return allowancePence(toPence(adjustedNetIncome, 'Adjusted net income')) / 100;
}

function bandTax(taxableIncome, rates) {
  return (
    Math.min(taxableIncome, BASIC_LIMIT) * rates[0]
    + Math.max(0, Math.min(taxableIncome, ADDITIONAL_THRESHOLD) - BASIC_LIMIT) * rates[1]
    + Math.max(0, taxableIncome - ADDITIONAL_THRESHOLD) * rates[2]
  ) / 100;
}

function corporationTaxPence(profit) {
  if (profit <= 0) return 0;
  if (profit <= 5_000_000) return Math.round(profit * 19 / 100);
  const reliefUnits = Math.max(0, 25_000_000 - profit) * 3;
  return Math.round((profit * 50 - reliefUnits) / 200);
}

// Standalone, eligible UK SPV with a 12-month period and no other augmented profits.
export function corporationTax(profit) {
  return corporationTaxPence(toPence(profit, 'Company profit', -MAX_AMOUNT)) / 100;
}

function personalScenario({
  taxableOther, taxableTotal, baselineTax, creditBase, availableFinance, cash, propertyRates,
}) {
  const otherTax = bandTax(taxableOther, MAIN_RATES);
  const propertyTax = bandTax(taxableTotal, propertyRates) - bandTax(taxableOther, propertyRates);
  const combinedTax = otherTax + propertyTax;
  const exactCredit = Math.min(combinedTax, creditBase * propertyRates[0] / 100);
  const credit = Math.round(exactCredit);
  const taxBeforeCredit = Math.round(combinedTax - baselineTax);
  const tax = taxBeforeCredit - credit;
  return {
    taxBeforeCredit: taxBeforeCredit / 100,
    credit: credit / 100,
    financeCostsCarriedForward: (availableFinance - creditBase) / 100,
    tax: tax / 100,
    afterTaxCash: (cash - tax) / 100,
    effectiveRate: cash > 0 ? tax / cash : null,
  };
}

export function calculateComparison({
  otherIncome, rent, expenses, financeCosts, broughtForwardFinance = 0, broughtForwardLosses = 0,
}) {
  const other = toPence(otherIncome, 'Other income');
  const paper = toPence(rent, 'Rent') - toPence(expenses, 'Expenses');
  const finance = toPence(financeCosts, 'Finance costs');
  const availableFinance = finance + toPence(broughtForwardFinance, 'Brought-forward finance costs');
  const losses = toPence(broughtForwardLosses, 'Brought-forward property losses');
  const propertyProfit = Math.max(0, paper - losses);
  const cash = paper - finance;
  const income = other + propertyProfit;
  const allowance = allowancePence(income);
  const baselineAllowance = allowancePence(other);
  const taxableTotal = Math.max(0, income - allowance);
  // For 2027/28 the allowance goes to non-property income first. With equal
  // rates across these income sources in 2026/27 the allocation is immaterial.
  const taxableOther = Math.max(0, other - allowance);
  const context = {
    taxableOther,
    taxableTotal,
    baselineTax: bandTax(Math.max(0, other - baselineAllowance), MAIN_RATES),
    creditBase: Math.min(availableFinance, propertyProfit, taxableTotal),
    availableFinance,
    cash,
  };
  const personal2026 = personalScenario({ ...context, propertyRates: MAIN_RATES });
  const personal2027 = personalScenario({ ...context, propertyRates: BUDGET_PROPERTY_RATES });
  const companyTax = corporationTaxPence(cash);

  return {
    paperProfit: paper / 100,
    personalPropertyProfit: propertyProfit / 100,
    propertyLossesCarriedForward: Math.max(0, losses - paper) / 100,
    preTaxCash: cash / 100,
    adjustedNetIncome: income / 100,
    allowance: allowance / 100,
    allowanceLost: (baselineAllowance - allowance) / 100,
    crossesTaper: other <= TAPER_START && income > TAPER_START,
    personal2026,
    personal2027,
    yearTaxChange: Math.round((personal2027.tax - personal2026.tax) * 100) / 100,
    company: {
      tax: companyTax / 100,
      afterTaxCash: (cash - companyTax) / 100,
      effectiveRate: cash > 0 ? companyTax / cash : null,
    },
  };
}
