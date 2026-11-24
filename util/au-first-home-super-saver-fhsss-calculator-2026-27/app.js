import { calculateFhss } from './model.mjs';

const form = document.querySelector('#fhss-form');
const buyerOne = form.querySelector('fieldset');
const buyerTwo = buyerOne.cloneNode(true);
buyerTwo.id = 'buyer-two';
buyerTwo.querySelector('legend').textContent = 'Buyer 2';
buyerOne.after(buyerTwo);

const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol' });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 2 });
const error = document.querySelector('#input-error');
const results = document.querySelector('#results');
const boost = document.querySelector('#boost');
const summary = document.querySelector('#result-summary');
const capWarning = document.querySelector('#cap-warning');
const releaseRates = document.querySelector('#release-rates');
const amountOutputs = results.querySelectorAll('[data-amount]');

function update() {
  const couple = form.elements.buyerCount.value === '2';
  buyerTwo.hidden = !couple;
  buyerTwo.disabled = !couple;

  const invalid = Array.from(form.querySelectorAll('input')).find(input => !input.disabled
    && !input.closest('fieldset:disabled') && !input.validity.valid);
  if (invalid) {
    const label = invalid.labels[0].textContent.trim();
    const owner = invalid.closest('fieldset')?.querySelector('legend').textContent;
    error.textContent = `${owner ? owner + ' · ' : ''}${label} must be between ${invalid.min} and ${invalid.max}, in increments of ${invalid.step}.`;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const buyers = (couple ? [buyerOne, buyerTwo] : [buyerOne]).map(fieldset =>
    Object.fromEntries(Array.from(fieldset.querySelectorAll('input'), input => [input.name, input.valueAsNumber]))
  );
  const projection = calculateFhss({
    buyers,
    years: Number(form.elements.years.value),
    sic: form.elements.sic.valueAsNumber,
    bankRate: form.elements.bankRate.valueAsNumber
  });

  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
  const difference = Math.round(projection.boost * 100) / 100;
  boost.textContent = difference === 0 ? money.format(0) : `${difference < 0 ? '−' : '+'}${money.format(Math.abs(difference))}`;
  summary.textContent = difference < 0 ? 'Bank savings leave you with the larger deposit.'
    : difference > 0 ? 'The FHSS strategy leaves you with the larger deposit.'
      : 'Both strategies give the same estimated deposit.';
  for (const output of amountOutputs) output.textContent = money.format(projection[output.dataset.amount]);

  releaseRates.textContent = projection.buyers.map((buyer, i) =>
    `Buyer ${i + 1} estimated release tax rate: ${percent.format(buyer.releaseTaxRate)}`
  ).join(' · ');
  const limited = projection.buyers.flatMap((buyer, i) =>
    buyer.annual.some(year => year.concessionalCapLimited) ? [`Buyer ${i + 1}`] : []
  );
  capWarning.hidden = limited.length === 0;
  capWarning.textContent = limited.length
    ? `${limited.join(' and ')}: other super contributions plus the planned before-tax amount exceed the A$32,500 general concessional cap. The calculator limits new before-tax FHSS contributions to available headroom.`
    : '';
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();

// AdSense slot IDs must belong to the publisher configured on this page.
for (const ad of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (ad.dataset.adSlot) (window.adsbygoogle = window.adsbygoogle || []).push({});
}
