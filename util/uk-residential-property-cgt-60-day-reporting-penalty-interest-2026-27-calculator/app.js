import { calculate } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('cgt-form');
const results = byId('results');
const error = byId('form-error');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const dates = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
});
const percent = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(date) {
  return dates.format(new Date(date + 'T00:00:00Z'));
}

function render() {
  let estimate;
  try {
    estimate = calculate({
      disposalDate: byId('disposalDate').value,
      completionDate: byId('completionDate').value,
      filingDate: byId('filingDate').value,
      paymentDate: byId('paymentDate').value,
      gain: byId('gain').valueAsNumber,
      taxableIncome: byId('taxableIncome').valueAsNumber,
      exemption: byId('exemption').valueAsNumber,
      residency: byId('residency').value,
      baseRate: byId('baseRate').valueAsNumber,
      paymentMode: byId('paymentMode').value,
      filingMode: byId('filingMode').value,
      dailyPenalties: byId('dailyPenalties').checked
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
    return;
  }

  const { filing, payment, interestRate, filingRequired } = estimate;
  for (const name of ['extraCost', 'cgtDue', 'interest']) {
    byId(name).textContent = money.format(estimate[name]);
  }
  byId('filingTotal').textContent = money.format(filing.total);
  byId('paymentTotal').textContent = money.format(payment.total);
  byId('deadline').textContent = '60-day property deadline · ' + formatDate(estimate.deadline);
  const filingTiming = filingRequired ? 'Filing days late ' + estimate.filingDaysLate :
    'Property filing not required on these inputs';
  byId('timing').textContent = filingTiming + ' · Payment days past deadline ' +
    estimate.paymentDaysLate + ' · Annual interest rate ' + percent.format(interestRate) + '%';
  byId('tax-breakdown').textContent = 'Gain taxed at 18% ' + money.format(estimate.basicGain) +
    ' · Gain taxed at 24% ' + money.format(estimate.higherGain);
  byId('filing-breakdown').textContent = 'Initial filing charge ' + money.format(filing.initial) +
    ' · Daily charges (' + filing.dailyDays + ' days) ' + money.format(filing.daily) +
    ' · Six-month charge ' + money.format(filing.sixMonth) +
    ' · Twelve-month charge ' + money.format(filing.twelveMonth);
  const paymentTiers = payment.dates.map((date, index) =>
    formatDate(date) + ' (' + money.format(payment.amounts[index]) + ')'
  );
  byId('payment-breakdown').textContent = 'Payment penalty triggers and amounts · ' + paymentTiers.join(' · ');
  byId('saving').textContent = 'Waiting another 30 days from the dates you entered could add ' +
    money.format(estimate.next30DaysFiling) + ' in filing penalties and ' +
    money.format(estimate.next30DaysInterest) + ' in interest.';
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
