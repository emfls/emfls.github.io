import { calculateComparison, calculatePurchase } from './model.mjs';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const money = amount => gbp.format(Math.abs(amount) < 0.005 ? 0 : amount);
const byId = id => document.getElementById(id);
const comparisonForm = byId('comparison-form');
const purchaseForm = byId('purchase-form');
const comparisonResults = byId('comparison-results');
const purchaseResults = byId('purchase-results');
const comparisonError = byId('comparison-error');
const purchaseError = byId('purchase-error');

const comparatorFields = {
  standard: { container: byId('comparator-rate-field'), input: byId('comparator-rate') },
  intermediate: { container: byId('intermediate-rate-field'), input: byId('intermediate-rate') },
  phev: { container: byId('phev-range-field'), input: byId('phev-rate') },
};

function readNumber(input) {
  const valid = input.validity.valid;
  if (valid) input.removeAttribute('aria-invalid');
  else input.setAttribute('aria-invalid', 'true');

  if (input.tagName === 'SELECT') return Number(input.value);
  return valid ? input.valueAsNumber : NaN;
}

function writeMoney(values) {
  for (const [id, amount] of Object.entries(values)) byId(id).textContent = money(amount);
}

function scheduleRow({ taxYear, ev, comparator }) {
  const row = document.createElement('tr');
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = taxYear;
  row.append(heading);
  for (const value of [
    ev.rate + '%',
    money(ev.bikValue),
    money(ev.employeeTax),
    money(ev.monthlyTax),
    money(ev.employerNic),
    comparator.rate + '%',
    money(comparator.employeeTax),
    money(comparator.employerNic),
  ]) {
    const cell = row.insertCell();
    cell.className = 'number';
    cell.textContent = value;
  }
  return row;
}

function renderComparison(result, privateFuel) {
  const firstYear = result.years[0];
  const lastYear = result.years.at(-1);
  writeMoney({
    'ev-tax': result.ev.employeeTax,
    'comparator-tax': result.comparator.employeeTax,
    'ev-nic': result.ev.employerNic,
    'comparator-nic': result.comparator.employerNic,
    'employee-savings': result.employeeSavings,
    'employer-savings': result.employerSavings,
  });

  byId('escalation').textContent =
    'Budget for ' + money(result.escalationTax) + ' more employee tax in ' + lastYear.taxYear +
    ' than in ' + firstYear.taxYear + ' (' + money(firstYear.ev.employeeTax) + ' → ' +
    money(lastYear.ev.employeeTax) + ' per year).';
  byId('fuel-cost').textContent = privateFuel
    ? 'At the £29,200 fuel multiplier, private fuel alone adds ' +
      money(firstYear.comparator.fuelEmployeeTax) + ' of employee tax and ' +
      money(firstYear.comparator.fuelEmployerNic) + ' of employer NIC in 2026/27. Four-year fuel charges are ' +
      money(result.fuel.employeeTax) + ' to the employee and ' + money(result.fuel.employerNic) + ' to the employer.'
    : 'Private fuel is off. Turn it on to see the extra employee tax and employer NIC from the £29,200 multiplier.';
  byId('schedule-rows').replaceChildren(...result.years.map(scheduleRow));
  comparisonResults.hidden = false;
}

function renderPurchase(comparison) {
  if (!comparison) {
    purchaseResults.hidden = true;
    purchaseError.textContent = 'Complete the company car comparison to include four years of director tax and employer NIC.';
    return;
  }

  let purchase;
  try {
    purchase = calculatePurchase({
      companyPurchasePrice: readNumber(byId('company-price')),
      personalPurchasePrice: readNumber(byId('personal-price')),
      corporationTaxRate: readNumber(byId('corporation-tax-rate')),
      qualifyingPurchase: byId('qualifies').checked,
      employeeTax: comparison.ev.employeeTax,
      employerNic: comparison.ev.employerNic,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    purchaseResults.hidden = true;
    purchaseError.textContent = error.message;
    return;
  }

  writeMoney({
    deductible: purchase.deductibleAmount,
    'corporation-tax-saved': purchase.corporationTaxSaved,
    'company-net': purchase.companyNetPurchase,
    'combined-cost': purchase.combinedCost,
    'personal-cost': purchase.personalCost,
    'purchase-savings': purchase.combinedSavings,
  });
  purchaseError.textContent = '';
  purchaseResults.hidden = false;
}

let comparison;

function updateComparison() {
  const band = byId('comparator-band').value;
  const privateFuel = byId('private-fuel').checked;
  for (const [key, field] of Object.entries(comparatorFields)) {
    field.container.hidden = key !== band;
    field.input.disabled = key !== band;
  }

  try {
    comparison = calculateComparison({
      evListPrice: readNumber(byId('ev-price')),
      comparatorListPrice: readNumber(byId('comparator-price')),
      taxRate: readNumber(byId('tax-rate')),
      comparatorBand: band,
      comparatorRate: readNumber(comparatorFields[band].input),
      privateFuel,
    });
    comparisonError.textContent = '';
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    comparison = undefined;
    comparisonResults.hidden = true;
    comparisonError.textContent = error.message;
  }

  if (comparison) renderComparison(comparison, privateFuel);
  renderPurchase(comparison);
}

comparisonForm.addEventListener('input', updateComparison);
purchaseForm.addEventListener('input', () => renderPurchase(comparison));
for (const form of [comparisonForm, purchaseForm]) {
  form.addEventListener('submit', event => event.preventDefault());
}
updateComparison();
