import { calculate, LIMITS } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('inputs');
const numbers = Array.from(form.querySelectorAll('input[type="number"]'));
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2,
});
const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const money = (value) => currency.format(value);
const dollars = (value) => wholeDollars.format(value);
const showText = (id, text) => { byId(id).textContent = text; };

function render() {
  const coverage = byId('coverage').value;
  const filing = byId('filing').value;
  byId('spouse-field').hidden = coverage !== 'family';
  byId('joint-field').hidden = filing !== 'joint';
  byId('spouseWages').disabled = filing !== 'joint';

  const invalid = numbers.find((field) => !field.disabled && !field.validity.valid);
  byId('error').hidden = !invalid;
  byId('results').hidden = Boolean(invalid);
  if (invalid) {
    showText('error', invalid.labels[0].textContent + '. ' + invalid.validationMessage);
    return;
  }

  const input = Object.fromEntries(numbers.map((field) => [field.id, field.disabled ? 0 : field.valueAsNumber]));
  for (const field of form.querySelectorAll('select')) input[field.id] = field.value;
  for (const field of form.querySelectorAll('input[type="checkbox"]')) input[field.id] = field.checked;
  for (const key of ['federalRate', 'stateRate', 'retirementFederal', 'retirementState',
    'totalReturn', 'yieldRate', 'dividendRate', 'gainRate']) {
    input[key] /= 100;
  }

  const result = calculate(input);
  const { hsa, hsaFund, fica } = result;
  showText('limit', dollars(result.householdLimit));
  showText('available', money(result.available));
  showText('remaining', money(result.remaining));
  showText('election', money(result.election));
  showText('upfront', money(result.upfront));
  showText('fica', money(fica.socialSecurity + fica.medicare + fica.additionalMedicare));
  showText('tax-breakdown', [
    'Federal ' + money(result.federalSavings),
    'State ' + money(result.stateSavings),
    'Social Security ' + money(fica.socialSecurity),
    'Medicare ' + money(fica.medicare),
    'Additional Medicare ' + money(fica.additionalMedicare),
  ].join(' · '));

  const limits = LIMITS[coverage];
  if (input.specialPlan) {
    showText('qualification', 'HDHP check: PASS via the selected bronze or catastrophic plan provision.');
  } else {
    showText('qualification', 'HDHP check: ' + (result.statutoryPass ? 'PASS' : 'FAIL')
      + '. The deductible must be at least ' + dollars(limits.deductible)
      + ' and the out-of-pocket limit must be at least the deductible and no more than '
      + dollars(limits.outOfPocket) + '. Only exempt benefits may be paid before the minimum deductible.');
  }
  const notes = [];
  if (!input.eligible) notes.push('You marked yourself as ineligible for the full-year calculation.');
  if (result.spouseRoom) notes.push(dollars(result.spouseRoom) + ' of the household limit belongs in your spouse’s own HSA.');
  if (result.employerExcess) notes.push('Employer deposits are ' + money(result.employerExcess) + ' above the modeled limit.');
  if (result.election < input.planned) notes.push('The estimate reduced your planned contribution to fit available room and, for payroll funding, wages.');
  if (result.gross < result.election) notes.push('The paycheck comparison is capped at your wages.');
  byId('limit-note').hidden = notes.length === 0;
  showText('limit-note', notes.join(' '));

  showText('budget', input.years + '-year projection ending at age ' + result.ageAtExit
    + ', using ' + money(result.gross) + ' of gross pay per year in every scenario.');
  showText('hsa-label', input.funding === 'payroll' ? 'Payroll HSA (shoebox)' : 'Direct HSA (shoebox)');
  for (const id of ['hsaDeposit', 'pretaxDeposit', 'rothDeposit', 'afterTaxDeposit']) {
    showText(id, money(result[id]));
  }
  for (const [account, balance] of Object.entries(result.afterTax)) showText(account, dollars(balance));
  showText('reimbursement', 'Projected HSA balance before final taxes: ' + dollars(hsaFund.balance)
    + '. Your ' + dollars(result.receipts) + ' of receipts cover ' + dollars(hsa.qualified)
    + ' in federally tax-free reimbursements. If receipts cover the entire balance, you keep '
    + dollars(result.fullyQualifiedHsa) + ' after modeled state investment taxes.');
  showText('hsa-tax', 'Non-medical withdrawal: ' + dollars(hsa.nonMedical)
    + '. Estimated ordinary income tax: ' + dollars(hsa.incomeTax)
    + '. Additional federal tax before age 65: ' + dollars(hsa.penalty) + '.');

  byId('roth-note').hidden = result.rothDeposit === result.afterTaxDeposit;
  showText('roth-note', 'The Roth scenario includes ' + money(result.afterTaxDeposit - result.rothDeposit)
    + ' a year invested in a taxable brokerage account, worth ' + dollars(result.rothOverflow) + ' after tax.');

  byId('state-warning').hidden = !result.nonconforming;
  showText('state-warning', (input.state === 'ca' ? 'California' : 'New Jersey')
    + ' non-conformity. The modeled 2026 election gives up ' + money(result.stateUpfrontCost)
    + ' in upfront state income tax savings. Estimated state taxes on HSA distributions from investments and realized gains total '
    + dollars(result.stateInvestmentTaxes) + '. The projected after-tax HSA value is '
    + dollars(Math.abs(result.stateNetCost)) + (result.stateNetCost < 0 ? ' higher' : ' lower')
    + ' than under state conformity at the same tax rates.');
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
