import { calculate, filingDates, isEligible } from './model.mjs';

const get = id => document.getElementById(id);
const form = get('calculator');
const results = get('results');
const inputError = get('input-error');
const deadline = get('deadline');
const years = [1, 2, 3, 4];
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const number = id => get(id).valueAsNumber;
const checked = id => get(id).checked;

function displayDate(date) {
  return dateFormat.format(new Date(date + 'T00:00:00Z'));
}

function renderDeadline(equityType) {
  const eligible = isEligible(equityType);
  get('eligibility').textContent = eligible
    ? 'Potentially eligible if the stock has transferred and remains subject to a substantial risk of forfeiture.'
    : equityType === 'iso'
      ? 'Ineligible for this comparison. Unexercised ISOs transfer no shares. Early-exercised ISO shares require separate AMT analysis.'
      : 'Ineligible for this comparison. Unexercised NSOs and RSUs do not transfer restricted shares at grant.';

  const dates = eligible ? filingDates(get('transfer-date').value) : null;
  get('date-error').hidden = !eligible || dates !== null;
  deadline.hidden = dates === null;
  if (!dates) return;

  get('due-date').dateTime = dates.deadline;
  get('due-date').textContent = displayDate(dates.deadline);
  get('day-30').textContent = dates.deadline === dates.day30
    ? 'Day 30 after the stock transfer.'
    : 'Day 30 is ' + displayDate(dates.day30) + '. The filing date rolls to the next eligible day.';
}

function money(id, amount) {
  get(id).textContent = currency.format(amount);
}

function timelineRow(label, elected, standard) {
  const row = document.createElement('tr');
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = label;
  row.append(heading);
  for (const amount of [elected, standard]) {
    const cell = row.insertCell();
    cell.className = 'amount';
    cell.textContent = currency.format(amount);
  }
  return row;
}

function renderResult(result) {
  const { withElection, withoutElection, vesting } = result;
  money('tax-saved', result.netExitTaxSaved);
  money('vest-tax-avoided', result.illiquidVestTimeCashTaxAvoided);
  money('upfront-risk', result.upfrontTaxAtRisk);
  money('forfeiture-tax', result.upfrontTaxAtRisk);
  money('forfeiture-loss', result.zeroRecoveryForfeitureLoss);
  money('zero-exit-elected', result.zeroExitVestedLossWithElection);
  money('zero-exit-standard', result.zeroExitVestedLossWithoutElection);
  get('comparison-note').textContent = Math.round(result.netExitTaxSaved * 100) === 0
    ? 'Both paths produce the same estimated tax through sale.'
    : result.netExitTaxSaved > 0
      ? 'The election lowers estimated total tax through sale under these assumptions.'
      : 'The election raises estimated total tax through sale under these assumptions.';

  get('timeline').replaceChildren(
    timelineRow('Transfer · Year 0', withElection.compensationTax, 0),
    ...vesting.map(lot => timelineRow(
      'Year ' + lot.year + ' vest · ' + lot.shares.toLocaleString('en-US') + ' shares',
      lot.electionTax, lot.compensationTax
    )),
    timelineRow('Sale tax, including any NIIT', withElection.saleTax, withoutElection.saleTax),
    timelineRow('Total tax through sale', withElection.totalTax, withoutElection.totalTax)
  );
  results.hidden = false;
}

function update() {
  const equityType = get('equity').value;
  inputError.hidden = true;
  renderDeadline(equityType);
  if (!isEligible(equityType)) {
    results.hidden = true;
    return;
  }

  let result;
  try {
    result = calculate({
      equityType,
      shares: number('shares'),
      pricePaid: number('price-paid'),
      transferFmv: number('transfer-fmv'),
      vestFmvs: years.map(year => number('vest-' + year)),
      exitPrice: number('exit-price'),
      incomeRate: number('income-rate'),
      ficaRate: number('fica-rate'),
      ltcgRate: Number(get('ltcg').value),
      niit: checked('niit'),
      transferLongTerm: checked('transfer-lt'),
      vestLongTerm: years.map(year => checked('vest-lt-' + year))
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    results.hidden = true;
    inputError.textContent = error.message;
    inputError.hidden = false;
    return;
  }
  renderResult(result);
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
