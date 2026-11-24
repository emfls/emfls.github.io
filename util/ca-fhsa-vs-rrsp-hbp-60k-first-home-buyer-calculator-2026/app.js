import { compareStrategies } from './model.mjs';

const form = document.querySelector('#calculator');
const results = document.querySelector('#results');
const comparisonSummary = document.querySelector('#comparison-summary');
const comparison = document.querySelector('#comparison');
const schedules = document.querySelector('#schedules');
const error = document.querySelector('#error');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const cad = value => money.format(Math.abs(value) < 0.005 ? 0 : value);

const strategies = [
  ['combined', 'FHSA first, then RRSP HBP'],
  ['rrsp', 'RRSP HBP only'],
  ['tfsa', 'TFSA only baseline'],
];

function metric(label, value, className = '') {
  return `<div class="${className}"><dt>${label}</dt><dd>${cad(value)}</dd></div>`;
}

function strategyCard(name, plan, baseline) {
  return `<article class="strategy">
    <h3>${name}</h3>
    <dl>
      ${metric('Cash for closing', plan.downPayment, 'total')}
      ${metric('FHSA withdrawal', plan.fhsa)}
      ${metric('FHSA investment growth¹', plan.fhsaGrowth)}
      ${metric('HBP withdrawal', plan.hbp)}
      ${metric('Other savings', plan.otherSavings)}
      ${metric('Refund savings at closing', plan.refundAtClosing)}
      ${metric('Estimated refund after closing', plan.refundAfterClosing)}
      ${metric('Total refunds above TFSA²', plan.refundTotal - baseline.refundTotal)}
      ${metric('Initial annual HBP minimum', plan.schedule[0]?.minimum ?? 0)}
    </dl>
  </article>`;
}

function scheduleDetails(key, name, plan, wasOpen) {
  const { schedule, missedTax, graceGrowth, foregoneGrowth, rrspRemaining } = plan;
  if (!schedule.length) {
    return `<p><strong>${name}</strong> has no HBP withdrawal to repay.</p>`;
  }

  const rows = schedule.map(({ year, minimum, repaid, included, tax, balance }) =>
    `<tr><th scope="row">${year}</th><td>${cad(minimum)}</td><td>${cad(repaid)}</td><td>${cad(included)}</td><td>${cad(tax)}</td><td>${cad(balance)}</td></tr>`
  ).join('');
  return `<details class="disclosure" id="schedule-${key}"${wasOpen ? ' open' : ''}>
    <summary>${name} · ${schedule[0].year}–${schedule.at(-1).year} · ${cad(missedTax)} extra tax from missed repayments</summary>
    <ul>
      <li>RRSP balance left after the withdrawal: <strong>${cad(rrspRemaining)}</strong></li>
      <li>Growth foregone by the first repayment year: <strong>${cad(graceGrowth)}</strong></li>
      <li>Growth foregone through the final repayment year: <strong>${cad(foregoneGrowth)}</strong></li>
    </ul>
    <div class="scroll" role="region" aria-label="${name} repayment schedule" tabindex="0">
      <table class="repayment-table" aria-label="${name} repayment schedule in Canadian dollars">
        <thead><tr><th scope="col">Year</th><th scope="col">Minimum</th><th scope="col">Repaid</th><th scope="col">Taxable income</th><th scope="col">Extra tax</th><th scope="col">Balance</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </details>`;
}

function render() {
  const controls = [...form.elements].filter(field => field.name);
  const invalid = controls.find(field => !field.validity.valid);
  for (const field of controls) {
    if (field.validity.valid) field.removeAttribute('aria-invalid');
    else field.setAttribute('aria-invalid', 'true');
  }
  if (invalid) {
    error.textContent = `${invalid.labels[0].textContent}. ${invalid.validationMessage}`;
    results.hidden = true;
    return;
  }

  const input = Object.fromEntries(controls.map(field => [
    field.name,
    field.type === 'checkbox' ? field.checked : Number(field.value),
  ]));
  const estimate = compareStrategies(input);
  error.textContent = '';
  const timing = estimate.rrsp.schedule.length || estimate.combined.schedule.length
    ? ` First HBP repayment year is ${estimate.repaymentYear}.`
    : ' No HBP withdrawal is projected.';
  comparisonSummary.textContent = `Closing in ${estimate.purchaseYear} for ${input.buyers === 1 ? 'one buyer' : 'two buyers'}.${timing}`;
  comparison.innerHTML = strategies.map(([key, name]) =>
    strategyCard(name, estimate[key], estimate.tfsa)
  ).join('');
  schedules.innerHTML = strategies.slice(0, 2).map(([key, name]) =>
    scheduleDetails(key, name, estimate[key], document.querySelector(`#schedule-${key}`)?.open)
  ).join('');
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
