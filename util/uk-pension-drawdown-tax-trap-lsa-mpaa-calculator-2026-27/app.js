import { compareWithdrawals, isValidAmount } from './model.mjs';

const form = document.querySelector('#pension-form');
const error = document.querySelector('#pension-error');
const comparison = document.querySelector('#comparison');
const grid = document.querySelector('#scenario-grid');
const template = document.querySelector('#scenario-template');
const status = document.querySelector('#result-announcement');
const amounts = [...form.querySelectorAll('input[type="number"]')];
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const mpaaNotes = {
  triggered: 'MPAA triggered by this payment. The money purchase annual allowance is £10,000.',
  'not-triggered': 'This payment leaves the MPAA untriggered. The standard annual allowance is £60,000, subject to eligibility.',
  'already-active': 'MPAA already applies. The money purchase annual allowance is £10,000.'
};

const scenarios = [
  { key: 'drawdown', title: 'Flexi-access drawdown' },
  { key: 'ufpls', title: 'UFPLS' }
].map(({ key, title }) => {
  const card = template.content.firstElementChild.cloneNode(true);
  card.querySelector('h3').textContent = title;
  if (key === 'ufpls') card.querySelector('[data-drawdown-only]').remove();
  grid.append(card);
  return {
    key,
    balanceLabel: card.querySelector('[data-balance-label]'),
    values: [...card.querySelectorAll('[data-value]')],
    mpaaNote: card.querySelector('[data-mpaa]')
  };
});

function update() {
  const input = Object.fromEntries(amounts.map((field) => [field.name, field.valueAsNumber]));
  const invalid = amounts.filter((field) => !field.validity.valid || !isValidAmount(field.valueAsNumber));
  const insufficientCrystallised = invalid.length === 0 && input.cash > input.crystallised;
  for (const field of amounts) {
    const invalidAmount = invalid.includes(field) || (insufficientCrystallised && field.name === 'crystallised');
    field.setAttribute('aria-invalid', String(invalidAmount));
    if (invalidAmount) field.setAttribute('aria-errormessage', error.id);
    else field.removeAttribute('aria-errormessage');
  }

  if (invalid.length || insufficientCrystallised) {
    error.textContent = invalid.length
      ? 'Enter each amount from £0 to £1,000,000,000, with up to two decimal places.'
      : 'The amount crystallised must cover the gross cash requested.';
    error.hidden = false;
    comparison.hidden = true;
    status.textContent = '';
    return;
  }

  const estimates = compareWithdrawals({
    ...input,
    mpaaAlreadyActive: form.elements.mpaaAlreadyActive.checked
  });

  for (const { key, balanceLabel, values, mpaaNote } of scenarios) {
    const estimate = estimates[key];
    balanceLabel.textContent = estimate.shortfall > 0 ? 'Estimated tax shortfall' : 'Estimated overpayment';
    for (const value of values) {
      const metric = value.dataset.value;
      value.textContent = gbp.format(metric === 'balance' ? estimate.shortfall || estimate.overpayment : estimate[metric]);
    }
    mpaaNote.textContent = mpaaNotes[estimate.mpaaStatus];
  }

  error.hidden = true;
  error.textContent = '';
  comparison.hidden = false;
  status.textContent = `Cash paid now: ${gbp.format(estimates.drawdown.cashNow)} from flexi-access drawdown and ${gbp.format(estimates.ufpls.cashNow)} from UFPLS.`;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});
update();

// Initialise only placements with an ad unit ID from the configured publisher.
for (const placement of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (placement.dataset.adSlot) (window.adsbygoogle ||= []).push({});
}
