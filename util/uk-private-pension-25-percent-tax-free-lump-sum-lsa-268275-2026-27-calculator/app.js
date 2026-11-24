import { calculateWithdrawal, MAX_AMOUNT, MPAA } from './model.mjs';

const form = document.querySelector('#pension-calculator');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const sterling = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const money = amount => sterling.format(amount);
const wholePounds = amount => sterling.format(amount).replace(/\.00$/, '');
const methods = ['pcls_drawdown', 'ufpls'];

function update() {
  const selected = form.elements.method.value;
  const inputs = {};

  for (const field of form.querySelectorAll('input')) {
    const invalid = !field.validity.valid || field.valueAsNumber > MAX_AMOUNT;
    if (invalid) {
      error.textContent = `Check “${field.labels[0].textContent}”. Enter a value from £0 to £1 billion with up to two decimal places.`;
      error.hidden = false;
      results.hidden = true;
      return;
    }
    if (field.value !== '') inputs[field.name] = field.valueAsNumber;
  }

  error.hidden = true;
  results.hidden = false;
  const primary = document.getElementById(selected);
  if (results.firstElementChild !== primary) results.prepend(primary);

  for (const method of methods) {
    const card = document.getElementById(method);
    const values = card.querySelector('dl');
    const message = card.querySelector('.scenario-note');
    card.classList.toggle('selected', method === selected);
    card.querySelector('.selected-label').hidden = method !== selected;

    let estimate;
    try {
      estimate = calculateWithdrawal({ ...inputs, method });
    } catch (issue) {
      if (!(issue instanceof RangeError)) throw issue;
      values.hidden = true;
      message.textContent = issue.message;
      continue;
    }

    const amounts = { ...estimate, mpaa: estimate.mpaaTriggered
      ? `Triggers ${wholePounds(MPAA)} MPAA`
      : 'No new MPAA trigger' };

    for (const output of values.querySelectorAll('dd')) {
      const value = amounts[output.dataset.result];
      output.textContent = typeof value === 'number' ? money(value) : value;
    }
    values.hidden = false;

    const notes = [];
    if (estimate.cappedTaxFreeAmount > 0) {
      notes.push(method === 'ufpls'
        ? `${money(estimate.cappedTaxFreeAmount)} of the usual 25% slice is taxable because an allowance is exhausted.`
        : `${money(estimate.cappedTaxFreeAmount)} of the usual 25% stays in drawdown before any taxable payment because an allowance is exhausted.`);
    }
    if (estimate.incomeInTaperBand > 0) {
      notes.push(`${money(estimate.incomeInTaperBand)} falls in the 60% effective tax band, including ${money(estimate.extraTaxFromTaper)} of tax from lost Personal Allowance.`);
    } else {
      notes.push('This withdrawal falls outside the 60% Personal Allowance taper band.');
    }
    if (estimate.emergencyPayeWarning) {
      notes.push('An emergency Month 1 tax code on a first taxable payment can mean too much PAYE is withheld. Net cash here reflects annual tax.');
    }
    message.textContent = notes.join(' ');
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
