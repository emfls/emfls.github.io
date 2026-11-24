import { compareRelief, vctClawback } from './model.mjs';

const form = document.querySelector('#calculator');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const pence = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const numbers = Array.from(form.querySelectorAll('input[type="number"]'));

function put(id, value) {
  document.getElementById(id).textContent = value;
}

function update() {
  for (const input of numbers) {
    if (input.validity.valid) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
  }
  const invalid = numbers.find(input => !input.validity.valid);
  error.hidden = !invalid;
  results.hidden = Boolean(invalid);
  if (invalid) {
    const label = invalid.labels[0].textContent;
    error.textContent = `${label} requires a number from ${invalid.min} to ${invalid.max}.`;
    return;
  }

  const values = Object.fromEntries(numbers.map(input => [input.id, input.valueAsNumber]));
  const { investment, yearsHeld, proceeds } = values;
  const estimate = compareRelief({ ...values, lossRate: values.lossRate / 100 });
  for (const scheme of ['vct', 'eis', 'seis']) {
    const { eligibleInvestment, relief, lossTaxSaving, netAtRisk } = estimate[scheme];
    put(`${scheme}-eligible`, money.format(eligibleInvestment));
    put(`${scheme}-relief`, money.format(relief));
    put(`${scheme}-loss`, money.format(lossTaxSaving));
    put(`${scheme}-risk`, money.format(netAtRisk));
    put(`${scheme}-per-pound`, investment > 0 ? `${pence.format(100 * netAtRisk / investment)}p` : '—');
  }

  put('prior-relief', money.format(estimate.priorVctRelief));
  put('lost-relief', money.format(estimate.lostVctRelief));
  put('cap-first-relief', money.format(estimate.capFirstVctRelief));
  document.getElementById('cap-first').hidden = estimate.capFirstVctRelief === estimate.vct.relief;
  for (const [band, savings] of Object.entries(estimate.dividendSavings)) {
    put(`dividend-${band}`, money.format(savings));
  }
  put('deferred-gain', money.format(estimate.eisDeferredGain));
  put('exempt-gain', money.format(estimate.seisExemptGain));

  const { issueRateClawback, section266Clawback } = vctClawback({
    issueDate: '2026-04-06', yearsHeld, proceeds, reliefReceived: estimate.vct.relief, armLength: true
  });
  const earlySale = yearsHeld < 5;
  put('sale-summary', earlySale
    ? `Sale before five years. Up to ${money.format(estimate.vct.relief)} of upfront VCT relief could be withdrawn.`
    : 'At five years or later, the VCT early-sale rule does not apply to this scenario.');
  put('sale-issue-rate', money.format(issueRateClawback));
  put('sale-section-266', money.format(section266Clawback));
  document.getElementById('early-detail').hidden = !earlySale;
  document.getElementById('eis-seis-early').hidden = yearsHeld >= 3;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
