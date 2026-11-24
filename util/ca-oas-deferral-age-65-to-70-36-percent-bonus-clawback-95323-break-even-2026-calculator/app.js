import { calculateOas, OAS } from './model.mjs';

const element = id => document.getElementById(id);
const setText = (id, value) => { element(id).textContent = value; };
const form = element('oas-form');
const results = element('results');
const error = element('input-error');
const gisWarning = element('gis-warning');
const startAge = element('start-age');
const monthOffset = element('month-offset');
const gis = element('gis');
const fields = {
  residenceYears: element('residence-years'),
  startAge,
  monthOffset,
  incomeBefore70: element('income-before-70'),
  incomeFrom70: element('income-from-70'),
  realRate: element('real-rate'),
  lifeAge: element('life-age'),
};

const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 });

function formatAge(age) {
  const totalMonths = Math.round(age * 12);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (months === 0) return String(years);
  return `${years} years, ${months} ${months === 1 ? 'month' : 'months'}`;
}

function formatBreakEven(age, delayMonths) {
  if (delayMonths === 0) return 'Same start age';
  return age === null ? `No catch-up by age ${OAS.comparisonLimit}` : formatAge(age);
}

function showPayment(id, quote) {
  setText(`${id}-monthly`, cad.format(quote.netMonthly));
  setText(`${id}-annual`, cad.format(quote.netAnnual));
}

function update() {
  monthOffset.disabled = startAge.valueAsNumber === 70;
  if (monthOffset.disabled) monthOffset.value = '0';

  const hasGis = gis.value === 'yes';
  const invalid = Object.values(fields).find(field => !field.validity.valid);
  if (invalid) {
    gisWarning.hidden = !hasGis;
    results.hidden = true;
    error.textContent = `${invalid.labels[0].textContent}. ${invalid.validationMessage}`;
    error.hidden = false;
    return;
  }

  error.hidden = true;
  error.textContent = '';
  const inputs = Object.fromEntries(Object.entries(fields)
    .map(([key, field]) => [key, field.valueAsNumber]));
  const plan = calculateOas({ ...inputs, gis: hasGis });
  const targetAge = formatAge(inputs.startAge + inputs.monthOffset / 12);
  const difference = Math.round(plan.lifetimeDifference * 100) / 100;

  gisWarning.hidden = !plan.gisWarning;
  setText('scenario-note', `Start at age ${targetAge} for a ${percent.format(plan.bonusPercent)}% gross deferral increase. Your residence qualifies you for ${percent.format(plan.residenceFraction * 100)}% of the full pension rate in this estimate.`);
  setText('break-even', formatBreakEven(plan.simpleBreakEvenAge, plan.delayMonths));
  setText('discounted-break-even', formatBreakEven(plan.discountedBreakEvenAge, plan.delayMonths));
  setText('clawback-avoided', cad.format(plan.clawbackAvoided));
  setText('waiting-note', `During the ${plan.delayMonths}-month wait, the age-65 option would pay ${cad.format(plan.earlyNetForgone)} after recovery tax.`);

  setText('horizon-age', inputs.lifeAge);
  setText('deferred-heading', `Start at age ${targetAge}`);
  setText('early-lifetime', cad.format(plan.early.lifetime));
  setText('deferred-lifetime', cad.format(plan.deferred.lifetime));
  const comparison = difference === 0 ? 'Both options pay the same amount by this age.'
    : `The ${difference > 0 ? 'selected start' : 'age-65 start'} pays ${cad.format(Math.abs(difference))} more by this age.`;
  setText('lifetime-difference', comparison);

  showPayment('early-start', plan.early.start);
  showPayment('early-75', plan.early.age75);
  showPayment('deferred-start', plan.deferred.start);
  showPayment('deferred-75', plan.deferred.age75);
  setText('ceilings', `Modeled income at full recovery for the selected start is ${cad.format(plan.deferred.start.eliminationIncome)} before age 75 and ${cad.format(plan.deferred.age75.eliminationIncome)} after the age-75 increase.`);
  results.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
