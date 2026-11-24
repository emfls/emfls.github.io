import { calculateRental } from './model.mjs';

const form = document.getElementById('rental-form');
const numericInputs = Array.from(form.querySelectorAll('input[type="number"]'));
const results = document.getElementById('rental-results');
const error = document.getElementById('input-error');
const reformCard = document.getElementById('reform-card');
const money = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', minimumFractionDigits: 2,
});
const percent = new Intl.NumberFormat('en-AU', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function setValues(values) {
  for (const [id, content] of Object.entries(values)) {
    document.getElementById(id).textContent = content;
  }
}

function formatMoney(amount) {
  return money.format(Math.abs(amount) < 0.005 ? 0 : amount);
}

function weeklyLabel(cost) {
  return cost < -0.005 ? 'Weekly after-tax surplus' : 'Weekly after-tax holding cost';
}

function taxLabel(saving) {
  return saving < -0.005 ? 'Estimated extra tax' : 'Estimated tax saving';
}

function render() {
  const inputs = { acquisitionType: form.elements.acquisitionType.value };
  let firstInvalid;
  for (const input of numericInputs) {
    inputs[input.name] = input.valueAsNumber;
    if (input.validity.valid) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    } else {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'input-error');
      firstInvalid ??= input;
    }
  }

  error.hidden = !firstInvalid;
  results.hidden = Boolean(firstInvalid);
  if (firstInvalid) {
    const label = firstInvalid.labels[0].textContent;
    error.textContent = `Enter a valid value for ${label.toLowerCase()} (${firstInvalid.min} to ${Number(firstInvalid.max).toLocaleString('en-AU')}).`;
    setValues({ 'result-status': error.textContent });
    return;
  }

  const rental = calculateRental(inputs);
  const { current, reform } = rental;
  const quarantined = reform.quarantinedLoss > 0;
  reformCard.dataset.quarantined = String(quarantined);
  let reformMessage = 'The wage offset remains available for the selected property type if it has an eligible rental loss.';
  if (quarantined) {
    reformMessage = 'Quarantined loss. This property’s loss cannot reduce wages. It may offset eligible residential property income or gains, with any unused balance carried forward.';
  } else if (reform.usesQuarantine) {
    reformMessage = 'The restriction applies to rental losses. This scenario has no rental loss to quarantine.';
  }

  setValues({
    'weekly-label': weeklyLabel(current.weeklyAfterTaxCost),
    'weekly-cost': formatMoney(Math.abs(current.weeklyAfterTaxCost)),
    growth: percent.format(current.breakEvenGrowthRate),
    'gross-rent': formatMoney(rental.grossAnnualRent),
    'cash-expenses': formatMoney(rental.cashExpenses),
    'pre-tax': formatMoney(rental.preTaxCashflow),
    depreciation: formatMoney(rental.nonCashDepreciation),
    'taxable-rental': formatMoney(rental.taxableNetRental),
    'tax-label': taxLabel(current.taxRefund),
    'tax-impact': formatMoney(Math.abs(current.taxRefund)),
    'after-tax': formatMoney(current.afterTaxAnnualCashflow),
    'add-back': current.netInvestmentLossAddBack > 0
      ? `Net investment loss add-back: your ${formatMoney(current.netInvestmentLossAddBack)} rental loss may be added back for HECS-HELP, Medicare levy surcharge and Child Care Subsidy income tests.`
      : 'This property shows no rental loss to count toward a net investment loss add-back.',
    'reform-message': reformMessage,
    'reform-tax-label': taxLabel(reform.taxRefund),
    'reform-tax': formatMoney(Math.abs(reform.taxRefund)),
    'quarantined-loss': formatMoney(reform.quarantinedLoss),
    'reform-weekly-label': weeklyLabel(reform.weeklyAfterTaxCost),
    'reform-weekly': formatMoney(Math.abs(reform.weeklyAfterTaxCost)),
    'reform-growth': percent.format(reform.breakEvenGrowthRate),
    'result-status': `${weeklyLabel(current.weeklyAfterTaxCost)} ${formatMoney(Math.abs(current.weeklyAfterTaxCost))}. ${taxLabel(current.taxRefund)} ${formatMoney(Math.abs(current.taxRefund))}.`,
  });
}

form.addEventListener('input', render);
form.addEventListener('reset', () => setTimeout(render, 0));
form.addEventListener('submit', (event) => event.preventDefault());
render();
