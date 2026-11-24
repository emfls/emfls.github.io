export const ASSET_LIMIT = 20_000;
export const TURNOVER_LIMIT = 10_000_000;

const COMPANY_RATES = { bre: 0.25, company: 0.30 };
const RESIDENT_BRACKETS = [
  [18_200, 45_000, 0.15],
  [45_000, 135_000, 0.30],
  [135_000, 190_000, 0.37],
  [190_000, Infinity, 0.45],
];

function money(value) {
  const cents = value * 100;
  return Math.round(cents + cents * Number.EPSILON) / 100;
}

function residentTaxBetween(from, to) {
  return RESIDENT_BRACKETS.reduce(
    (tax, [floor, ceiling, rate]) =>
      tax + Math.max(0, Math.min(to, ceiling) - Math.max(from, floor)) * rate,
    0,
  );
}

export function residentIncomeTax(income) {
  return money(residentTaxBetween(0, income));
}

function poolSchedule(basis, lowPoolWriteOff) {
  let balance = basis;
  return Array.from({ length: 5 }, (_, index) => {
    const rate = index === 0 ? 0.15 : 0.30;
    const clearsPool = lowPoolWriteOff && balance > 0 && balance < ASSET_LIMIT;
    const deduction = clearsPool ? balance : money(balance * rate);
    balance = money(balance - deduction);
    return { deduction, balance, clearsPool };
  });
}

export function calculateWriteOff({
  turnover, gstRegistered, assetCost, businessUse, quantity, entity, taxableIncome,
  fullMedicare = true,
}) {
  if (![turnover, assetCost, businessUse, quantity, taxableIncome].every(Number.isFinite)
      || turnover < 0 || assetCost < 0.01 || businessUse < 0 || businessUse > 100
      || !Number.isInteger(quantity) || quantity < 1
      || [turnover, assetCost, Math.abs(taxableIncome)].some(value => value > 1_000_000_000)
      || quantity > 1000 || typeof gstRegistered !== 'boolean' || typeof fullMedicare !== 'boolean'
      || (entity !== 'sole' && !Object.hasOwn(COMPANY_RATES, entity))) {
    throw new RangeError('Enter valid amounts, a business-use share from 0% to 100%, and 1 to 1,000 whole assets.');
  }

  const grossPrice = money(assetCost);
  const share = businessUse / 100;
  const creditPerAsset = gstRegistered ? money(grossPrice / 11 * share) : 0;
  const grossCost = money(grossPrice * quantity);
  const gstCredit = money(creditPerAsset * quantity);
  const thresholdCost = money(grossPrice - creditPerAsset);
  const basis = money(thresholdCost * share * quantity);
  let status = 'instant';
  if (turnover >= TURNOVER_LIMIT) status = 'turnover';
  else if (share === 0) status = 'private';
  else if (thresholdCost >= ASSET_LIMIT) status = 'pool';

  const result = { status, grossCost, gstCredit, thresholdCost, basis };
  if (status === 'turnover') {
    return { ...result, yearOneDeduction: null, taxSaving: null, netCashCost: null, schedule: [] };
  }

  const rateOnly = poolSchedule(basis, false);
  const selected = status === 'pool'
    ? poolSchedule(basis, true)
    : rateOnly.map((_, index) => ({ deduction: index === 0 ? basis : 0, balance: 0, clearsPool: false }));
  const schedule = selected.map((row, index) => ({
    year: index + 1, ...row, rateOnlyDeduction: rateOnly[index].deduction, rateOnlyBalance: rateOnly[index].balance,
  }));
  const yearOneDeduction = schedule[0].deduction;
  const incomeBefore = Math.max(0, taxableIncome);
  const incomeAfter = Math.max(0, money(taxableIncome - yearOneDeduction));
  const incomeReduced = Math.min(incomeBefore, yearOneDeduction);
  const taxSaving = entity === 'sole'
    ? money(residentTaxBetween(incomeAfter, incomeBefore) + (fullMedicare ? 0.02 * incomeReduced : 0))
    : money(incomeReduced * COMPANY_RATES[entity]);
  const netCashCost = money(grossCost - gstCredit - taxSaving);

  return { ...result, schedule, yearOneDeduction, taxSaving, netCashCost };
}
