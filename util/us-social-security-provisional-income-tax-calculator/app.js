import { compareWithdrawals } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('tax-form');
const error = byId('input-error');
const results = byId('results');
const numericFields = [...form.querySelectorAll('input[type="number"]')];
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percentages = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const money = value => dollars.format(Math.abs(value) < 0.005 ? 0 : value);
const percent = value => percentages.format(value);

function showWithdrawal(prefix, scenario) {
  byId(`${prefix}-benefits`).textContent = money(scenario.additionalTaxableSS);
  byId(`${prefix}-lost`).textContent = money(scenario.seniorBonusLost);
  byId(`${prefix}-tax`).textContent = money(scenario.extraTax);
  byId(`${prefix}-rate`).textContent = percent(scenario.rate);
  byId(`${prefix}-cash`).textContent = money(scenario.afterTaxCash);
}

function update() {
  const status = byId('filing').value;
  const deductionMethod = byId('deductions').value;
  const joint = status === 'mfj';
  const separate = status === 'mfsApart' || status === 'mfsTogether';
  const itemized = deductionMethod === 'itemized';
  byId('spouse-field').hidden = !joint;
  byId('spouse-age').disabled = !joint;
  byId('spouse-ssn').disabled = !joint;
  byId('ssn-field').hidden = separate;
  byId('ssn').disabled = separate;
  byId('itemized-field').hidden = !itemized;
  byId('itemized').disabled = !itemized;

  for (const field of numericFields) field.removeAttribute('aria-invalid');
  const invalid = numericFields.find(field => !field.disabled && !field.validity.valid);
  if (invalid) {
    invalid.setAttribute('aria-invalid', 'true');
    const label = invalid.labels[0].textContent;
    error.textContent = invalid.step === '1'
      ? `${label} must be a whole number from 0 to 120.`
      : `${label} must be from ${money(Number(invalid.min))} to ${money(Number(invalid.max))}, with up to two decimal places.`;
    results.hidden = true;
    return;
  }

  const { baseline, traditional, roth } = compareWithdrawals({
    status,
    deductionMethod,
    benefits: byId('benefits').valueAsNumber,
    otherAgi: byId('other-agi').valueAsNumber,
    taxExemptInterest: byId('tax-exempt').valueAsNumber,
    age: byId('age').valueAsNumber,
    spouseAge: byId('spouse-age').valueAsNumber,
    validSsn: byId('ssn').checked,
    spouseValidSsn: byId('spouse-ssn').checked,
    itemizedDeduction: byId('itemized').valueAsNumber,
  });

  error.textContent = '';
  byId('base-deduction-label').textContent = itemized ? 'Itemized deductions' : 'Standard deduction';
  byId('out-provisional').textContent = money(baseline.provisionalIncome);
  byId('out-benefits').textContent = money(baseline.taxableSS);
  byId('out-share').textContent = percent(baseline.taxableBenefitShare);
  byId('out-bonus').textContent = money(baseline.seniorBonus);
  byId('out-savings').textContent = money(baseline.bonusTaxSavings);
  byId('out-tax').textContent = money(baseline.federalIncomeTax);
  byId('out-magi').textContent = money(baseline.magi);
  byId('out-base').textContent = money(baseline.baseDeduction);
  byId('out-before').textContent = money(baseline.taxableIncomeBeforeBonus);
  byId('out-used').textContent = money(baseline.bonusUsed);
  byId('out-after').textContent = money(baseline.taxableIncome);
  byId('out-bracket').textContent = percent(baseline.nominalBracket);
  byId('eligibility').textContent = separate
    ? 'Married filing separately is ineligible for the Schedule 1-A senior deduction.'
    : `Eligible seniors before the income phaseout: ${baseline.eligibleSeniors}.`;
  showWithdrawal('trad', traditional);
  showWithdrawal('roth', roth);
  byId('withdrawal-warning').textContent = traditional.extraTax >= 0.005
    ? `At these inputs, a $1,000 traditional IRA withdrawal costs ${money(traditional.extraTax)} more in federal income tax than a qualified Roth IRA withdrawal. You keep ${money(traditional.afterTaxCash)} after federal tax.`
    : 'At these inputs, either $1,000 withdrawal adds $0.00 in estimated federal income tax.';
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
