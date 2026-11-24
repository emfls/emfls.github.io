import { calculate } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('nt-calculator');
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 2 });
const aud = value => `A${currency.format(value)}`;
const grantNotes = {
  homegrown: 'HomeGrown Territory Grant, subject to approval.',
  freshstart: 'FreshStart New Home Grant, subject to approval.',
  noGrant: 'No grant selected.',
  established: 'Established homes are outside the 2026–27 grants modelled here.',
  outsideWindow: 'Date is outside the 1 October 2024 to 30 September 2027 grant window.',
  residency: 'The 12-month principal residence requirement is unmet or unconfirmed.',
};

function update() {
  const price = get('purchase-price');
  const market = get('market-value');
  try {
    if (!price.validity.valid || !market.validity.valid) {
      throw new RangeError('Enter a positive purchase price and, if known, a positive market value. Use at most two decimal places.');
    }
    const result = calculate({
      purchasePrice: price.valueAsNumber,
      marketValue: market.value === '' ? undefined : market.valueAsNumber,
      buyer: get('buyer').value,
      home: get('home').value,
      date: get('transaction-date').value,
      residence: get('residency').value === 'yes',
    });
    get('error').textContent = '';
    get('dutiable-value').textContent = aud(result.dutiableValue);
    get('stamp-duty').textContent = aud(result.duty);
    get('effective-rate').textContent = `${percent.format(result.effectiveRate)} of dutiable value`;
    get('grant').textContent = aud(result.grant.amount);
    get('grant-note').textContent = grantNotes[result.grant.reason];
    const net = result.netUpfrontBenefit;
    get('net-label').textContent = net > 0 ? 'Grant surplus after duty' : 'Duty left after grant';
    get('net-benefit').textContent = aud(Math.abs(net));
    get('cliff-status').textContent = result.cliffs.map(({ threshold, reached, jump }) =>
      `${reached ? 'Reached' : 'Below'} ${aud(threshold)} threshold (duty rises by about ${aud(jump)}).`
    ).join(' ');
    for (const [jurisdiction, amount] of Object.entries(result.benchmark)) {
      get(`duty-${jurisdiction}`).textContent = aud(amount);
    }
    get('results').hidden = false;
    get('benchmark-table').hidden = false;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    get('results').hidden = true;
    get('benchmark-table').hidden = true;
    get('error').textContent = error.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('change', update);
form.addEventListener('submit', event => event.preventDefault());
update();
