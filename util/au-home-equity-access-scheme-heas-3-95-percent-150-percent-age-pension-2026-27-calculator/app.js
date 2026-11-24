import { HEAS_RATE, PENSION_RATES, project } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('heas-form');
const household = byId('household');
const preset = byId('preset');
const maxPension = byId('maxPension');
const partnerAge = byId('partnerAge');
const secondFortnight = byId('secondFortnight');
const results = byId('results');
const comparison = byId('comparison');
const error = byId('error');
const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const money = value => aud.format(value);
const amount = id => byId(id).valueAsNumber;
const setText = (id, value) => { byId(id).textContent = value; };

function inputsFromForm() {
  return {
    household: household.value,
    age: amount('age'),
    partnerAge: partnerAge.valueAsNumber,
    maxPension: maxPension.valueAsNumber,
    pension: amount('pension'),
    property: amount('property'),
    liens: amount('liens'),
    reserve: amount('reserve'),
    draw: amount('draw'),
    advance1: amount('advance1'),
    advance2: amount('advance2'),
    secondFortnight: secondFortnight.valueAsNumber,
    commercialRate: amount('commercialRate'),
    propertyGrowth: amount('propertyGrowth'),
    heasProtection: byId('heasProtection').checked,
    commercialProtection: byId('commercialProtection').checked,
  };
}

function renderComparison(snapshots) {
  const rows = [
    ['Home value', row => row.property],
    ['Total borrowed in either scenario', row => row.drawn],
    ['HEAS loan balance', row => row.heasBalance],
    ['HEAS interest', row => row.heasInterest],
    ['Commercial loan balance', row => row.commercialBalance],
    ['Commercial interest', row => row.commercialInterest],
    ['HEAS balance above net security', row => row.heasSettlement.shortfall],
    ['Commercial balance above net security', row => row.commercialSettlement.shortfall],
    ['HEAS home equity after settlement', row => row.heasSettlement.equity],
    ['Commercial home equity after settlement', row => row.commercialSettlement.equity],
    ['Estate equity preserved with HEAS', row => row.equityPreserved, 'highlight'],
  ];

  const fragment = document.createDocumentFragment();
  for (const [label, value, className] of rows) {
    const tr = document.createElement('tr');
    if (className) tr.className = className;
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    tr.append(th);
    for (const snapshot of snapshots) {
      const td = document.createElement('td');
      td.textContent = money(value(snapshot));
      tr.append(td);
    }
    fragment.append(tr);
  }
  byId('projections').replaceChildren(fragment);
}

function protectionSummary(label, snapshots, key, enabled) {
  const affectedYears = snapshots.filter(row => row[key].shortfall > 0).map(row => row.year);
  if (affectedYears.length === 0) return `${label} has no projected loan shortfall at the three checkpoints.`;
  const years = new Intl.ListFormat('en-AU').format(affectedYears.map(String));
  const yearLabel = affectedYears.length === 1 ? 'year' : 'years';
  const treatment = enabled ? 'The selected protection caps repayment at net security.' : 'This scenario leaves the shortfall payable.';
  return `${label} exceeds net security at ${yearLabel} ${years}. ${treatment}`;
}

function render() {
  const inputs = inputsFromForm();
  const coupled = inputs.household === 'couple';
  byId('partner-field').hidden = !coupled;
  partnerAge.disabled = !coupled;
  secondFortnight.disabled = inputs.advance2 === 0;
  setText('pension-hint', coupled ? 'Enter both pensions combined, or $0 if neither receives a pension.' : 'Enter $0 if you receive no pension.');

  let estimate;
  try {
    estimate = project(inputs);
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    results.hidden = true;
    comparison.hidden = true;
    return;
  }

  const { limits, snapshots, stoppedFortnight } = estimate;
  error.hidden = true;
  error.textContent = '';
  setText('combined-cap', money(limits.cap));
  setText('first-draw', money(estimate.firstDraw));
  setText('start-limit', money(estimate.startLimit));
  setText('payment-detail',
    `Before advances and security limits, your available top-up is ${money(limits.topUp)} per fortnight. The pension-based ceiling in the first fortnight is ${money(estimate.firstPaymentCap)} after any first advance. Your estimated pension plus regular loan payment is ${money(estimate.firstCombined)} in the first fortnight. The annualised combined ceiling is ${money(limits.annualCap)} over 26 fortnights.`);
  const stopMessage = stoppedFortnight === null
    ? 'The model does not reach the security limit within 20 years.'
    : `The model reaches the security limit in fortnight ${stoppedFortnight}. Interest continues after draws stop.`;
  setText('security-detail', `Assessed age ${estimate.assessedAge} gives ${money(estimate.factor)} per $10,000 of rounded security. ${stopMessage}`);
  setText('advance-detail',
    `The pension-based advance limit is ${money(limits.advanceCap)} per 26 fortnights. Estimated first advance ${money(estimate.firstAdvance)}. Estimated second advance ${money(estimate.secondAdvance)}. These amounts reflect the security limit and available advance capacity.`);
  setText('comparison-description',
    `Both loans receive the same cash draw schedule. Rates are ${HEAS_RATE}% for HEAS and ${inputs.commercialRate}% for the commercial scenario. Scroll the table to see all three years.`);
  renderComparison(snapshots);
  setText('settlement-detail', [
    protectionSummary('HEAS', snapshots, 'heasSettlement', inputs.heasProtection),
    protectionSummary('The commercial loan', snapshots, 'commercialSettlement', inputs.commercialProtection),
  ].join(' '));

  results.hidden = false;
  comparison.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === maxPension) preset.value = 'custom';
  if (event.target === household || event.target === preset) {
    const rates = PENSION_RATES[preset.value];
    if (rates) maxPension.value = rates[household.value].toFixed(2);
  }
  render();
});
render();
