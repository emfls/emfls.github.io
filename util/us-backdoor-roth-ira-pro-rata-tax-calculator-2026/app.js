import { estimate } from './model.mjs';

const form = document.getElementById('calculator');
const fields = [...form.querySelectorAll('input[type="number"]')];
const results = document.getElementById('results');
const error = document.getElementById('error');
const announcement = document.getElementById('announcement');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = value => currency.format(value);

function render({ eligibility, current, rollover, growth }, inputs) {
  const values = {
    'annual-limit': money(eligibility.annualLimit),
    'remaining-room': money(eligibility.remainingRoom),
    'direct-limit': money(eligibility.directLimit),
    'total-basis': money(current.totalBasis),
    'year-end': money(current.yearEndBalance),
    pool: money(current.totalAggregatedIRA),
    ratio: inputs.conversion ? current.nontaxableRatio.toFixed(12) : 'Not applicable',
    nontaxable: money(current.nontaxableConverted),
    taxable: money(current.taxableConverted),
    carryforward: money(current.remainingBasisCarryForward),
    tax: money(current.surpriseProRataTax),
    'rolled-in': money(inputs.preTax),
    'clean-conversion': money(rollover.conversion),
    'clean-tax': money(rollover.conversionTax),
    'saved-tax': money(rollover.taxSavings),
    'growth-principal': money(rollover.conversion),
    'roth-growth': money(growth.roth),
    'brokerage-growth': money(growth.brokerage),
    'growth-advantage': money(growth.rothAdvantage)
  };
  for (const [id, value] of Object.entries(values)) {
    document.getElementById(id).textContent = value;
  }

  let eligibilityMessage = 'Enter a planned contribution to compare your direct Roth and backdoor options.';
  if (inputs.contribution > 0) {
    eligibilityMessage = eligibility.backdoorAmount > 0
      ? `${money(eligibility.backdoorAmount)} of your planned contribution exceeds the direct Roth limit. A backdoor conversion is an option for that amount.`
      : 'Your full planned contribution fits within the direct Roth limit.';
  }
  document.getElementById('eligibility-message').textContent = eligibilityMessage;
  document.getElementById('rollover-message').textContent = rollover.conversionReduction > 0
    ? `The full rollover leaves ${money(rollover.conversion)} available to convert. This scenario converts ${money(rollover.conversionReduction)} less than planned because those pre-tax dollars went into the 401(k).`
    : '';

  results.hidden = false;
  const summary = `Direct Roth limit ${values['direct-limit']}. Estimated conversion tax ${values.tax}. Estimated tax after rollover ${values['clean-tax']}.`;
  if (announcement.textContent !== summary) announcement.textContent = summary;
}

function update() {
  for (const field of fields) field.removeAttribute('aria-invalid');
  try {
    const inputs = { filing: form.elements.filing.value };
    for (const field of fields) {
      if (!field.validity.valid) {
        field.setAttribute('aria-invalid', 'true');
        const label = field.labels[0].textContent;
        throw new RangeError(`${label} — ${field.validationMessage}`);
      }
      inputs[field.name] = field.value === '' ? 0 : field.valueAsNumber;
    }
    const result = estimate(inputs);
    error.textContent = '';
    render(result, inputs);
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    if (/new nondeductible contribution exceeds/i.test(issue.message)) {
      form.elements.contribution.setAttribute('aria-invalid', 'true');
    } else if (/conversion cannot exceed/i.test(issue.message)) {
      form.elements.conversion.setAttribute('aria-invalid', 'true');
    }
    results.hidden = true;
    announcement.textContent = '';
    error.textContent = issue.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();

// A manual placement needs an ad-unit ID from the configured publisher.
for (const slot of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (slot.dataset.adSlot.trim()) (window.adsbygoogle ||= []).push({});
}
