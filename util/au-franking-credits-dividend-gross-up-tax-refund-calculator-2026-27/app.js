import { calculateDividend } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('dividend-calculator');
const results = byId('results');
const error = byId('error');
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const percent = new Intl.NumberFormat('en-AU', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2
});
const yieldText = value => value === null ? '—' : percent.format(value / 100);

function setText(id, value) {
  byId(id).textContent = value;
}

function update() {
  const entity = byId('entity').value;
  const isCompany = entity === 'company';
  const isPension = entity === 'pension';
  const includeMedicare = entity === 'individual' && byId('include-medicare').checked;

  byId('medicare-field').hidden = entity !== 'individual';
  byId('company-rate-field').hidden = !isCompany;
  byId('other-income-field').hidden = isPension;
  byId('other-income').disabled = isPension;

  let result;
  try {
    result = calculateDividend({
      cashDividend: byId('cash-dividend').valueAsNumber,
      investmentValue: byId('investment-value').valueAsNumber,
      frankingPercentage: byId('franking-percentage').valueAsNumber,
      imputationRate: Number(byId('imputation-rate').value),
      otherTaxableIncome: isPension ? 0 : byId('other-income').valueAsNumber,
      companyTaxRate: Number(byId('company-rate').value),
      eligibleForCredits: byId('eligible').checked,
      entity,
      includeMedicare
    });
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    results.hidden = true;
    return;
  }

  error.textContent = '';
  results.hidden = false;
  byId('levy-result').hidden = !includeMedicare;
  byId('unused-company-row').hidden = !isCompany;
  setText('cash-yield', yieldText(result.cashYield));
  setText('grossed-up-yield', yieldText(result.grossedUpYield));
  setText('net-yield', yieldText(result.netYield));
  setText('attached-credit', money.format(result.attachedCredit));
  setText('grossed-up', money.format(result.grossedUpDividend));
  setText('extra-tax', money.format(result.incrementalIncomeTax));
  setText('extra-levy', money.format(result.incrementalMedicare));
  setText('credit-applied', money.format(result.creditApplied));
  setText('cash-refund', money.format(result.cashRefund));
  setText('unused-company-credit', money.format(result.unusedCompanyCredit));
  const direction = result.incrementalNetTax < 0 ? ' less' : result.incrementalNetTax > 0 ? ' more' : '';
  setText('net-tax', money.format(Math.abs(result.incrementalNetTax)) + direction);
  setText('net-dividend', money.format(result.netDividend));
  setText('result-announcement', `Net dividend benefit ${money.format(result.netDividend)}. Estimated cash refund ${money.format(result.cashRefund)}.`);
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
window.addEventListener('pageshow', update);
update();
