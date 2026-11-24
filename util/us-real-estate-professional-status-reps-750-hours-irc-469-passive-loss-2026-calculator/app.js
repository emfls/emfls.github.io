import { calculateReps } from './model.mjs';

const form = document.getElementById('reps-form');
const error = document.getElementById('reps-error');
const result = document.getElementById('reps-result');
const comparison = document.getElementById('comparison');
const fields = form.elements;
const spouseFields = form.querySelectorAll('[data-spouse]');
const stayField = document.getElementById('stay-field');
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const hours = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function write(id, value) {
  document.getElementById(id).textContent = value;
}

function readInputs() {
  return Object.fromEntries([...fields].filter(field => field.name && !field.disabled).map(field => {
    if (field.type === 'number') {
      if (!field.validity.valid) {
        throw new RangeError(`Check ${field.labels[0].textContent.toLowerCase()} and enter a value within the field's allowed range.`);
      }
      return [field.name, field.valueAsNumber];
    }
    return [field.name, field.type === 'checkbox' ? field.checked : field.value];
  }));
}

function describeEligibility(output) {
  const { qualifyingPerson, materiallyParticipated, combinedActivityHours, shortStay } = output;
  const reps = qualifyingPerson === 'primary' ? 'You meet both REPS hour tests.'
    : qualifyingPerson === 'spouse' ? 'Your spouse meets both REPS hour tests.'
      : 'Neither set of entered hours meets both REPS hour tests.';
  const participation = materiallyParticipated
    ? 'The entered facts meet a material-participation test.'
    : 'The entered facts do not meet a material-participation test.';
  const shortStayNote = shortStay ? ' The 7-day exception applies, so this activity has no special rental allowance.' : '';
  return `${reps} ${participation} Activity hours: ${hours.format(combinedActivityHours)}.${shortStayNote}`;
}

function describeGap(label, gap) {
  return gap === 0 ? `${label} meets both hour tests.`
    : `${label} needs ${hours.format(gap)} additional qualifying hours if other hours stay the same.`;
}

function render(output) {
  const headings = {
    QUALIFIED_REPS: 'Nonpassive rental loss through REPS',
    STR_LOOPHOLE_QUALIFIED: 'Nonpassive loss under the 7-day exception',
    PASSIVE_SUSPENDED: 'Passive activity loss rules apply',
  };
  write('result-heading', headings[output.status]);
  write('status-code', output.status);
  write('eligibility', describeEligibility(output));
  const primaryGap = describeGap('Taxpayer', output.primaryHoursGap);
  const spouseGap = output.spouseHoursGap === null ? '' : ` ${describeGap('Spouse', output.spouseHoursGap)}`;
  write('hours-gap', primaryGap + spouseGap);

  const { selected, passiveRental, nonpassive } = output;
  const amounts = {
    'wage-offset': selected.wageOffset,
    deduction: selected.currentDeduction,
    'passive-carry': selected.suspendedPassiveLoss,
    'excess-loss': selected.excessBusinessLoss,
    'tax-total': selected.totalSavings,
    'tax-federal': selected.federalSavings,
    'tax-niit': selected.niitSavings,
    'tax-state': selected.stateSavings,
    'passive-deduction': passiveRental.currentDeduction,
    'nonpassive-deduction': nonpassive.currentDeduction,
    'passive-comparison-carry': passiveRental.suspendedPassiveLoss,
    'nonpassive-comparison-carry': nonpassive.suspendedPassiveLoss,
    'passive-comparison-ebl': passiveRental.excessBusinessLoss,
    'nonpassive-comparison-ebl': nonpassive.excessBusinessLoss,
    'passive-comparison-tax': passiveRental.totalSavings,
    'nonpassive-comparison-tax': nonpassive.totalSavings,
  };
  for (const [id, amount] of Object.entries(amounts)) write(id, dollars.format(amount));
}

function update() {
  const isJoint = fields.filingStatus.value === 'joint';
  const hasAverageStay = fields.scope.value === 'singleActivity';
  for (const field of spouseFields) {
    field.hidden = !isJoint;
    field.querySelector('input').disabled = !isJoint;
  }
  stayField.hidden = !hasAverageStay;
  fields.averageStay.disabled = !hasAverageStay;

  try {
    render(calculateReps(readInputs()));
    error.textContent = '';
    result.hidden = false;
    comparison.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    result.hidden = true;
    comparison.hidden = true;
    error.textContent = problem.message;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
