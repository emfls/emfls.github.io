import { calculatePayroll } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('payroll-form');
const error = byId('error');
const results = byId('results');
const announcement = byId('result-announcement');
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const signedCurrency = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', signDisplay: 'exceptZero',
});
const percentage = new Intl.NumberFormat('en-GB', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function readNumber(id) {
  const input = byId(id);
  if (!input.validity.valid) {
    input.setAttribute('aria-invalid', 'true');
    throw new RangeError(input.validity.stepMismatch && input.step === '1'
      ? 'Use a whole number for headcount.'
      : 'Enter valid amounts within the input limits. Salaries can have up to two decimal places.');
  }
  return input.valueAsNumber;
}

function readGroup(prefix) {
  const count = readNumber(`${prefix}-count`);
  return { count, salary: count === 0 ? 0 : readNumber(`${prefix}-salary`) };
}

function render(result) {
  const { salary, current, legacy, changeVsLegacy, hire } = result;
  const amounts = {
    payroll: salary,
    'gross-ni': current.grossNI,
    applied: current.allowanceApplied,
    'net-ni': current.netNI,
    'monthly-ni': current.monthlyNetNI,
    remaining: current.unusedAllowance,
    'payroll-cost': current.payrollCost,
    'legacy-gross': legacy.grossNI,
    'legacy-applied': legacy.allowanceApplied,
    'legacy-net': legacy.netNI,
  };
  byId('hire-results').hidden = hire === null;
  if (hire) {
    Object.assign(amounts, {
      'hire-gross': hire.grossNI,
      'hire-applied': hire.allowanceApplied,
      'hire-net': hire.netNI,
      'hire-payroll-cost': hire.marginalPayrollCost,
    });
    byId('hire-marginal').textContent = signedCurrency.format(hire.marginalNI);
    const qualification = byId('hire-qualification');
    qualification.hidden = !hire.unlocksAllowance;
    qualification.textContent = 'This hire clears the sole-director exclusion in the model, assuming all other eligibility rules are met.';
  }

  for (const [id, value] of Object.entries(amounts)) {
    byId(id).textContent = currency.format(value);
  }
  byId('legacy-change').textContent = signedCurrency.format(changeVsLegacy);
  byId('effective-rate').textContent = percentage.format(current.effectiveRate / 100);
  announcement.textContent = `Annual net employer NI ${currency.format(current.netNI)}.` +
    (hire ? ` Change in NI after hire ${signedCurrency.format(hire.marginalNI)}.` : '');
}

function update() {
  const eligibility = byId('eligibility').value;
  const soleDirector = eligibility === 'single_director_only';
  for (const id of ['standard-group', 'relief-group', 'director-count-field']) {
    byId(id).hidden = soleDirector;
  }
  byId('sole-note').hidden = !soleDirector;
  byId('legacy-field').hidden = eligibility !== 'eligible_multi_employee';
  byId('director-legend').textContent = soleDirector ? 'Sole director' : 'Senior staff and directors';
  byId('director-salary-label').textContent = soleDirector ? 'Annual pay (£)' : 'Average annual pay (£)';
  for (const input of form.querySelectorAll('[aria-invalid]')) {
    input.removeAttribute('aria-invalid');
  }

  const zeroGroup = { count: 0, salary: 0 };
  try {
    render(calculatePayroll({
      eligibility,
      standard: soleDirector ? zeroGroup : readGroup('standard'),
      directors: soleDirector ? { count: 1, salary: readNumber('director-salary') } : readGroup('director'),
      relief: soleDirector ? zeroGroup : readGroup('relief'),
      legacyBelowCap: byId('legacy-cap').checked,
      hireSalary: readNumber('hire-salary'),
    }));
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    results.hidden = true;
    announcement.textContent = '';
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
