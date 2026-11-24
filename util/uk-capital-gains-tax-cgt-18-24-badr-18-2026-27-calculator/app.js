import { calculateCgt } from './model.mjs';

const form = document.querySelector('#cgt-form');
const results = document.querySelector('#results');
const error = document.querySelector('#calculation-error');
const status = document.querySelector('#calculation-status');
const fields = form.elements;
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const outputs = Object.fromEntries(
  [...results.querySelectorAll('[data-output]')].map(element => [element.dataset.output, element]),
);

function update() {
  const taxpayerType = fields.taxpayerType.value;
  const assetType = fields.assetType.value;
  const trust = taxpayerType === 'trust';
  const business = assetType === 'badr_business';
  const spouseAvailable = !trust && !business;
  const simulateSpouse = spouseAvailable && fields.simulateSpouse.checked;

  fields.individualInputs.hidden = fields.individualInputs.disabled = trust;
  fields.badrInputs.hidden = fields.badrInputs.disabled = !business;
  document.querySelector("#spouse-toggle").hidden = !spouseAvailable;
  fields.simulateSpouse.disabled = !spouseAvailable;
  fields.spouseInputs.hidden = fields.spouseInputs.disabled = !simulateSpouse;
  fields.spouseDisposalGain.max = fields.grossGain.value;
  document.querySelector('#badr-results').hidden = !business;
  document.querySelector('#spouse-results').hidden = !simulateSpouse;

  const numericFields = [...form.querySelectorAll('input[type="number"]:enabled')];
  const invalid = numericFields.find(input => !input.validity.valid);
  let result;
  try {
    if (invalid) {
      const message = invalid === fields.spouseDisposalGain && invalid.validity.rangeOverflow
        ? 'The gain assigned to your spouse cannot exceed your total gain.'
        : 'Enter a valid pound amount with up to two decimal places for ' +
          invalid.labels[0].textContent.trim() + '.';
      throw new RangeError(message);
    }
    result = calculateCgt({
      taxpayerType,
      assetType,
      simulateSpouse,
      ...Object.fromEntries(numericFields.map(input => [input.name, input.valueAsNumber])),
    });
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    results.hidden = true;
    status.textContent = '';
    return;
  }

  error.textContent = '';
  results.hidden = false;
  const values = {
    ...result,
    spouseOwnTax: result.spouse?.ownTax,
    spousePartnerTax: result.spouse?.partnerTax,
    spouseCombined: result.spouse?.combined,
    spouseSavings: result.spouse?.savings,
  };
  for (const [name, element] of Object.entries(outputs)) {
    const value = values[name];
    if (value === undefined) continue;
    element.textContent = name === 'effectiveRate' ? percent.format(value / 100) : currency.format(value);
  }
  status.textContent = 'Estimated Capital Gains Tax payable is ' + currency.format(result.total) + '.';
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
