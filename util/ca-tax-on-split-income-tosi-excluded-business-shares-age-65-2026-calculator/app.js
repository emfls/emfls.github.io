import { calculateTosi } from './model.mjs';

const form = document.querySelector('#calculator');
const error = document.querySelector('#error');
const result = document.querySelector('#result');
const gateList = document.querySelector('#gate-list');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });

function render() {
  try {
    const input = Object.fromEntries(Array.from(form.elements, control => {
      if (control.type === 'number') return [control.id, control.valueAsNumber];
      if (control.type === 'checkbox') return [control.id, control.checked];
      if (control.id === 'direct' || control.id === 'professional') return [control.id, control.value === 'yes'];
      return [control.id, control.value];
    }));
    const estimate = calculateTosi(input);
    const outcomes = estimate.qualifyingGates.map(gate => gate.name).join(', ');
    document.querySelector('#status').textContent = outcomes
      ? `TOSI_EXEMPT · ${outcomes}`
      : 'CAUGHT_BY_TOSI · No dividend exclusion confirmed by this screen';
    document.querySelector('#tosi-tax').textContent = currency.format(estimate.tosiTax);
    document.querySelector('#exempt-tax').textContent = currency.format(estimate.exemptTax);
    document.querySelector('#savings').textContent = currency.format(estimate.savings);
    document.querySelector('#tosi-rate').textContent = `${percent.format(estimate.tosiRate)} flat rate`;
    document.querySelector('#exempt-rate').textContent = estimate.exemptRate === null
      ? 'Effective rate unavailable at $0'
      : `${percent.format(estimate.exemptRate)} effective rate`;
    document.querySelector('#salary-tax').textContent = currency.format(estimate.salaryTax);
    gateList.replaceChildren(...estimate.gates.map(({ name, failures, basis }) => {
      const item = document.createElement('li');
      const label = document.createElement('strong');
      label.textContent = name;
      item.append(label, ` — ${failures.length ? failures.join(' ') : basis}`);
      return item;
    }));
    error.hidden = true;
    result.hidden = false;
  } catch (issue) {
    result.hidden = true;
    error.textContent = issue.message;
    error.hidden = false;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
