import { calculatePensionAllowance } from './model.mjs';

const form = document.getElementById('pension-form');
const results = document.getElementById('results');
const error = document.getElementById('input-error');
const status = document.getElementById('result-status');
const schemePays = document.getElementById('scheme-pays');
const reliefAlert = document.getElementById('relief-alert');
const scenario = document.getElementById('threshold-scenario');
const money = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const gbp = value => money.format(value);
const amountInputs = [...form.querySelectorAll('input[type="number"]')];
const currentInputs = amountInputs.filter(input => !input.closest('.history-year'));
const historyRows = [...form.querySelectorAll('.history-year')].map(row => ({
  year: row.dataset.year,
  membership: row.querySelector('input[type="checkbox"]'),
  fields: row.querySelector('.history-fields'),
  amounts: [...row.querySelectorAll('input[type="number"]')],
}));
const resultFields = [...results.querySelectorAll('[data-output]')];
const carryFields = new Map([...results.querySelectorAll('[data-carry]')]
  .map(cell => [cell.dataset.carry, cell]));

function readHistory() {
  return historyRows.map(({ year, membership, fields, amounts }) => {
    const member = membership.checked;
    fields.hidden = !member;
    amounts.forEach(input => { input.disabled = !member; });
    const [annualAllowance, pensionInput, alreadyUsed] = amounts.map(input => input.valueAsNumber);
    return { year, member, annualAllowance, pensionInput, alreadyUsed };
  });
}

function render(result) {
  for (const field of resultFields) field.textContent = gbp(result[field.dataset.output]);
  for (const { year, available, used, remaining } of result.carryForward) {
    carryFields.get(`${year}-available`).textContent = gbp(available);
    carryFields.get(`${year}-used`).textContent = gbp(used);
    carryFields.get(`${year}-remaining`).textContent = gbp(remaining);
  }

  const rule = !result.taperApplies ? 'At least one income test is unmet.'
    : result.currentYearAA === 60000 ? 'Both tests are met. The reduction rounds down to £0.'
      : `Your allowance is reduced by ${gbp(60000 - result.currentYearAA)}.`;
  status.textContent = `${rule} Estimated charge at ${result.rate}%: ${gbp(result.taxCharge)}.`;
  schemePays.hidden = !result.schemePaysAlert;
  reliefAlert.hidden = !result.personalReliefExcess;
  reliefAlert.textContent = result.personalReliefExcess
    ? `${gbp(result.personalReliefExcess)} of the entered member contributions exceeds the estimated personal tax relief limit. Confirm eligible relief and the income figures before relying on the estimate.`
    : '';

  const alternative = result.thresholdScenario;
  scenario.hidden = !alternative;
  if (alternative) {
    const gross = gbp(alternative.grossContribution);
    scenario.textContent = alternative.withinReliefLimit
      ? `In your example, adding ${gross} gross (about ${gbp(alternative.netPayment)} paid to the provider) brings threshold income to £200,000. Your allowance would be £60,000, total pension input would be ${gbp(alternative.pensionInput)}, and the estimated charge would be ${gbp(alternative.taxCharge)} after carry forward.`
      : `Your example would require ${gross} gross to reach £200,000. That exceeds your estimated remaining personal tax relief headroom of ${gbp(result.personalReliefRemaining)}.`;
  }
}

function update() {
  const history = readHistory();
  try {
    const invalid = amountInputs.find(input => !input.disabled && !input.validity.valid);
    for (const input of amountInputs) {
      if (!input.disabled && !input.validity.valid) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    if (invalid) {
      const label = invalid.labels[0].textContent;
      throw new RangeError(`Enter a valid amount for ${label}, from £0 to ${gbp(Number(invalid.max))} with up to two decimal places.`);
    }
    const amounts = Object.fromEntries(currentInputs.map(input => [input.name, input.valueAsNumber]));
    render(calculatePensionAllowance({ ...amounts, history, region: form.elements.region.value }));
    results.hidden = false;
    error.hidden = true;
    error.textContent = '';
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    scenario.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();

const adUnits = document.querySelectorAll('ins.adsbygoogle[data-ad-slot]');
for (let index = 0; index < adUnits.length; index++) {
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (error) {
    console.warn('AdSense initialization failed for a reserved ad space.', error);
  }
}
