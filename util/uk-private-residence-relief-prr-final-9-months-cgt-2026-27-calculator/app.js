import { calculatePRR, PARAMETERS } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('prr-form');
const sharedToggle = byId('sharedOccupancyWithTenant');
const sharedMonths = byId('sharedLetMonths');
const sharedFields = byId('shared-let-fields');
const status = byId('estimate-status');
const error = byId('estimate-error');
const details = byId('estimate-details');
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const months = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });

function updateEstimate() {
  sharedMonths.disabled = !sharedToggle.checked;
  sharedFields.hidden = !sharedToggle.checked;
  byId('shared-warning').hidden = !sharedToggle.checked;
  byId('letting-warning').hidden = sharedToggle.checked;

  try {
    const input = Object.fromEntries(
      [...form.querySelectorAll('input[type="number"]:enabled')].map(field => [field.id, field.valueAsNumber]),
    );
    const numOwners = Number(byId('numOwners').value);
    const result = calculatePRR({
      ...input,
      numOwners,
      disabledOrCareHome: byId('disabledOrCareHome').checked,
      sharedOccupancyWithTenant: sharedToggle.checked,
    });

    const values = {
      'gross-gain': currency.format(result.grossGain),
      'months-away': months.format(result.nonOccupiedMonths),
      'deemed-months': months.format(result.deemedOccupationMonths),
      'final-months': `${months.format(result.extraFinalPeriodMonths)} of ${result.finalPeriodLimit}`,
      'prr-gain': currency.format(result.prrExemptGain),
      'letting-relief': currency.format(result.lettingRelief),
      'remaining-gain': currency.format(result.remainingGainAfterReliefs),
      'annual-exemption': currency.format(numOwners * PARAMETERS.annualExemptAmount),
      'taxable-gain': currency.format(result.taxableGainPerOwner),
      'unused-band': currency.format(result.unusedBasicBand),
      'gain-at-18': currency.format(result.gainAt18),
      'gain-at-24': currency.format(result.gainAt24),
      'occupation-summary': `${months.format(result.qualifyingMonths)} of ${months.format(input.totalOwnershipMonths)} months qualify for PRR (${percent.format(result.prrFraction)}).`,
    };
    for (const [id, value] of Object.entries(values)) {
      byId(id).textContent = value;
    }
    const total = currency.format(result.cgtDue);
    if (status.textContent !== total) status.textContent = total;
    error.hidden = true;
    details.hidden = false;
  } catch (cause) {
    if (!(cause instanceof RangeError)) throw cause;
    status.textContent = '—';
    details.hidden = true;
    error.hidden = false;
    error.textContent = cause.message;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', updateEstimate);
updateEstimate();
