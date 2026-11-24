import { estimateEstate } from './model.mjs';

const form = document.querySelector('#estate-calculator');
const amounts = [...form.querySelectorAll('input[type="number"]')];
const results = document.querySelector('#estate-results');
const error = document.querySelector('#calculation-error');
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const outputs = [...results.querySelectorAll('[data-result]')];

function render() {
  const province = form.elements.province.value;
  const quebecWill = form.elements.quebecWill;
  quebecWill.disabled = province !== 'QC';
  document.querySelector('#quebec-options').hidden = quebecWill.disabled;
  document.querySelector('#quebec-bypass-note').hidden = quebecWill.disabled;
  const principalResidenceExempt = form.elements.principalResidenceExempt.checked;
  const homeAcb = form.elements.homeAcb;
  homeAcb.disabled = principalResidenceExempt || form.elements.spousalRollover.checked;
  document.querySelector('#home-basis').hidden = homeAcb.disabled;

  const scenario = Object.fromEntries(new FormData(form));
  for (const input of amounts) {
    if (input.disabled) continue;
    input.setAttribute('aria-invalid', String(!input.validity.valid));
    scenario[input.name] = input.valueAsNumber;
  }
  for (const input of form.querySelectorAll('input[type="checkbox"]')) {
    scenario[input.name] = input.checked;
  }
  scenario.notarial = quebecWill.value === 'notarial';

  try {
    const invalid = amounts.find(input => !input.disabled && !input.validity.valid);
    if (invalid) {
      throw new RangeError('Enter an amount from $0 to $1 billion, to the nearest cent, for ' +
        invalid.labels[0].textContent.trim() + '.');
    }
    const estimate = estimateEstate(scenario);
    for (const output of outputs) {
      const value = estimate[output.dataset.result];
      output.textContent = value === null ? '—' :
        output.dataset.result === 'shrinkageRate' ? percent.format(value) : cad.format(value);
    }
    document.querySelector('#shortfall').hidden = estimate.netEstate >= 0;
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    results.hidden = true;
    error.hidden = false;
    error.textContent = failure.message;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
