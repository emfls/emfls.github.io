import { compareTaxes, HIGHER_THRESHOLD_PENCE, parsePrice } from './model.mjs';

const form = document.querySelector('#ltt-form');
const price = document.querySelector('#price');
const scenario = document.querySelector('#scenario');
const results = document.querySelector('#results');
const error = document.querySelector('#price-error');
const wales = document.querySelector('#wales-tax');
const sdlt = document.querySelector('#sdlt-tax');
const difference = document.querySelector('#tax-difference');
const scenarioNote = document.querySelector('#scenario-note');
const refund = document.querySelector('#refund');
const refundAmount = document.querySelector('#refund-amount');

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const money = (pence) => gbp.format(pence / 100);

function update() {
  const pricePence = parsePrice(price.value);
  const result = compareTaxes(pricePence, scenario.value);

  results.hidden = result === null;
  error.hidden = result !== null;
  price.setAttribute('aria-invalid', String(result === null));
  error.textContent = result === null
    ? 'Enter a price from £0 to £1 billion with up to two decimal places.'
    : '';
  if (!result) return;

  wales.textContent = money(result.walesPence);
  sdlt.textContent = money(result.sdltPence);

  const delta = result.differencePence;
  if (delta === 0) {
    difference.textContent = 'The estimated tax is the same in both places.';
  } else {
    const cheaper = delta < 0 ? 'Wales' : 'England or Northern Ireland';
    difference.textContent = `${cheaper} costs ${money(Math.abs(delta))} less in purchase tax.`;
  }

  let note = '';
  switch (scenario.value) {
    case 'first-time':
      note = result.usesFirstTimeRelief
        ? 'The comparison applies first-time buyer relief to SDLT and main residential rates to Welsh LTT.'
        : 'Above £500,000, first-time buyer relief ends and standard SDLT applies to the whole purchase.';
      break;
    case 'higher':
      note = pricePence < HIGHER_THRESHOLD_PENCE
        ? 'The purchase price is below £40,000, so neither higher-rate schedule applies in this comparison.'
        : 'Both estimates use the full higher-rate bill before any refund.';
      break;
    case 'commercial':
      note = 'The comparison covers the purchase price or standard premium. A new lease can also incur tax on rent.';
      break;
  }
  scenarioNote.textContent = note;
  scenarioNote.hidden = note === '';

  refund.hidden = result.refundPence === null;
  refundAmount.textContent = result.refundPence === null ? '' : money(result.refundPence);
}

form.addEventListener('input', update);
form.addEventListener('change', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
