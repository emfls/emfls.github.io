import { calculateEI, EI_2026 } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('ei-calculator');
const history = byId('history');
const error = byId('error');
const estimate = byId('estimate');
const scenario = byId('scenario');
const status = byId('status');
const scenarioStatus = byId('scenario-status');

const inputs = [
  ['netIncome', 'income'],
  ['regularBenefits', 'regular'],
  ['specialBenefits', 'special'],
  ['marginalRatePercent', 'rate'],
  ['rrspRoom', 'room'],
].map(([name, id]) => [name, byId(id)]);

const outputs = [
  ['excessIncome', 'excess'],
  ['repaymentBase', 'base'],
  ['repayment', 'repayment'],
  ['afterTaxCost', 'after-tax'],
  ['rrspNeeded', 'needed'],
  ['rrspApplied', 'applied'],
  ['incomeAfterRRSP', 'new-income'],
  ['repaymentAfterRRSP', 'new-repayment'],
  ['grossRepaymentAvoided', 'avoided'],
  ['incomeTaxSaved', 'income-tax'],
  ['combinedSavings', 'combined'],
].map(([name, id]) => [name, byId(id)]);

const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const wholeDollars = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
});
const savingsRate = byId('savings-rate');
const statuses = {
  'special-only': 'Special EI benefits are exempt from repayment.',
  'no-regular-benefits': 'There is no regular or fishing EI to repay.',
  'at-or-below-threshold': 'Your repayment income is at or below the 2026 threshold.',
  'history-unknown': 'Confirm your 2016–2025 EI payment history to estimate repayment.',
  'first-time': 'The 10-year first-time claimant exemption applies.',
  'liable': 'You meet the prior-benefit test and your income exceeds the threshold.',
};

function describeScenario(result, room) {
  if (result.rrspApplied === 0) return 'The room entered is $0, so no deduction was tested.';
  if (result.incomeAfterRRSP === EI_2026.threshold) return 'The tested deduction brings your income to the threshold.';
  const limit = room <= EI_2026.rrspAnnualLimit
    ? 'The available room entered'
    : 'The scenario’s annual dollar cap';
  const gap = result.rrspNeeded - result.rrspApplied;
  return `${limit} leaves ${money.format(gap)} of income above the threshold.`;
}

function render() {
  const values = { priorWeeks: history.value === 'unknown' ? null : Number(history.value) };
  let firstInvalid;
  for (const [name, input] of inputs) {
    const value = input.valueAsNumber;
    if (input.validity.valid && Math.round(value * 100) / 100 === value) {
      input.removeAttribute('aria-invalid');
      values[name] = value;
    } else {
      input.setAttribute('aria-invalid', 'true');
      firstInvalid ??= input;
    }
  }

  if (firstInvalid) {
    const label = firstInvalid.labels[0].textContent;
    const range = firstInvalid.id === 'rate'
      ? '0% to 100%'
      : `${wholeDollars.format(Number(firstInvalid.min))} to ${wholeDollars.format(Number(firstInvalid.max))}`;
    error.textContent = `Enter a valid value for “${label}” (${range}, up to two decimal places).`;
    error.hidden = false;
    estimate.hidden = true;
    return;
  }

  const result = calculateEI(values);
  for (const [name, output] of outputs) {
    output.textContent = result[name] === null ? '—' : money.format(result[name]);
  }
  status.textContent = statuses[result.status];
  scenario.hidden = result.status !== 'liable';
  if (!scenario.hidden) {
    scenarioStatus.textContent = describeScenario(result, values.rrspRoom);
    savingsRate.textContent = result.combinedSavingsRate === null ? '—' : percent.format(result.combinedSavingsRate);
  }

  error.textContent = '';
  error.hidden = true;
  estimate.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
