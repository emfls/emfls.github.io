import { calculateShareMatching } from './model.mjs';

const form = document.getElementById('calculator');
const results = document.getElementById('results');
const selectedResults = document.getElementById('selected-results');
const error = document.getElementById('error');
const status = document.getElementById('live-status');
const fields = [...form.querySelectorAll('input[type="number"]')];
const isaToggle = document.getElementById('rebuyInIsa');
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const unitCurrency = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 6,
});
const shares = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 });

function money(value) {
  return currency.format(Math.abs(value) < 0.005 ? 0 : value);
}

function write(entries) {
  for (const [id, value] of Object.entries(entries)) {
    document.getElementById(id).textContent = value;
  }
}

function renderSelected(selected, scenario) {
  const { sameDay, within30Days, section104 } = selected.buckets;
  write({
    'selected-title': `Selected scenario · ${scenario}`,
    gain: money(selected.gain),
    taxImpact: money(selected.taxImpact.total),
    chargeableGain: money(selected.annual.chargeableGain),
    annualTax: money(selected.annual.total),
    basicTax: money(selected.annual.basicTax),
    higherTax: money(selected.annual.higherTax),
    exemptionUsed: money(selected.annual.exemptionUsed),
    lossesUsed: money(selected.annual.broughtForwardUsed),
    netProceeds: money(selected.netProceeds),
    allowableCost: money(selected.allowableCost),
    'same-shares': shares.format(sameDay.shares),
    'same-cost': money(sameDay.cost),
    'later-shares': shares.format(within30Days.shares),
    'later-cost': money(within30Days.cost),
    'pool-shares-sold': shares.format(section104.shares),
    'pool-cost-removed': money(section104.cost),
    'pool-shares-left': shares.format(selected.pool.shares),
    'pool-cost-left': money(selected.pool.cost),
    'pool-average': selected.pool.averageCost === null ? 'N/A' : unitCurrency.format(selected.pool.averageCost),
  });
  status.textContent = `${scenario}. Sale gain or loss ${money(selected.gain)}. CGT change ${money(selected.taxImpact.total)}.`;
}

function update() {
  const input = Object.fromEntries(fields.map(field => [field.id, field.valueAsNumber]));
  input.rebuyInIsa = isaToggle.checked;

  let comparison;
  try {
    comparison = calculateShareMatching(input);
  } catch (problem) {
    results.hidden = true;
    error.textContent = problem.message;
    status.textContent = '';
    return;
  }

  const { gia, isa, selected } = comparison;
  error.textContent = selected.unmatchedShares
    ? `${shares.format(selected.unmatchedShares)} shares are unmatched. Check the inputs or account for later acquisitions under the statutory fallback before estimating CGT for this scenario.`
    : '';
  selectedResults.hidden = Boolean(selected.unmatchedShares);
  if (selected.unmatchedShares) {
    status.textContent = '';
  } else {
    renderSelected(selected, input.rebuyInIsa ? 'Bed and ISA' : 'Taxable account (GIA)');
  }

  for (const [key, match] of Object.entries({ gia, isa, spouse: isa })) {
    write({
      [`${key}-gain`]: match.unmatchedShares ? 'Unmatched shares' : money(match.gain),
      [`${key}-tax`]: match.unmatchedShares ? 'N/A' : money(match.taxImpact.total),
    });
  }
  write({
    'isa-exemption-value': isa.unmatchedShares ? 'N/A' : money(isa.exemptionTaxSavedOnSale),
    'isa-gia-difference': isa.unmatchedShares || gia.unmatchedShares
      ? 'N/A'
      : money(isa.taxImpact.total - gia.taxImpact.total),
  });
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
