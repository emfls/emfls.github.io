import { compareCarExpenses } from './model.mjs';

const form = document.getElementById('car-expenses');
const error = document.getElementById('calculation-error');
const result = document.getElementById('comparison');
const fields = [...form.querySelectorAll('input[type="number"]')];
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 2 });
const kilometres = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });

const winnerNames = {
  logbook: 'Logbook gives the larger deduction',
  cents: '91¢/km gives the larger deduction',
  tie: 'Both methods give the same deduction',
};

const breakEvenText = {
  'no-travel': 'Enter annual kilometres to compare.',
  'logbook-ahead': 'Logbook leads for every positive work distance.',
  'cents-ahead': '91¢/km leads throughout your annual distance.',
  'tie-throughout': 'The methods tie throughout your annual distance.',
  'tie-until-cap': 'The methods tie through 5,000 km. Logbook leads above that.',
};

function calculate() {
  const { depreciationMethod, carPurchasePrice, actualDepreciation, medicareRate } = form.elements;
  const useActual = depreciationMethod.value === 'actual';
  carPurchasePrice.disabled = carPurchasePrice.parentElement.hidden = useActual;
  actualDepreciation.disabled = actualDepreciation.parentElement.hidden = !useActual;

  const enabledFields = fields.filter(field => !field.disabled);
  for (const field of fields) field.removeAttribute('aria-invalid');
  const invalidField = enabledFields.find(field => !field.validity.valid);
  if (invalidField) {
    invalidField.setAttribute('aria-invalid', 'true');
    error.textContent = `Enter a valid value for ${invalidField.labels[0].textContent.toLowerCase()} (0 to 1 billion).`;
    result.hidden = true;
    return;
  }

  const values = Object.fromEntries(enabledFields.map(field => [field.name, field.valueAsNumber]));
  if (values.businessKm > values.totalAnnualKm) {
    form.elements.businessKm.setAttribute('aria-invalid', 'true');
    error.textContent = 'Work-related kilometres cannot exceed total annual kilometres.';
    result.hidden = true;
    return;
  }

  const estimate = compareCarExpenses({
    ...values,
    depreciationMethod: depreciationMethod.value,
    medicareRate: Number(medicareRate.value),
  });
  const { breakEven } = estimate;
  const formatted = {
    winner: winnerNames[estimate.winningMethod],
    cents: currency.format(estimate.centsPerKmDeduction),
    logbook: currency.format(estimate.logbookDeduction),
    extra: currency.format(estimate.extraDeduction),
    tax: currency.format(estimate.cashTaxDifference),
    use: percent.format(estimate.businessUsePct),
    depreciation: currency.format(estimate.annualDepreciation),
    'break-even': breakEven.kind === 'crossing'
      ? `About ${kilometres.format(breakEven.km)} work km`
      : breakEvenText[breakEven.kind],
  };
  for (const [id, text] of Object.entries(formatted)) document.getElementById(id).textContent = text;

  error.textContent = '';
  result.hidden = false;
}

form.addEventListener('input', calculate);
form.addEventListener('submit', event => event.preventDefault());
calculate();
