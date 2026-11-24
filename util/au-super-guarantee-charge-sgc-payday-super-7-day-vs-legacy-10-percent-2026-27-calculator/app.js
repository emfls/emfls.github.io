import { calculateComparison } from './model.mjs';

const form = document.getElementById('sgc-form');
const results = document.getElementById('sgc-results');
const error = document.getElementById('sgc-error');
const announcement = document.getElementById('sgc-announcement');
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const percent = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' });
const moneyFields = [
  'contribution', 'onTimeAfterTax', 'shortfall', 'grossCharge', 'taxSaving', 'afterTax', 'extraCost'
];

function displayScenario(name, scenario, components) {
  for (const key of [...moneyFields, ...components]) {
    document.getElementById(`${name}-${key}`).textContent = currency.format(scenario[key]);
  }
  document.getElementById(`${name}-extraPercent`).textContent =
    scenario.extraPercent === null ? 'N/A' : `${percent.format(scenario.extraPercent)}%`;
}

function render() {
  const { elements } = form;
  const number = name => elements.namedItem(name).valueAsNumber;
  const value = name => elements.namedItem(name).value;
  try {
    const { payday, legacy } = calculateComparison({
      qualifyingEarnings: number('qualifyingEarnings'),
      priorQualifyingEarnings: number('priorQualifyingEarnings'),
      paydayLateDays: number('paydayLateDays'),
      annualGicPercent: number('annualGicPercent'),
      upliftPercent: number('upliftPercent'),
      ordinaryTimeEarnings: number('ordinaryTimeEarnings'),
      salaryAndWages: number('salaryAndWages'),
      legacyQuarter: value('legacyQuarter'),
      lodgedOn: value('lodgedOn'),
      companyTaxPercent: Number(value('companyTaxPercent'))
    });
    displayScenario('payday', payday, ['notionalEarnings', 'uplift']);
    displayScenario('legacy', legacy, ['interest', 'fee']);
    document.getElementById('legacy-days').textContent =
      `${legacy.interestDays} calendar days of nominal interest (end date ${date.format(new Date(legacy.interestEnd))}, excluded).`;
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
    announcement.textContent = `After tax, late Payday Super costs ${currency.format(payday.afterTax)} and late quarterly super costs ${currency.format(legacy.afterTax)}.`;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    announcement.textContent = '';
    error.textContent = problem.message;
    error.hidden = false;
  }
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
