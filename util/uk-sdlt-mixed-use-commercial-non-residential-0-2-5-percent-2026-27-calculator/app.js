import { calculateSdlt } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const transaction = byId('transaction');
const price = byId('price');
const rent = byId('rent-npv');
const profile = byId('profile');
const results = byId('calculation');
const error = byId('error');

function currency(minimumFractionDigits, maximumFractionDigits) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', minimumFractionDigits, maximumFractionDigits,
  });
}

const pounds = currency(0, 0);
const slices = currency(0, 2);
const bandTax = currency(2, 4);
const whole = amount => pounds.format(amount);

function bandLabel(lower, upper) {
  if (lower === 0) return 'Up to ' + whole(upper);
  if (upper === Infinity) return 'Over ' + whole(lower);
  return 'Over ' + whole(lower) + ' to ' + whole(upper);
}

function bandTable(title, rows, due) {
  // The captions are fixed strings and all band values come from the model.
  return `<table>
    <caption>${title}</caption>
    <thead><tr><th scope="col">Band and taxable slice</th><th scope="col">Rate</th><th scope="col">Slice tax</th></tr></thead>
    <tbody>${rows.map(({ lower, upper, rate, slice, tax }) => `<tr>
      <th scope="row">${bandLabel(lower, upper)}<small>${slices.format(slice)} in this band</small></th>
      <td>${rate}%</td><td>${bandTax.format(tax)}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr><th scope="row" colspan="2">Tax due</th><td>${whole(due)}</td></tr></tfoot>
  </table>`;
}

function showValidation(input, optional = false) {
  const amount = optional && input.value === '' && !input.validity.badInput;
  const valid = amount || input.validity.valid;
  input.setAttribute('aria-invalid', String(!valid));
  return valid;
}

function render() {
  const isLease = transaction.value === 'new_commercial_lease';
  byId('price-label').textContent = isLease ? 'Lease premium (£)' : 'Purchase price (£)';
  byId('rent-field').hidden = !isLease;
  rent.disabled = !isLease;

  const validPrice = showValidation(price);
  const validRent = showValidation(rent, true);
  if (!validPrice || !validRent) {
    const field = !validPrice ? (isLease ? 'lease premium' : 'purchase price') : 'rent NPV';
    error.textContent = `Enter a valid ${field} from £0 to £1 billion, with up to two decimal places.`;
    results.hidden = true;
    return;
  }

  let calculated;
  try {
    calculated = calculateSdlt({
      price: price.value,
      transaction: transaction.value,
      rentNpv: rent.value,
      profile: profile.value,
    });
  } catch (issue) {
    error.textContent = issue.message;
    results.hidden = true;
    return;
  }

  const { commercial, residential, savings, effectiveRate } = calculated;
  error.textContent = '';
  byId('commercial-total').textContent = whole(commercial.total);
  byId('effective-rate').textContent = effectiveRate === null
    ? 'Effective rate unavailable at £0'
    : effectiveRate.toFixed(2) + '% effective rate';
  byId('residential-total').textContent = whole(residential.total);
  for (const [id, amount] of [['commercial-rent', commercial.rent], ['residential-rent', residential.rent]]) {
    const line = byId(id);
    line.hidden = !isLease;
    line.textContent = 'Rent NPV tax ' + whole(amount);
  }

  byId('difference-label').textContent = savings < 0 ? 'Extra tax under Table B' : 'Cash tax saved under Table B';
  byId('difference').textContent = whole(Math.abs(savings));
  const isNonUk = profile.value === 'non_uk_additional_7pct';
  const notes = [];
  if (profile.value !== 'standard_residential') {
    notes.push('The comparison assumes the buyer meets the additional-property conditions. The 5-point uplift starts at £40,000 on the price or premium.');
  }
  if (isNonUk) {
    notes.push(isLease
      ? 'The 2-point scenario assumes a residential lease longer than seven years and either a premium of at least £40,000 or, when rent NPV is entered, qualifying annual rent of at least £1,000.'
      : 'The 2-point non-UK resident uplift applies from £40,000 in this freehold scenario.');
  }
  if (isLease) notes.push('The residential lease scenario assumes rent is chargeable.');
  byId('profile-note').textContent = notes.join(' ');

  const charge = isLease ? 'premium' : 'purchase price';
  const tables = [
    bandTable('Commercial or mixed-use ' + charge, commercial.premiumBands, commercial.premium),
    bandTable('Residential ' + charge, residential.premiumBands, residential.premium),
  ];
  if (isLease) {
    tables.splice(1, 0, bandTable('Commercial or mixed-use rent NPV', commercial.rentBands, commercial.rent));
    tables.push(bandTable('Residential rent NPV', residential.rentBands, residential.rent));
  }
  byId('bands').innerHTML = tables.join('');
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
