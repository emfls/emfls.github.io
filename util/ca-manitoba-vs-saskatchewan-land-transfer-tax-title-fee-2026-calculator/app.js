import { comparePrairies, MAX_AMOUNT } from './model.mjs';

const form = document.getElementById('prairies-form');
const property = document.getElementById('property-value');
const mortgage = document.getElementById('mortgage');
const manitobaFee = document.getElementById('manitoba-fee');
const transfer = document.getElementById('saskatchewan-transfer');
const results = document.getElementById('results');
const error = document.getElementById('error');
const savings = document.getElementById('savings');
const reducedNote = document.getElementById('reduced-note');
const provinceRows = document.getElementById('province-rows');
const tierRows = document.getElementById('tier-rows');
const manitobaTax = document.getElementById('manitoba-tax');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const boundary = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
});

function money(value) {
  return currency.format(value);
}

function row(label, values) {
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.scope = 'row';
  th.textContent = label;
  tr.append(th);
  for (const value of values) {
    const td = document.createElement('td');
    td.className = 'money';
    td.textContent = value;
    tr.append(td);
  }
  return tr;
}

function bracketLabel({ from, to }) {
  if (from === 0) return `Through ${boundary.format(to)}`;
  if (to === Infinity) return `Over ${boundary.format(from)}`;
  return `Over ${boundary.format(from)} through ${boundary.format(to)}`;
}

function relativeCost(gap, place) {
  if (gap === 0) return `${place} costs the same as Winnipeg`;
  return `${place} costs ${money(Math.abs(gap))} ${gap > 0 ? 'less' : 'more'} than Winnipeg`;
}

function readAmount(input) {
  const value = input.valueAsNumber;
  const invalid = !input.validity.valid || Math.round(value * 100) / 100 !== value;
  if (invalid) {
    input.setAttribute('aria-invalid', 'true');
    return null;
  }
  input.removeAttribute('aria-invalid');
  return value;
}

function render() {
  const propertyValue = readAmount(property);
  const principal = readAmount(mortgage);
  const manitobaTitleFee = readAmount(manitobaFee);
  if ([propertyValue, principal, manitobaTitleFee].includes(null)) {
    error.textContent = `Enter a CAD amount from $0 to ${boundary.format(MAX_AMOUNT)} with up to two decimal places in each highlighted field.`;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const reduced = transfer.value === 'reduced';
  const comparison = comparePrairies({ propertyValue, mortgage: principal, manitobaTitleFee, reduced });
  const provinces = [
    ['Manitoba', comparison.manitoba],
    ['Saskatchewan', comparison.saskatchewan],
    ['Alberta', comparison.alberta],
  ];
  provinceRows.replaceChildren(...provinces.map(([name, { transferTax, titleFee, mortgageFee, total }]) =>
    row(name, [transferTax, titleFee, mortgageFee, total].map(money))));
  tierRows.replaceChildren(...comparison.tiers.map(tier =>
    row(bracketLabel(tier), [`${tier.rate.toFixed(2)}%`, money(tier.portion), money(tier.tax)])));
  manitobaTax.textContent = money(comparison.manitoba.transferTax);
  reducedNote.hidden = !reduced;
  error.hidden = true;
  results.hidden = false;
  const saskPlace = reduced ? 'The qualifying Saskatchewan transfer' : 'Saskatoon or Regina';
  savings.textContent = `${relativeCost(comparison.saskatchewanSavings, saskPlace)}. ${relativeCost(comparison.albertaSavings, 'Alberta')}.`;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
