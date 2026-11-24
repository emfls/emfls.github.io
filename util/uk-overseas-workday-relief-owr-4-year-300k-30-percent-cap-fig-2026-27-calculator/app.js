import { calculateOWR } from './model.mjs';

const form = document.querySelector('#owr-form');
const error = document.querySelector('#owr-error');
const results = document.querySelector('#owr-results');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const reasons = {
  NONE: 'Workday apportionment',
  '30_PERCENT_CAP': '30% income cap',
  '300K_CAP': '£300,000 ceiling',
};
const fields = ['allowance', 'exemption', 'taxableIncome', 'incomeTaxDue', 'cgtDue', 'totalTax'];

function show(id, text) {
  document.getElementById(id).textContent = text;
}

function formatAmount(amount) {
  return amount === null ? '—' : money.format(amount);
}

function render() {
  const number = (name) => form.elements.namedItem(name).valueAsNumber;
  const eligible = form.elements.eligible.value === 'yes';
  const totalWorkdays = number('totalWorkdays');
  const overseasWorkdays = number('overseasWorkdays');

  try {
    const result = calculateOWR({
      qualifyingEmploymentIncome: number('qualifyingEmploymentIncome'),
      otherIncome: number('otherIncome'),
      ukGains: number('ukGains'),
      totalWorkdays,
      overseasWorkdays,
      eligible,
    });

    show('verdict', result.verdict);
    show('net-savings', formatAmount(result.netTaxSavings));
    show('four-year', formatAmount(result.fourYearSavings));
    show('verdict-detail', !eligible ? 'The new-regime election is unavailable under the eligibility selected.'
      : result.netTaxSavings > 0 ? 'Electing reduces the estimated combined tax.'
      : result.netTaxSavings < 0 ? 'Electing increases the estimated combined tax.'
      : 'Both scenarios have the same estimated combined tax.');
    show('overseas-share', percent.format(overseasWorkdays / totalWorkdays));
    show('raw-earnings', formatAmount(result.rawOverseasEarnings));
    show('cap', formatAmount(result.statutoryCap));
    show('claimable', formatAmount(result.claimableOWR));
    show('cap-reason', eligible ? reasons[result.capBindingReason] : 'Election unavailable');

    const days = result.minimumOverseasWorkdays;
    show('breakeven', !eligible ? 'Election unavailable.'
      : days === null ? 'No workday split produces a tax saving within the annual cap.'
      : `At least ${days} of ${totalWorkdays} workdays overseas to save tax (${percent.format(days / totalWorkdays)}).`);

    for (const field of fields) {
      show(`standard-${field}`, formatAmount(result.noElection[field]));
      show(`election-${field}`, formatAmount(result.election?.[field] ?? null));
    }

    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
  }
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();
