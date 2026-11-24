const FULL_ALLOWANCE = 1_257_000;
const TAPER_START = 10_000_000;
const TAPER_END = 12_514_000;
const BASIC_BAND = 3_770_000;
const gbp = new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP'});

function allowance(income) {
  // HMRC rounds the withdrawal down to a whole pound.
  const withdrawal = Math.floor(Math.max(0, income - TAPER_START) / 200) * 100;
  return Math.max(0, FULL_ALLOWANCE - withdrawal);
}

function annualTax(income) {
  const taxable = Math.max(0, income - allowance(income));
  const basic = Math.min(BASIC_BAND, taxable);
  const higher = Math.max(0, Math.min(taxable, TAPER_END) - BASIC_BAND);
  const additional = Math.max(0, taxable - TAPER_END);
  return Math.floor((basic * 20 + higher * 40 + additional * 45) / 100);
}

export function comparePension({income, current, partner}) {
  if (![income, current].every(value => Number.isSafeInteger(value) && value >= 0) ||
      income > 1_000_000_000 || current > income ||
      !['within', 'above', 'unknown'].includes(partner)) {
    throw new RangeError('Enter annual employment income and eligible net pay pension deductions within that income.');
  }
  const adjusted = income - current;
  const contribution = Math.max(0, adjusted - TAPER_START);
  const after = adjusted - contribution;
  const beforeTax = annualTax(adjusted);
  const afterTax = annualTax(after);
  return {
    adjusted, contribution, after, beforeTax, afterTax,
    allowance: allowance(adjusted), newAllowance: allowance(after),
    recovered: allowance(after) - allowance(adjusted),
    trapIncome: Math.max(0, Math.min(adjusted, TAPER_END) - TAPER_START),
    trapTax: adjusted > TAPER_START ? annualTax(Math.min(adjusted, TAPER_END)) - afterTax : 0,
    taxSaved: beforeTax - afterTax,
    familyIncomeTest: partner === 'above' ? 'Partner exceeds £100,000' :
      partner === 'within' ? 'Within £100,000 threshold after contribution' : 'Check any partner’s income'
  };
}

function pence(value, label) {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value?.trim());
  if (!match) throw new RangeError(`Enter ${label} in pounds with up to two decimal places.`);
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

export function calculate(input) {
  const result = comparePension({
    income: pence(input.income, 'employment income'),
    current: pence(input.current, 'current pension contributions'),
    partner: input.partner
  });
  return Object.fromEntries(Object.entries(result).map(([key, value]) =>
    [key, typeof value === 'number' ? gbp.format(value / 100) : value]));
}
