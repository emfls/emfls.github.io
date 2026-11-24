import { compareDuty, MAX_VALUE } from './model.mjs';

const form = document.getElementById('duty-form');
const valueInput = document.getElementById('value');
const buyer = document.getElementById('buyer');
const property = document.getElementById('property');
const period = document.getElementById('period');
const foreign = document.getElementById('foreign');
const error = document.getElementById('duty-error');
const comparison = document.getElementById('comparison');
const summary = document.getElementById('comparison-summary');
const tableBody = document.getElementById('comparison-values');
const scenarioNote = document.getElementById('scenario-note');

const amount = new Intl.NumberFormat('en-AU', {
  minimumFractionDigits: 2, maximumFractionDigits: 2, trailingZeroDisplay: 'stripIfInteger',
});
const money = value => `A$${amount.format(value)}`;
const metrics = [
  ['General duty', 'standardDuty'],
  ['Reduction vs general', 'savings'],
  ['Transfer duty', 'transferDuty'],
  ['Foreign surcharge', 'surcharge'],
  ['Total duty', 'total'],
];

function render() {
  const value = valueInput.valueAsNumber;
  const valid = valueInput.validity.valid && value === Math.round(value * 100) / 100;
  valueInput.setAttribute('aria-invalid', String(!valid));
  error.hidden = valid;
  comparison.hidden = !valid;
  if (!valid) {
    error.textContent = `Enter an amount from A$0.01 to ${money(MAX_VALUE)} with up to two decimal places.`;
    return;
  }

  error.textContent = '';
  const july2026 = period.value === 'july';
  const estimates = compareDuty({
    value,
    buyer: buyer.value,
    property: property.value,
    foreign: foreign.checked,
    july2026,
  });
  tableBody.replaceChildren(...metrics.map(([label, key]) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    if (key === 'total') row.className = 'estimate-total';
    for (const estimate of estimates) {
      row.insertCell().textContent = amount.format(estimate[key]);
    }
    return row;
  }));

  const totals = estimates.map(estimate => `${estimate.state} ${money(estimate.total)}`);
  summary.textContent = `At ${money(value)}, estimated total duty is ${totals.join(' · ')}.`;
  const messages = [];
  if (foreign.checked && !july2026 && buyer.value !== 'investor') {
    messages.push('QLD uses standard transfer duty in this full-AFAD scenario for contracts from 1 August 2026.');
  }
  if (foreign.checked && estimates[1].surcharge === 0) {
    messages.push('VIC waives additional foreign duty when the transfer is exempt from land transfer duty.');
  }
  scenarioNote.textContent = messages.join(' ');
  scenarioNote.hidden = messages.length === 0;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();

const configuredAds = document.querySelectorAll('ins.adsbygoogle[data-ad-slot]');
if (configuredAds.length) {
  // A manual display unit needs a slot issued for the publisher in the markup.
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${configuredAds[0].dataset.adClient}`;
  document.head.append(script);
  const queue = window.adsbygoogle = window.adsbygoogle || [];
  configuredAds.forEach(() => queue.push({}));
}
