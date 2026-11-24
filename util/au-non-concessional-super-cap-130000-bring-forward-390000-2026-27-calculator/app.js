import { calculateSuperCap, PARAMETERS } from './model.mjs';

const form = document.querySelector('#super-calculator');
const error = document.querySelector('#error');
const results = document.querySelector('#results');
const capNote = document.querySelector('#cap-note');
const fields = form.querySelectorAll('input[type="number"]');
const input = Object.fromEntries(Array.from(fields, field => [field.id, field]));
const age = form.querySelector('#age');
const prior = form.querySelector('#prior');
const priorField = form.querySelector('#prior-field');
const money = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 2,
});

function formatMoney(value) {
  return value === null ? '—' : money.format(value);
}

function describeCap(result, hasPrior, under75DuringYear) {
  let message;
  switch (result.capBasis) {
    case 'nil':
      message = 'Your 30 June balance reached $2.10 million, so the cap is nil this year.';
      if (hasPrior) message += ' This also applies to your unused prior-year cap.';
      break;
    case 'prior':
      message = 'Your active prior-year arrangement uses the unused amount you entered.';
      break;
    case 'bring-forward':
      message = result.triggersBringForward
        ? 'Your planned total triggers a ' + result.capYears + '-year bring-forward period.'
        : 'You can access a ' + result.capYears + '-year period by exceeding the ' + money.format(PARAMETERS.annualCap) + ' annual cap.';
      break;
    default:
      message = 'The annual cap applies.';
  }
  if (!under75DuringYear) {
    message += ' If you are 75 or older all year, confirm your fund can accept your planned payment.';
  }
  return message;
}

function render() {
  const hasPrior = prior.value === 'yes';
  const under75DuringYear = age.value === 'yes';
  priorField.hidden = !hasPrior;
  input.remaining.disabled = !hasPrior;
  input.remaining.required = hasPrior;

  let invalid;
  for (const field of fields) {
    if (field.disabled || field.validity.valid) {
      field.removeAttribute('aria-invalid');
    } else {
      field.setAttribute('aria-invalid', 'true');
      invalid ??= field;
    }
  }

  try {
    if (invalid) {
      const label = invalid.labels[0].textContent;
      throw new RangeError(label + ' — ' + invalid.validationMessage);
    }
    const result = calculateSuperCap({
      tsb: input.tsb.valueAsNumber,
      under75DuringYear,
      remainingPriorBringForwardCap: hasPrior ? input.remaining.valueAsNumber : null,
      plannedContribution: input.planned.valueAsNumber,
      associatedEarnings: input.earnings.value === '' ? null : input.earnings.valueAsNumber,
      marginalRate: input.rate.value === '' ? null : input.rate.valueAsNumber,
    });
    const difference = result.taxDifference;
    const amount = difference === null ? null : Math.abs(difference);
    const values = {
      'cap-value': formatMoney(result.maxAllowedCap),
      'excess-value': formatMoney(result.excessNcc),
      'keep-tax': formatMoney(result.keepTax),
      'release-tax': formatMoney(result.releaseTax),
      'release-amount': formatMoney(result.releaseAmount),
      'tax-difference': formatMoney(amount) +
        (difference > 0 ? ' less with release' : difference < 0 ? ' more with release' : ''),
    };
    for (const [id, value] of Object.entries(values)) {
      document.getElementById(id).textContent = value;
    }
    capNote.textContent = describeCap(result, hasPrior, under75DuringYear);
    if (result.releaseTax === null) {
      capNote.textContent += ' Enter associated earnings and a marginal rate to compare the tax.';
    }
    error.hidden = true;
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
