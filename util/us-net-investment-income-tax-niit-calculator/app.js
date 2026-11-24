import { calculateTaxes, simulateNiit } from './model.mjs';

const form = document.querySelector('#tax-form');
const error = document.querySelector('#error');
const results = document.querySelector('#results');
const scenarioResults = document.querySelector('#scenario-results');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const numericInputs = [...form.querySelectorAll('input[type="number"]')];

function render() {
  const invalid = numericInputs.filter(input => !input.validity.valid);
  for (const input of numericInputs) {
    input.setAttribute('aria-invalid', String(!input.validity.valid));
  }
  results.hidden = invalid.length > 0;
  scenarioResults.hidden = results.hidden;
  if (invalid.length) {
    const label = invalid[0].labels[0].textContent;
    error.textContent = `Check ${label}. Enter an amount in the allowed range with up to two decimal places.`;
    return;
  }
  error.textContent = '';

  const values = Object.fromEntries(numericInputs.map(input => [input.id, input.valueAsNumber || 0]));
  const { harvest, muni, pretax, ...income } = values;
  const inputs = { ...income, filing: form.elements.filing.value };
  const tax = calculateTaxes(inputs);
  const scenarios = simulateNiit(inputs, { harvest, muni, pretax });

  const amounts = {
    niitTax: tax.niitTax,
    addlMedicareTax: tax.addlMedicareTax,
    totalTax: tax.totalTax,
    netInvestmentIncome: tax.netInvestmentIncome,
    magiExcess: tax.magiExcess,
    niitBase: tax.niitBase,
    medicareBase: tax.medicareBase,
    niitThreshold: tax.thresholds.niit,
    medicareThreshold: tax.thresholds.medicare,
    harvestSaved: scenarios.harvest.niitSaved,
    muniSaved: scenarios.muni.niitSaved,
    pretaxSaved: scenarios.pretax.niitSaved,
    combinedSaved: scenarios.combined.niitSaved,
    combinedMagi: scenarios.combined.magi,
    combinedNiit: scenarios.combined.niitTax,
  };
  for (const [id, amount] of Object.entries(amounts)) {
    document.getElementById(id).textContent = money.format(amount);
  }
  const capNotes = [];
  if (harvest > scenarios.harvestApplied) {
    capNotes.push(`Harvesting is limited to ${money.format(scenarios.harvestApplied)} of entered positive gains.`);
  }
  if (muni > scenarios.muniApplied) {
    capNotes.push(`The municipal bond shift is limited to ${money.format(scenarios.muniApplied)} of entered taxable interest.`);
  }
  document.querySelector('#scenario-notes').textContent = capNotes.join(' ');
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();

// Initialize only ad units configured for the publisher in this page.
for (const slot of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(slot.dataset.adSlot)) (window.adsbygoogle ||= []).push({});
}
