import { compareAccounts, cumulativeTfsaRoom } from './model.mjs';

const byId = id => document.getElementById(id);
const number = id => byId(id).valueAsNumber;
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const money = amount => currency.format(amount);
const percent = rate => rate.toLocaleString('en-CA', { maximumFractionDigits: 6 }) + '%';

function connect(formId, update) {
  const form = byId(formId);
  const result = byId(formId + '-result');
  const error = byId(formId + '-error');
  function render() {
    try {
      update(result);
      result.hidden = false;
      error.hidden = true;
      error.textContent = '';
    } catch (issue) {
      if (!(issue instanceof RangeError)) throw issue;
      result.hidden = true;
      error.textContent = issue.message;
      error.hidden = false;
    }
  }
  form.addEventListener('input', render);
  form.addEventListener('submit', event => {
    event.preventDefault();
    render();
  });
  render();
}

connect('room', result => {
  const room = cumulativeTfsaRoom(number('birth-year'), number('residency-year'));
  result.textContent = money(room) + ' in cumulative 2026 TFSA room from annual limits';
});

connect('comparison', () => {
  const estimate = compareAccounts({
    preTax: number('pre-tax'),
    workRate: number('work-rate'),
    retirementRate: number('retirement-rate'),
    clawback: byId('clawback').value,
    refundBehavior: byId('refund').value,
    annualReturn: number('annual-return'),
    years: number('years'),
  });

  byId('winner').textContent = estimate.winner === 'TIE'
    ? 'Tie at ' + money(estimate.tfsaFinal)
    : estimate.winner + ' leaves ' + money(estimate.advantage) + ' more at retirement';
  byId('tfsa-final').textContent = money(estimate.tfsaFinal);
  byId('rrsp-final').textContent = money(estimate.rrspFinal);
  byId('tfsa-contribution').textContent = money(estimate.tfsaContribution);
  byId('rrsp-contribution').textContent = money(estimate.rrspContribution);
  byId('effective-rate').textContent = percent(estimate.effectiveRetirementRate);
  byId('penalty').textContent = money(estimate.clawbackPenalty);
  byId('refund-spent').textContent = money(estimate.refundSpent);
  byId('break-even-effective').textContent = estimate.breakEvenEffectiveRate === null
    ? 'No unique rate' : percent(estimate.breakEvenEffectiveRate);
  byId('break-even-base').textContent = estimate.breakEvenBaseRate === null
    ? 'No unique rate'
    : percent(estimate.breakEvenBaseRate) + (estimate.breakEvenBaseRate < 0
      ? ' (unreachable with a non-negative tax rate)' : '');
});
