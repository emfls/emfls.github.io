import { comparePay } from './model.mjs';

const form = document.querySelector('#pay-inputs');
const fields = form.elements;
const results = document.querySelector('#pay-results');
const error = document.querySelector('#pay-error');
const apprenticeOption = document.querySelector('#apprentice-option');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const rows = [
  ['hourly-rate', pay => pay.hourlyRate],
  ['gross-annual', pay => pay.gross.annual],
  ['gross-monthly', pay => pay.gross.monthly],
  ['gross-weekly', pay => pay.gross.weekly],
  ['net-annual', pay => pay.net.annual],
  ['net-monthly', pay => pay.net.monthly],
  ['net-weekly', pay => pay.net.weekly],
  ['effective-hourly', pay => pay.effectiveHourlyNet],
  ['tax', pay => pay.tax],
  ['employee-ni', pay => pay.employeeNI],
  ['employee-pension', pay => pay.employeePension],
  ['employer-ni', pay => pay.employerNI],
  ['employer-pension', pay => pay.employerPension],
  ['employer-cost', pay => pay.employerCost],
].map(([key, read]) => [document.querySelectorAll(`[data-pay="${key}"]`), read]);

function render() {
  const band = fields.band.value;
  const showApprentice = band === 'adult' || band === 'apprentice';
  apprenticeOption.hidden = !showApprentice;
  fields.apprenticeUnder25.disabled = !showApprentice;

  let comparison;
  try {
    comparison = comparePay({
      band,
      contractedHours: fields.contractedHours.valueAsNumber,
      overtimeHours: fields.overtimeHours.valueAsNumber,
      multiplier: Number(fields.multiplier.value),
      region: fields.region.value,
      pension: fields.pension.checked,
      apprenticeUnder25: showApprentice && fields.apprenticeUnder25.checked,
    });
  } catch (problem) {
    error.textContent = problem.message;
    results.hidden = true;
    return;
  }

  const estimates = [comparison.april2026, comparison.april2027];
  for (const [cells, read] of rows) {
    cells.forEach((cell, index) => {
      const value = read(estimates[index]);
      cell.textContent = value === null ? '—' : money.format(value);
    });
  }
  document.querySelector('#net-rise').textContent = money.format(comparison.annualNetRise);
  document.querySelector('#hourly-rise').textContent =
    `${money.format(comparison.hourlyRise)}/hr more gross (${comparison.hourlyRisePercent.toFixed(2)}%)`;
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();
