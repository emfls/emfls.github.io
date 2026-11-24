import { calculateEarningsTest, checkMonthlySafeHarbor } from './model.mjs';

const byId = (id) => document.getElementById(id);
const number = (id) => byId(id).valueAsNumber;
const selectNumber = (id) => Number(byId(id).value);
const form = byId('ret-form');
const output = byId('ret-results');
const error = byId('form-error');
const monthlyOutput = byId('monthly-result');
const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const yearsFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const money = (value) => value > 0 && value < 0.005 ? 'Less than $0.01' : moneyFormatter.format(value);

function showField(id, visible) {
  const field = byId(id);
  field.hidden = !visible;
  field.querySelector('input').disabled = !visible;
}

function showAnnualEstimate(inputs) {
  try {
    const result = calculateEarningsTest({
      ...inputs,
      monthlyBenefit: number('monthly-benefit'),
      pia: number('pia'),
      monthsClaimedEarly: number('months-early'),
      earnedIncome: number('annual-earnings'),
      preFraEarnedIncome: number('pre-fra-earnings')
    });
    byId('actual-withheld').textContent = money(result.actualWithheld);
    byId('skipped-checks').textContent = result.fullMonthsWithheld;
    byId('gross-withheld').textContent = money(result.grossWithheld);
    byId('excess-withheld').textContent = money(result.excessWithheld);
    byId('monthly-boost').textContent = money(result.monthlyBoost);
    byId('break-even').textContent = result.breakEvenYears === null
      ? 'Not applicable'
      : result.breakEvenYears < 0.005 ? 'Less than 0.01 years' : `${yearsFormatter.format(result.breakEvenYears)} years`;
    byId('cash-summary').textContent =
      `Estimated 2026 cash before reconciliation is ${money(result.cashPayable)} out of ${money(result.scheduledBenefits)} in scheduled benefits.`;

    const credit = byId('credit-summary');
    credit.hidden = result.adjustedBenefit === null;
    if (!credit.hidden) {
      const monthLabel = result.creditMonths === 1 ? 'month' : 'months';
      credit.textContent = `Estimated 2026 credit of ${result.creditMonths} ${monthLabel}. ` +
        `The PIA-based monthly benefit goes from ${money(result.baselineBenefit)} to ${money(result.adjustedBenefit)} with this credit.`;
    }

    output.hidden = false;
    error.hidden = true;
    error.textContent = '';
  } catch (err) {
    if (!(err instanceof RangeError)) throw err;
    output.hidden = true;
    error.textContent = err.message;
    error.hidden = false;
  }
}

function showMonthlyEstimate(inputs) {
  try {
    const { status, monthlyLimit } = checkMonthlySafeHarbor({
      ...inputs,
      month: selectNumber('check-month'),
      wages: number('monthly-wages'),
      substantialServices: byId('services').checked
    });
    const messages = {
      protected: `This month qualifies for a full check if the special rule applies. Wages are at or below ${money(monthlyLimit)} and you reported no substantial self-employment services.`,
      over_limit: `This month does not qualify for monthly protection because wages exceed ${money(monthlyLimit)}.`,
      substantial_services: 'This month does not qualify for monthly protection because you reported substantial self-employment services.',
      not_entitled: 'This month is before your first month of benefit entitlement in 2026.',
      exempt: 'This month is at or after FRA, when the earnings test no longer applies.'
    };
    monthlyOutput.textContent = messages[status];
  } catch (err) {
    if (!(err instanceof RangeError)) throw err;
    monthlyOutput.textContent = err.message;
  }
}

function render() {
  const mode = byId('mode').value;
  const reachesFra = mode === 'reaching_fra_this_year';
  const atFra = mode === 'at_or_above_fra';
  showField('annual-field', mode === 'under_fra_all_year');
  showField('pre-fra-months-field', reachesFra);
  showField('pre-fra-earnings-field', reachesFra);
  showField('pia-field', !atFra);
  showField('early-field', !atFra);

  const inputs = {
    mode,
    preFraMonths: number('pre-fra-months'),
    benefitStartMonth: selectNumber('benefit-start')
  };
  showAnnualEstimate(inputs);

  const checkMonthly = byId('monthly-toggle').checked;
  byId('monthly-check').hidden = !checkMonthly;
  if (checkMonthly) showMonthlyEstimate(inputs);
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();
