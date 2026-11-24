import { calculateRebate } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('rebate-form');
const results = byId('results');
const error = byId('error');
const price = byId('home-price');
const province = byId('province');
const propertyType = byId('property-type');
const agreementDate = byId('agreement-date');
const downPayment = byId('down-payment');
const annualRate = byId('annual-rate');
const qualifyingUse = byId('qualifying-use');
const firstTime = byId('first-time');
const provincial = byId('provincial');
const nsEligible = byId('ns-eligible');
const nsConfirmed = byId('ns-confirmed');
const resultFields = results.querySelectorAll('[data-result]');

const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

function showError(message) {
  error.textContent = message;
  results.hidden = true;
}

function update() {
  const isResale = propertyType.value === 'resale';
  const isOntario = province.value === 'ON';
  const isQuebec = province.value === 'QC';
  const isNovaScotia = province.value === 'NS' && propertyType.value === 'new';
  byId('eligibility-fields').hidden = isResale;
  byId('agreement-field').hidden = isResale;
  agreementDate.disabled = isResale;
  byId('provincial-field').hidden = !isOntario && !isQuebec;
  provincial.labels[0].lastChild.textContent = isQuebec
    ? ' Include the Quebec QST new housing rebate if eligible.'
    : ' Include the standard Ontario new housing rebate if eligible.';
  byId('ns-field').hidden = !isNovaScotia;
  if (!isNovaScotia || !nsEligible.checked) nsConfirmed.checked = false;
  nsConfirmed.disabled = !nsEligible.checked;
  byId('gross-label').textContent = isQuebec ? 'Gross GST and QST charged' : 'Gross GST/HST charged';

  if (!form.checkValidity()) {
    const invalid = form.querySelector(':invalid');
    showError(`${invalid.labels[0].textContent}. ${invalid.validationMessage}`);
    return;
  }

  let estimate;
  try {
    estimate = calculateRebate({
      homePrice: price.valueAsNumber,
      province: province.value,
      propertyType: propertyType.value,
      qualifyingUse: qualifyingUse.checked,
      firstTimeEligible: firstTime.checked,
      provincialEligible: isNovaScotia ? nsEligible.checked : provincial.checked,
      nsCombinationConfirmed: nsConfirmed.checked,
      agreementDate: agreementDate.value,
      downPaymentPercent: downPayment.valueAsNumber,
      annualRate: annualRate.valueAsNumber,
    });
  } catch (exception) {
    showError(exception.message);
    return;
  }

  const notes = [];
  if (isResale) {
    notes.push('Typical exempt resales have no GST/HST or new housing rebate in this estimate.');
  } else if (!estimate.agreementEligible) {
    notes.push('The original agreement falls outside the federal Bill C-4 date window.');
  } else if (!estimate.fthbEligible) {
    notes.push('Bill C-4 is excluded because the selected eligibility conditions are unmet.');
  } else if (price.valueAsNumber >= 1_500_000) {
    notes.push('The federal first-time buyer rebate reaches zero at $1.5 million.');
  }

  if (!isResale && isOntario) {
    notes.push('This estimate uses Ontario’s standard rebate. Check the CRA guide below for Ontario’s separate first-time buyer rebate, temporary enhanced rebate and related affordability payment.');
  }
  if (isNovaScotia && estimate.nsPotentialRebate > estimate.provincialRebate) {
    notes.push(`Potential Nova Scotia rebate: ${cad.format(estimate.nsPotentialRebate)}. It is excluded from the combined estimate until you confirm that Service Nova Scotia allows both claims.`);
  }
  byId('scenario-note').textContent = notes.join(' ');
  byId('scenario-note').hidden = notes.length === 0;

  for (const field of resultFields) {
    field.textContent = cad.format(estimate[field.dataset.result]);
  }
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', update);
form.addEventListener('change', update);
update();
