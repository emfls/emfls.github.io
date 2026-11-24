const PENCE = 100;
export const MAX_AMOUNT = 10_000_000;

const PERSONAL_ALLOWANCE = 12_570 * PENCE;
const TAPER_START = 100_000 * PENCE;
const BASIC_BAND = 37_700 * PENCE;
const ADDITIONAL_START = 125_140 * PENCE;
const CLASS4_UPPER_LIMIT = 50_270 * PENCE;
const ALLOWANCE = 1_000 * PENCE;
const PROPOSED_TRADING_ALLOWANCE = 3_000 * PENCE;
const PROPERTY_NET_FILING_LIMIT = 2_500 * PENCE;
const PROPERTY_GROSS_FILING_LIMIT = 10_000 * PENCE;

const pounds = (pence) => pence / PENCE;
const nonNegative = (value) => Math.max(0, value);

function toPence(amount, name, max = MAX_AMOUNT) {
  const pence = Math.round(amount * PENCE);
  if (!Number.isFinite(amount) || amount < 0 || amount > max || pounds(pence) !== amount) {
    throw new RangeError(`${name} must be between £0 and £${max} with at most two decimal places.`);
  }
  return pence;
}

function taxInPence(income) {
  const allowance = nonNegative(PERSONAL_ALLOWANCE - nonNegative(income - TAPER_START) / 2);
  const taxable = nonNegative(income - allowance);
  const basic = Math.min(taxable, BASIC_BAND);
  const higher = nonNegative(Math.min(taxable, ADDITIONAL_START) - BASIC_BAND);
  const additional = nonNegative(taxable - ADDITIONAL_START);
  return Math.round((basic * 20 + higher * 40 + additional * 45) / 100);
}

function class4InPence(profit) {
  const mainBand = nonNegative(Math.min(profit, CLASS4_UPPER_LIMIT) - PERSONAL_ALLOWANCE);
  const upperBand = nonNegative(profit - CLASS4_UPPER_LIMIT);
  return Math.round((mainBand * 6 + upperBand * 2) / 100);
}

export function incomeTax(income) {
  return pounds(taxInPence(toPence(income, 'Income', 3 * MAX_AMOUNT)));
}

export function class4NIC(tradingProfit) {
  return pounds(class4InPence(toPence(tradingProfit, 'Trading profit')));
}

function compareStream(gross, expenses, eligible, allowance) {
  const actualProfit = gross - expenses;
  const allowanceProfit = eligible ? nonNegative(gross - allowance) : null;
  const loss = nonNegative(-actualProfit);
  if (!eligible || actualProfit < allowanceProfit) {
    return { actualProfit, allowanceProfit, loss, selectedProfit: actualProfit, election: 'ACTUAL_EXPENSES' };
  }
  const election = gross <= allowance ? 'FULL_RELIEF_NO_SA' : `PARTIAL_ALLOWANCE_${pounds(allowance)}`;
  return { actualProfit, allowanceProfit, loss, selectedProfit: allowanceProfit, election };
}

function rentalFilingStatus(gross, property, eligible) {
  if (gross > PROPERTY_GROSS_FILING_LIMIT || property.actualProfit > PROPERTY_NET_FILING_LIMIT) {
    return 'SA_REQUIRED';
  }
  if (property.loss || (gross && !eligible)) return 'CHECK_HMRC';
  if (gross > ALLOWANCE) return 'CONTACT_HMRC';
  return 'NO_SA_FOR_ENTERED_INCOME';
}

function filingStatus(tradingGross, trading, rentalFiling, flags) {
  if (flags.otherReturnRequired || tradingGross > ALLOWANCE || rentalFiling === 'SA_REQUIRED') {
    return 'SA_REQUIRED';
  }
  if (trading.loss) return 'SA_IF_CLAIMING_LOSS';
  if (tradingGross && !flags.tradingEligible) return 'CHECK_HMRC';
  return rentalFiling;
}

function liability(otherIncome, tradingProfit, propertyProfit, class4Applies) {
  // Show losses separately. How losses can be used depends on a separate relief claim.
  const incomeTax = taxInPence(otherIncome + nonNegative(tradingProfit) + nonNegative(propertyProfit));
  const class4 = class4Applies ? class4InPence(tradingProfit) : 0;
  return { incomeTax, class4, total: incomeTax + class4, extraTaxAndNIC: incomeTax + class4 - taxInPence(otherIncome) };
}

function billInPounds(bill) {
  return Object.fromEntries(Object.entries(bill).map(([line, value]) => [line, pounds(value)]));
}

function streamInPounds(stream) {
  return {
    election: stream.election,
    allowanceProfit: stream.allowanceProfit === null ? null : pounds(stream.allowanceProfit),
    actualProfit: pounds(stream.actualProfit),
    selectedProfit: pounds(stream.selectedProfit),
    loss: pounds(stream.loss)
  };
}

export function calculate({
  otherIncome, tradingGross, tradingExpenses, propertyGross, propertyExpenses,
  tradingEligible = true, propertyEligible = true, otherReturnRequired = false, class4Applies = true
}) {
  const flags = { tradingEligible, propertyEligible, otherReturnRequired, class4Applies };
  if (Object.values(flags).some((flag) => typeof flag !== 'boolean')) {
    throw new RangeError('Eligibility and filing selections must be true or false.');
  }

  const other = toPence(otherIncome, 'Other income');
  const sales = toPence(tradingGross, 'Trading receipts');
  const costs = toPence(tradingExpenses, 'Trading expenses');
  const rents = toPence(propertyGross, 'Property receipts');
  const rentalCosts = toPence(propertyExpenses, 'Property expenses');

  const trading = compareStream(sales, costs, tradingEligible, ALLOWANCE);
  const property = compareStream(rents, rentalCosts, propertyEligible, ALLOWANCE);
  const optimal = liability(other, trading.selectedProfit, property.selectedProfit, class4Applies);
  const allExpenses = liability(other, trading.actualProfit, property.actualProfit, class4Applies);
  const allAllowance = tradingEligible && propertyEligible
    ? liability(other, trading.allowanceProfit, property.allowanceProfit, class4Applies)
    : null;

  const nextTrading = compareStream(sales, costs, tradingEligible, PROPOSED_TRADING_ALLOWANCE);
  const next = liability(other, nextTrading.selectedProfit, property.selectedProfit, class4Applies);
  const rentalFiling = rentalFilingStatus(rents, property, propertyEligible);

  return {
    trading: streamInPounds(trading),
    property: streamInPounds(property),
    optimal: billInPounds(optimal),
    allExpenses: billInPounds(allExpenses),
    allAllowance: allAllowance && billInPounds(allAllowance),
    savingsVsExpenses: pounds(allExpenses.total - optimal.total),
    savingsVsAllowance: allAllowance === null ? null : pounds(allAllowance.total - optimal.total),
    filing: filingStatus(sales, trading, rentalFiling, flags),
    rentalFiling,
    preview: {
      trading: streamInPounds(nextTrading),
      bill: billInPounds(next),
      savings: pounds(optimal.total - next.total),
      incomeTaxSavings: pounds(optimal.incomeTax - next.incomeTax),
      class4Savings: pounds(optimal.class4 - next.class4)
    }
  };
}
