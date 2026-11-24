import { comparePensions, contributionEstimate } from './model.mjs';

const byId = (id) => document.getElementById(id);
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const pensionForm = byId('pension-form');
const contributionForm = byId('contribution-form');
const totalsBasis = byId('totals-basis');

function readNumber(id) {
  const input = byId(id);
  const valid = input.validity.valid && Number.isFinite(input.valueAsNumber);
  input.setAttribute('aria-invalid', String(!valid));
  if (valid) return input.valueAsNumber;
  if (input.validity.stepMismatch) {
    throw new RangeError(input.labels[0].textContent + ' accepts up to two decimal places.');
  }
  throw new RangeError(input.labels[0].textContent + ' needs a number ' +
    (input.max ? 'from ' + input.min + ' to ' + input.max + '.' : 'of at least ' + input.min + '.'));
}

function renderRows(id, rows) {
  const elements = rows.map(([label, ...values]) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    for (const value of values) {
      const cell = row.insertCell();
      cell.textContent = value;
    }
    return row;
  });
  byId(id).replaceChildren(...elements);
}

function formatAge(months) {
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return years + ' yr' + (remainder ? ' ' + remainder + ' mo' : '');
}

function renderPensions() {
  const assumptions = {
    monthly: readNumber('monthly'),
    inflationRate: readNumber('inflation'),
    discountRate: readNumber('discount'),
    taxRate: readNumber('tax'),
  };
  const result = comparePensions(assumptions);
  byId('real-rate').textContent = 'Effective real opportunity cost: ' + percent.format(result.realDiscountRate / 100);
  renderRows('monthly-rows', result.monthly.map(({ age, gross, net }) => [
    age, cad.format(gross), cad.format(net),
  ]));
  const noPayments = assumptions.monthly === 0 || assumptions.taxRate === 100;
  const noCrossing = noPayments ? 'N/A' : 'Never';
  renderRows('break-rows', result.breakEvens.map(({ earlyAge, lateAge, nominal, real, present }) => [
    lateAge + ' vs ' + earlyAge,
    ...[nominal, real, present].map((months) => months === null ? noCrossing : formatAge(months)),
  ]));
  byId('break-note').textContent = noPayments
    ? 'Enter a positive after-tax pension to compare break-even ages.'
    : 'Before each crossover, the earlier option leads once it starts. “Never” means the later option cannot catch up under these assumptions.';
  renderRows('totals-rows', result.milestones.map((row) => [
    row.age, ...row[totalsBasis.value].map((value) => cad.format(value)),
  ]));
}

function renderContribution() {
  const result = contributionEstimate(readNumber('earnings'), byId('work-type').value);
  byId('cpp-amount').textContent = cad.format(result.cpp);
  byId('cpp2-amount').textContent = cad.format(result.cpp2);
  byId('cpp-total').textContent = cad.format(result.total);
}

function bindLive(form, render, resultId, errorId) {
  const result = byId(resultId);
  const error = byId(errorId);
  function update() {
    try {
      render();
      error.hidden = true;
      error.textContent = '';
      result.hidden = false;
    } catch (problem) {
      if (!(problem instanceof RangeError)) throw problem;
      result.hidden = true;
      error.hidden = false;
      error.textContent = problem.message;
    }
  }
  form.addEventListener('input', update);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    update();
  });
  update();
  return update;
}

const updatePensions = bindLive(pensionForm, renderPensions, 'pension-results', 'pension-error');
totalsBasis.addEventListener('change', updatePensions);
bindLive(contributionForm, renderContribution, 'contribution-results', 'contribution-error');

// AdSense unit IDs belong to the publisher. Request only configured units.
for (const ad of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(ad.dataset.adSlot)) (window.adsbygoogle ||= []).push({});
}
