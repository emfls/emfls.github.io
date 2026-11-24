import { calculateDeduction } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('tax-form');
const estimate = byId('estimate');
const payroll = byId('payroll');
const error = byId('input-error');
const warning = byId('payroll-warning');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fields = Array.from(form.querySelectorAll('input[type="number"]'));

function readNumber(id) {
  const input = byId(id);
  return input.value === '' ? undefined : input.valueAsNumber;
}

function writeAmounts(amounts) {
  for (const [id, amount] of Object.entries(amounts)) {
    byId(id).textContent = money.format(amount);
  }
}

function render() {
  const entity = byId('entity').value;
  const isCorp = entity === 'scorp';
  byId('se-fields').hidden = byId('se-fields').disabled = isCorp;
  byId('scorp-fields').hidden = byId('scorp-fields').disabled = !isCorp;
  byId('profit-label').textContent = entity === 'partner'
    ? 'Schedule K-1 box 14, code A net SE earnings ($)'
    : 'Schedule C net profit ($)';

  const invalid = fields.find(input => !input.matches(':disabled') && !input.validity.valid);
  if (invalid) {
    const label = invalid.labels[0].textContent;
    showError(`${label} — ${invalid.validationMessage}`);
    return;
  }

  const planEstablished = byId('planEstablished').checked;
  const box1Reported = byId('box1Reported').checked;
  const ficaExempt = byId('ficaExempt').checked;
  let result;
  try {
    result = calculateDeduction({
      entity,
      annualPremium: readNumber('annualPremium'),
      eligibleMonths: readNumber('eligibleMonths'),
      exactEligiblePremium: readNumber('exactEligiblePremium'),
      ltcPremium: readNumber('ltcPremium'),
      ltcAge: readNumber('ltcAge'),
      ltcEligibleMonths: readNumber('ltcEligibleMonths'),
      exactEligibleLtc: readNumber('exactEligibleLtc'),
      federalRate: readNumber('federalRate'),
      stateRate: readNumber('stateRate'),
      foreignHousingDeduction: readNumber('foreignHousingDeduction'),
      netProfit: readNumber('netProfit'),
      retirement: readNumber('retirement'),
      halfSETax: readNumber('halfSETax'),
      medicareWages: readNumber('medicareWages'),
      socialSecurityWages: readNumber(isCorp ? 'corpSocialSecurityWages' : 'seSocialSecurityWages'),
      planEstablished, box1Reported, ficaExempt
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    showError(problem.message);
    return;
  }

  error.hidden = true;
  warning.hidden = !isCorp || (planEstablished && box1Reported);
  warning.textContent = warning.hidden ? '' : planEstablished
    ? 'The entire Form 7206 deduction is disallowed as entered because the S corp omitted the premiums from Box 1. The blueprint below shows the amounts to review with payroll.'
    : 'The entire Form 7206 deduction is disallowed as entered because the S corp did not establish the plan and pay or reimburse the premiums.';

  byId('business-line-label').textContent = isCorp
    ? 'Medicare wages from this S corp (line 11)'
    : 'Business income after adjustments (line 10)';
  byId('half-se-row').hidden = isCorp;
  byId('reporting-row').hidden = result.reportingDisallowed === 0;
  writeAmounts({
    deduction: result.deduction,
    'business-line': result.line11 ?? result.line10,
    'half-se': result.halfSETax ?? 0,
    'earned-cap': result.earnedIncomeCap,
    'medical-allowed': result.line1,
    'ltc-allowed': result.line2,
    'medical-excluded': result.medicalExcluded,
    'ltc-excluded': result.ltcExcluded,
    'ltc-age-excess': result.ltcAgeExcess,
    'earned-excess': result.earnedIncomeExcess,
    'reporting-excess': result.reportingDisallowed,
    'federal-savings': result.federalSavings,
    'state-savings': result.stateSavings,
    'income-savings': result.incomeTaxSavings
  });

  payroll.hidden = result.payroll === null;
  if (result.payroll) {
    const boxes = result.payroll;
    writeAmounts({
      box1: boxes.box1Increase,
      box3: boxes.box3Increase,
      box5: boxes.box5Increase,
      box14a: boxes.box14aMemo,
      'fica-savings': boxes.regularFicaSavings,
      'additional-medicare': boxes.additionalMedicareWithholding
    });
  }
  estimate.hidden = false;
}

function showError(message) {
  estimate.hidden = true;
  payroll.hidden = true;
  warning.hidden = true;
  error.textContent = message;
  error.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
render();
