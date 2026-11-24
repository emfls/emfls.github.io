import { calculateCarFbt } from './model.mjs';

const form = document.querySelector('#fbt-form');
const results = document.querySelector('#results');
const announcement = document.querySelector('#announcement');
const error = document.querySelector('#error');
const numbers = [...form.querySelectorAll('input[type="number"]')];
const fields = form.elements;
const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'code',
});
const percent = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 6 });

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function render() {
  const invalid = numbers.find(input => !input.validity.valid);
  for (const input of numbers) {
    input.setAttribute('aria-invalid', String(!input.validity.valid));
  }
  if (invalid) {
    const label = invalid.labels[0].textContent;
    const unit = invalid.step === '1' ? 'a whole number' : 'a number';
    error.textContent = `${label}: enter ${unit} from ${invalid.min} to ${Number(invalid.max).toLocaleString('en-AU')}.`;
    results.hidden = true;
    announcement.textContent = '';
    return;
  }

  const calculation = calculateCarFbt({
    ...Object.fromEntries(numbers.map(input => [input.name, input.valueAsNumber])),
    ownedFourFullFbtYears: fields.ownedFourFullFbtYears.checked,
    grossUpType: fields.grossUpType.value,
  });

  error.textContent = '';
  results.hidden = false;
  const { statutory, operating, winner, fbtSaved, breakEven } = calculation;
  const methodNames = { statutory: 'Statutory formula', operating: 'Operating cost (logbook)' };
  const outcome = winner === 'tie' ? 'Both methods give the same FBT' : `${methodNames[winner]} gives the lower FBT`;
  setText('winner', outcome);
  setText('saved', aud.format(fbtSaved));
  const breakEvenText = {
    always: '0% minimum. Logbook is cheaper even at 0% business use.',
    never: 'No crossover. Statutory FBT is already zero at this contribution.',
    threshold: `Above ${percent.format(breakEven.businessUsePct)}% business use (equal FBT at the crossover).`,
  };
  setText('break-even', breakEvenText[breakEven.kind]);
  setText('effective-base', aud.format(calculation.effectiveBaseValue));
  setText('operating-costs', aud.format(calculation.totalOperatingCosts));
  setText('private-use', `${percent.format(calculation.privateUsePct)}%`);

  for (const [method, values] of Object.entries({ statutory, operating })) {
    for (const [name, value] of Object.entries(values)) {
      setText(`${method}-${name}`, aud.format(value));
    }
  }
  announcement.textContent = `${outcome}. FBT saved this year: ${aud.format(fbtSaved)}. ${breakEvenText[breakEven.kind]}`;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
