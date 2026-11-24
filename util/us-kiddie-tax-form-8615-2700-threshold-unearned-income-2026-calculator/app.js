import { calculate } from './model.mjs';

const form = document.getElementById('tax-form');
const error = document.getElementById('error');
const results = document.getElementById('results');
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const unavailable = '—';
const electionReasons = {
  type: 'The modeled wages, investment sales or other unearned income make Form 8814 unavailable.',
  income: 'Form 8814 requires gross income over $1,350 and under $13,500.',
  confirmation: 'Confirm the Form 8814 eligibility conditions to see the election estimate.'
};

function update() {
  const input = Object.fromEntries([...form.elements].filter(field => field.name).map(field => {
    const value = field.type === 'checkbox' ? field.checked
      : field.type === 'number' ? field.valueAsNumber : field.value;
    return [field.name, value];
  }));

  let estimate;
  try {
    if (!form.checkValidity()) throw new RangeError('Enter an amount in each field using up to two decimal places.');
    estimate = calculate(input);
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
    return;
  }

  const { current, projected, deduction, thresholdRoom, harvestRoom, saleTaxChange } = estimate;
  const electionAvailable = current.electionReason === null;
  const money = (id, amount) => {
    document.getElementById(id).textContent = amount === undefined ? unavailable : dollars.format(amount);
  };
  const write = (id, value) => { document.getElementById(id).textContent = value; };

  write('separate-label', current.kiddieRequired ? 'Child’s separate return (Form 8615)' : 'Child’s separate return');
  money('separate-tax', current.separateTax);
  money('election-tax', current.electionTax);
  money('harvest-room', harvestRoom);
  money('unearned', current.unearned);
  money('deduction', deduction);
  money('taxable', current.taxable);
  money('above-threshold', current.aboveThreshold);
  money('parent-share', current.parentShare);
  money('parent-qualified', current.parentPreferentialShare);
  money('parent-tax', current.parentTax);
  money('child-rate-tax', current.childRateTax);
  money('tax-floor', current.childOnlyTax);
  money('election-regular', current.electionRegular);
  money('election-agi', current.electionAddedIncome);
  money('election-niit', current.electionNiit);
  money('threshold-room', thresholdRoom);
  document.getElementById('tax-floor-row').hidden = !current.kiddieRequired
    || current.childOnlyTax - current.parentTax - current.childRateTax < 0.005;

  let comparison = '';
  if (electionAvailable) {
    const difference = current.electionTax - current.separateTax;
    if (Math.abs(difference) < 0.005) comparison = 'Both filing options have the same estimated federal tax at the displayed precision.';
    else if (difference > 0) comparison = `A separate return is ${dollars.format(difference)} lower before any changes to credits or deductions.`;
    else comparison = `Form 8814 is ${dollars.format(-difference)} lower before any changes to credits or deductions.`;
  }
  write('comparison', comparison);

  let electionNote = electionReasons[current.electionReason] ?? '';
  if (current.electionAddedIncome > 0) {
    electionNote = `The election adds ${dollars.format(current.electionAddedIncome)} to parent AGI, which may reduce income-based credits or deductions.`;
    electionNote += current.electionNiit >= 0.005
      ? ` The modeled increase in the 3.8% net investment income tax is ${dollars.format(current.electionNiit)}.`
      : ' The entered MAGI and net investment income produce no additional NIIT at the displayed precision.';
  }
  write('election-note', electionNote);

  let saleNote = '';
  if (input.plannedGain > 0) {
    saleNote = `With the planned sale, estimated separate-return tax is ${dollars.format(projected.separateTax)}`;
    if (saleTaxChange >= 0.005) saleNote += `, up ${dollars.format(saleTaxChange)}.`;
    else if (saleTaxChange <= -0.005) saleNote += `, down ${dollars.format(-saleTaxChange)}.`;
    else saleNote += ', with no change at the displayed precision.';
    if (electionAvailable && projected.electionReason) saleNote += ' The sale makes Form 8814 unavailable.';
  }
  write('sale-note', saleNote);

  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('reset', () => queueMicrotask(update));
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
