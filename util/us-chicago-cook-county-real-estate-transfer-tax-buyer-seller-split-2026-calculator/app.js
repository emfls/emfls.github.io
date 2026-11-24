import { compareTransferTaxes, parseSalePrice } from './model.mjs';

const form = document.getElementById('tax-form');
const priceInput = document.getElementById('sale-price');
const municipality = document.getElementById('municipality');
const results = document.getElementById('results');
const feedback = document.getElementById('price-error');
const status = document.getElementById('tax-status');
const comparison = document.getElementById('comparison');
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const integers = new Intl.NumberFormat('en-US');
const percent = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const money = cents => dollars.format(cents / 100);
const rate = value => percent.format(value) + '%';

function put(id, value) {
  document.getElementById(id).textContent = value;
}

function difference(cents) {
  if (cents === 0) return 'Same as Chicago';
  return money(Math.abs(cents)) + (cents > 0 ? ' less' : ' more');
}

function renderComparison(scenarios, selected) {
  const rows = scenarios.map(scenario => {
    const row = document.createElement('tr');
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = scenario.label;
    if (scenario === selected) row.className = 'selected';
    row.append(name);
    for (const value of [
      money(scenario.buyerCents), money(scenario.sellerCents),
      money(scenario.totalCents), difference(scenario.savingsCents),
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  });
  comparison.replaceChildren(...rows);
}

function render() {
  const salePrice = parseSalePrice(priceInput.value);
  results.hidden = salePrice === null;
  feedback.hidden = salePrice !== null;
  priceInput.setAttribute('aria-invalid', String(salePrice === null));
  if (salePrice === null) {
    status.textContent = '';
    return;
  }

  const scenarios = compareTransferTaxes(salePrice);
  const selected = scenarios.find(scenario => scenario.preset === municipality.value);
  const { label, county, units500, buyerCents, sellerCents, totalCents } = selected;

  put('jurisdiction', label + ' · ' + county + ' County');
  put('stamp-count', integers.format(units500));
  put('buyer-total', money(buyerCents));
  put('seller-total', money(sellerCents));
  put('combined-total', money(totalCents));
  put('buyer-rate', rate(selected.buyerPercent));
  put('seller-rate', rate(selected.sellerPercent));
  put('combined-rate', rate(selected.totalPercent));
  put('municipal-label', selected.preset === 'chicago' ? 'Chicago City' : 'Municipal');
  put('county-label', county);
  put('municipal-tax', money(selected.municipalCents));
  put('cta-tax', money(selected.ctaCents));
  put('county-tax', money(selected.countyCents));
  put('state-tax', money(selected.stateCents));
  put('municipal-payer', selected.municipalCents === 0 ? '—' : buyerCents > 0 ? 'Buyer' : 'Seller');
  put('cta-payer', selected.ctaCents === 0 ? '—' : 'Seller');
  put('savings', difference(selected.savingsCents));
  renderComparison(scenarios, selected);
  status.textContent = label + ' transfer tax: ' + money(buyerCents) + ' buyer, '
    + money(sellerCents) + ' seller, ' + money(totalCents) + ' total.';
}

priceInput.addEventListener('input', render);
municipality.addEventListener('change', render);
form.addEventListener('submit', event => event.preventDefault());
render();
