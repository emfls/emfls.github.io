import { compareTaxes, parsePrice } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('calculator');
const priceInput = byId('price');
const scenarioInput = byId('scenario');
const saleInput = byId('sale');
const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const poundsAndPence = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const scenarioNotes = {
  standard: 'Use standard rates for a single dwelling or a qualifying main-home replacement where the previous home has already been sold.',
  'first-time': 'Assumes all buyers qualify and intend to occupy the home. In England and Northern Ireland, a purchase over £500,000 returns to standard SDLT rates.',
  additional: 'Assumes the purchase qualifies for both higher-rate regimes. Qualifying purchases below £40,000 have no surcharge.',
  replacement: 'Both surcharges are included upfront when applicable. The repayment estimate assumes you meet each jurisdiction’s disposal and main-home conditions and submit a valid claim.',
  commercial: 'Uses non-residential rates on the purchase price for a purely commercial transaction. No dwelling surcharge applies.',
};

function renderTax(prefix, tax, firstTime, replacement) {
  byId(`${prefix}-upfront`).textContent = pounds.format(tax.upfront);
  byId(`${prefix}-base`).textContent = poundsAndPence.format(tax.base);
  byId(`${prefix}-relief`).textContent = poundsAndPence.format(tax.relief);
  byId(`${prefix}-surcharge`).textContent = poundsAndPence.format(tax.surcharge);
  byId(`${prefix}-refund`).textContent = pounds.format(tax.refund);
  byId(`${prefix}-net`).textContent = pounds.format(tax.afterRefund);
  byId(`${prefix}-relief-row`).hidden = !firstTime;
  byId(`${prefix}-refund-row`).hidden = !replacement;
  byId(`${prefix}-net-row`).hidden = !replacement;
}

function differenceText(difference, timing) {
  if (difference === 0) return `Both jurisdictions cost the same ${timing}.`;
  const higher = difference > 0 ? 'Scotland' : 'England and Northern Ireland';
  return `The tax bill is ${pounds.format(Math.abs(difference))} higher in ${higher} ${timing}.`;
}

function update() {
  const scenario = scenarioInput.value;
  const replacement = scenario === 'replacement';
  const firstTime = scenario === 'first-time';
  const price = parsePrice(priceInput.value);
  const invalid = price === null;

  byId('sale-field').hidden = !replacement;
  saleInput.disabled = !replacement;
  byId('scenario-note').textContent = scenarioNotes[scenario];
  priceInput.setAttribute('aria-invalid', String(invalid));
  byId('price-error').hidden = !invalid;
  byId('price-error').textContent = invalid ? 'Enter a valid price from £0 to £100,000,000 with up to two decimal places.' : '';
  byId('results').hidden = invalid;
  if (invalid) return;

  const { scotland, englandNI, difference } = compareTaxes(price, scenario, saleInput.value === 'within');
  renderTax('scotland', scotland, firstTime, replacement);
  renderTax('england', englandNI, firstTime, replacement);
  byId('difference').textContent = differenceText(difference, 'upfront');

  const netDifference = byId('net-difference');
  netDifference.hidden = !replacement;
  netDifference.textContent = differenceText(scotland.afterRefund - englandNI.afterRefund, 'after potential repayments');
}

priceInput.addEventListener('input', update);
scenarioInput.addEventListener('change', update);
saleInput.addEventListener('change', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
