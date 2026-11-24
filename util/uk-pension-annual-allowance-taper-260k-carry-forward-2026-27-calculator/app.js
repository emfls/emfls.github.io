import { calculatePension, PRIOR_YEARS, MPAA } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('pension-calculator');
const results = get('results');
const error = get('input-error');
const currency = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});
const money = amount => amount === null ? 'No qualifying amount' : currency.format(amount);
const fields = {
  incomeBeforeNetPay: 'income',
  relevantEarnings: 'earnings',
  reliefAtSource: 'ras',
  netPay: 'net-pay',
  employer: 'employer',
  salarySacrifice: 'sacrifice',
  definedBenefit: 'db'
};
const years = PRIOR_YEARS.map(year => {
  const start = year.slice(0, 4);
  return {
    year,
    member: get(`year-${start}`).querySelector('.member'),
    allowance: get(`allowance-${start}`),
    used: get(`used-${start}`)
  };
});

function update() {
  const mpaa = get('mpaa').checked;
  get('access-details').hidden = !mpaa;
  get('pre-access').disabled = !mpaa;
  for (const { member, allowance, used } of years) {
    allowance.disabled = used.disabled = !member.checked;
  }

  const invalid = [...form.querySelectorAll('input[type="number"]')].filter(
    input => !input.disabled && !input.validity.valid
  );
  for (const input of form.querySelectorAll('input[type="number"]')) {
    if (invalid.includes(input)) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  let result;
  try {
    if (invalid.length) throw new RangeError('Enter amounts within the field limits, with up to two decimal places.');
    result = calculatePension({
      ...Object.fromEntries(Object.entries(fields).map(([key, id]) => [key, get(id).valueAsNumber])),
      mpaa,
      beforeAccess: get('pre-access').valueAsNumber,
      prior: years.map(({ year, member, allowance, used }) => ({
        year, member: member.checked, allowance: allowance.valueAsNumber, used: used.valueAsNumber
      }))
    });
  } catch (problem) {
    results.hidden = true;
    get('announcement').textContent = '';
    error.hidden = false;
    error.textContent = problem.message;
    return;
  }

  error.hidden = true;
  error.textContent = '';
  const metrics = [
    ['Maximum contribution with relief and no allowance charge', result.maximumTaxRelievedContribution],
    ['Estimated annual allowance charge at 45%', result.estimatedCharge],
    ['2026/27 annual allowance before any MPAA test', result.annualAllowance],
    ['Eligible prior-year balance before this plan', result.carryForwardAvailable],
    ['Threshold income', result.thresholdIncome],
    ['Adjusted income', result.adjustedIncome],
    ['Total pension input, including any defined-benefit accrual', result.totalPensionInput],
    ['Annual allowance excess', result.annualAllowanceExcess],
    ['Personal tax-relief limit before annual allowance', result.personalReliefCap],
    ['Personal contributions above the relief limit', result.personalReliefExcess],
    ['Maximum personal contribution with relief and no allowance charge', result.maximumPersonalContribution]
  ];
  if (mpaa) metrics.push(['Post-access defined-contribution limit (MPAA)', MPAA],
    ['Post-access excess', result.mpaaExcess]);

  get('metrics').replaceChildren(...metrics.map(([label, amount]) => {
    const tile = document.createElement('div');
    const term = document.createElement('dt');
    const value = document.createElement('dd');
    term.textContent = label;
    value.textContent = money(amount);
    tile.append(term, value);
    return tile;
  }));

  get('result-note').textContent = result.maximumTaxRelievedContribution === null
    ? 'Changing relief-at-source payments alone cannot bring the fixed inputs within both limits.'
    : '';

  const rows = [
    ['2026/27', money(result.currentUsed), '—'],
    ...result.carryForward.map(({ year, used, remaining }) => [year, money(used), money(remaining)])
  ];
  get('allocation').replaceChildren(...rows.map(([year, used, remaining]) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = year;
    row.append(heading);
    row.insertCell().textContent = used;
    row.insertCell().textContent = remaining;
    return row;
  }));

  get('expiry').textContent = result.expiringAllowance > 0
    ? `${money(result.expiringAllowance)} of eligible 2023/24 allowance remains unused under this plan. Any balance still unused at the end of 5 April 2027 is lost.`
    : 'No eligible 2023/24 allowance remains unused under this plan.';
  results.hidden = false;
  get('announcement').textContent = `Estimated annual allowance charge ${money(result.estimatedCharge)}. Expiring balance ${money(result.expiringAllowance)}.`;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
