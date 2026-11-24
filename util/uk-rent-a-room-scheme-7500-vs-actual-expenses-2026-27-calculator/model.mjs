export const ALLOWANCES = Object.freeze({ solo: 7500, joint: 3750 });
export const TAX_RATES = Object.freeze([0, 19, 20, 21, 40, 42, 45, 48]);
export const MAX_AMOUNT = 1_000_000;

function toPence(amount, label) {
  const pence = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT || pence / 100 !== amount) {
    throw new RangeError(`Enter ${label} from £0 to £1,000,000, with up to two decimal places.`);
  }
  return pence;
}

function methodResult(profit, loss, cashBeforeTax, taxRate) {
  const tax = Math.round(profit * taxRate / 100);
  const cash = cashBeforeTax - tax;
  const monthlyCash = Math.sign(cash) * Math.round(Math.abs(cash) / 12) / 100;
  return {
    taxableProfit: profit / 100,
    tax: tax / 100,
    loss: loss / 100,
    annualCash: cash / 100,
    monthlyCash: monthlyCash || 0
  };
}

// Inputs are each recipient's own share. Amounts are in GBP and taxRate is a percentage.
export function calculateRentARoom({ ownership, monthlyRent, monthlyExtras, months, expenses, taxRate }) {
  if (!Object.hasOwn(ALLOWANCES, ownership)) {
    throw new RangeError('Choose whether you receive the income alone or share it.');
  }
  if (!Number.isInteger(months) || months < 1 || months > 12) {
    throw new RangeError('Enter a whole number of months from 1 to 12.');
  }
  if (!TAX_RATES.includes(taxRate)) {
    throw new RangeError('Choose a supported marginal tax rate.');
  }

  const allowance = ALLOWANCES[ownership];
  const gross = (toPence(monthlyRent, 'monthly rent') + toPence(monthlyExtras, 'monthly extras')) * months;
  const net = gross - toPence(expenses, 'annual expenses');
  const automaticallyExempt = gross <= allowance * 100;
  const actual = {
    netProfit: net / 100,
    ...methodResult(Math.max(0, net), Math.max(0, -net), net, taxRate)
  };
  const allowanceMethod = methodResult(Math.max(0, gross - allowance * 100), 0, net, taxRate);

  let recommendation = 'tie';
  if (automaticallyExempt) {
    recommendation = actual.loss > 0 ? 'consider-loss-election' : 'exempt';
  } else if (actual.loss > 0 || actual.tax < allowanceMethod.tax) {
    recommendation = 'actual';
  } else if (allowanceMethod.tax < actual.tax) {
    recommendation = 'allowance';
  }

  return {
    allowance,
    grossReceipts: gross / 100,
    automaticallyExempt,
    filingRequired: !automaticallyExempt,
    actual,
    allowanceMethod,
    recommendation,
    annualTaxSaved: Math.round(Math.abs(actual.tax - allowanceMethod.tax) * 100) / 100
  };
}
