import { calculateHiringCost } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('hiring-form');
const results = byId('results');
const error = byId('input-error');
const controls = Object.fromEntries([...form.elements].map(input => [input.id, input]));
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2,
});

const moneyOutputs = [
  'annualCost', 'monthlyCost', 'cashPay', 'teamPaybill', 'sacrificedPay',
  'teamSacrificedPay', 'employerPension', 'teamPension', 'employerNI',
  'totalTeamEmployerNI', 'allowancePerEmployee', 'allowanceCredit',
  'netEmployerNI', 'netTeamEmployerNI', 'levyPerEmployee', 'teamLevy',
  'annualTotal', 'teamAnnualCost', 'grossNISaving', 'netNISaving',
  'previousStandardNI', 'currentStandardNI', 'extraStandardNI',
];

function render() {
  const headcount = controls.headcount.valueAsNumber;
  const grossSalary = controls.grossSalary.valueAsNumber;
  const niCategory = controls.niCategory.value;
  const pensionParticipation = controls.pensionParticipation.value;
  const useSalarySacrifice = controls.useSalarySacrifice.checked;
  const showDirectorOption = headcount === 1 && controls.allowanceEligible.checked;
  const showAgeOption = pensionParticipation === 'auto' && niCategory !== 'under21';
  byId('director-option').hidden = !showDirectorOption;
  controls.soleDirector.disabled = !showDirectorOption;
  byId('age-option').hidden = !showAgeOption;
  controls.autoEnrolmentAge.disabled = !showAgeOption;
  controls.pensionRate.disabled = pensionParticipation === 'none';
  controls.pensionBasis.disabled = pensionParticipation === 'none';
  controls.salarySacrifice.disabled = !useSalarySacrifice;
  controls.salarySacrifice.max = controls.grossSalary.value;
  byId('sacrifice-field').hidden = !useSalarySacrifice;
  byId('sacrifice-note').hidden = !useSalarySacrifice;

  try {
    const invalid = [...form.elements].find(input => input.willValidate && !input.validity.valid);
    if (invalid) {
      const label = invalid.labels[0].textContent;
      throw new RangeError(`${label} — ${invalid.validationMessage}`);
    }

    const cost = calculateHiringCost({
      grossSalary,
      headcount,
      niCategory,
      allowanceEligible: controls.allowanceEligible.checked,
      soleDirector: showDirectorOption && controls.soleDirector.checked,
      pensionParticipation,
      autoEnrolmentAge: controls.autoEnrolmentAge.checked,
      pensionBasis: controls.pensionBasis.value,
      pensionRate: controls.pensionRate.disabled ? undefined : controls.pensionRate.valueAsNumber,
      includeLevy: controls.includeLevy.checked,
      useSalarySacrifice,
      salarySacrifice: controls.salarySacrifice.valueAsNumber,
    });
    const values = {
      ...cost,
      teamSacrificedPay: cost.sacrificedPay * headcount,
      teamPension: cost.employerPension * headcount,
      allowancePerEmployee: cost.allowanceCredit / headcount,
      annualTotal: cost.annualCost,
    };
    for (const id of moneyOutputs) byId(id).textContent = currency.format(values[id]);
    byId('overheadPercent').textContent = cost.overheadPercent === null
      ? 'N/A' : percent.format(cost.overheadPercent / 100);
    byId('sacrifice-row').hidden = !useSalarySacrifice;
    byId('sacrifice-summary').hidden = !useSalarySacrifice;
    const scenario = byId('scenario-note');
    scenario.textContent = showDirectorOption && controls.soleDirector.checked
      ? 'Employment Allowance is £0 because the sole employee is the only director.'
      : '';
    scenario.hidden = !scenario.textContent;
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
    byId('comparison-title').parentElement.hidden = false;
  } catch (failure) {
    if (!(failure instanceof RangeError)) throw failure;
    results.hidden = true;
    byId('comparison-title').parentElement.hidden = true;
    error.textContent = failure.message;
    error.hidden = false;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();
