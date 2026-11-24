import { estimateCapacity, compareWithdrawal, projectEquity } from './model.mjs';

const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const milestones = [5, 10, 15, 20];
const get = id => document.getElementById(id);
const money = value => currency.format(value);
const number = id => get(id).valueAsNumber;
const set = (id, value) => { get(id).textContent = value; };

const form = get('calculator');
const results = get('summary');
const projectionResults = get('projection-results');
const projectionAssumptions = get('projection-status').textContent;
const equityWarning = get('equity-warning').textContent;

function renderProjection(rows) {
  for (const year of milestones) set(`equity-${year}`, money(rows[year].netEquity));

  const crossover = rows.find(row => row.potentialNneg > 0);
  set('nneg', crossover
    ? `The loan first exceeds the projected home value at year ${crossover.year}. The gap is ${money(crossover.potentialNneg)} then, and could be covered if the lender’s guarantee applies at repayment.`
    : 'The loan balance stays within the projected home value at each modeled year.');
  set('equity-warning', `By year 15, interest adds ${money(rows[15].interest)} to the loan and leaves ${money(rows[15].netEquity)} in projected home equity before selling costs.`);

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (milestones.includes(row.year)) tr.className = 'milestone';
    if (row.potentialNneg > 0) tr.classList.add('shortfall');
    const year = document.createElement('th');
    year.scope = 'row';
    year.textContent = row.year;
    tr.append(year);
    for (const amount of [row.homeValue, row.balance, row.netEquity, row.potentialNneg]) {
      const cell = document.createElement('td');
      cell.textContent = money(amount);
      tr.append(cell);
    }
    fragment.append(tr);
  }
  get('projection-rows').replaceChildren(fragment);
  set('projection-status', projectionAssumptions);
  projectionResults.hidden = false;
}

function render() {
  const invalid = form.querySelector(':invalid:is(input, select)');
  if (invalid) {
    set('error', `${invalid.labels[0].textContent}. ${invalid.validationMessage}`);
    results.hidden = true;
    projectionResults.hidden = true;
    set('projection-status', 'Correct the input above to update the projection.');
    set('equity-warning', equityWarning);
    return;
  }

  const homeValue = number('homeValue');
  const requestedCash = get('requestedCash').value === '' ? null : number('requestedCash');
  const capacity = estimateCapacity({
    age: number('age'),
    property: get('property').value,
    market: get('market').value,
    homeValue,
    payoff: number('payoff'),
    costs: number('costs'),
    requestedCash,
  });
  const withdrawal = compareWithdrawal({
    targetCash: capacity.cashDraw,
    income: number('income'),
    taxRate: number('taxRate') / 100,
    annualOas: number('annualOas'),
    annualGis: number('annualGis'),
    gisRate: Number(get('gisRate').value),
  });

  let status = 'Illustrative estimate for a Canadian primary residence.';
  if (!capacity.ageEligible) {
    status = 'The youngest borrower must be at least 55 for this estimate.';
  } else if (capacity.fundingShortfall > 0) {
    status = `The modeled loan is ${money(capacity.fundingShortfall)} short of paying off existing secured debt and closing costs.`;
  } else if (requestedCash !== null && requestedCash > capacity.netCash) {
    status = 'The selected cash draw was limited to the maximum available.';
  } else if (capacity.netCash === 0) {
    status = 'The modeled loan leaves no cash after paying existing secured debt and closing costs.';
  }

  set('error', '');
  results.hidden = false;
  set('scenario-status', status);
  set('gross', money(capacity.gross));
  set('ltv', `${percent.format(capacity.ltv)} modeled LTV`);
  set('net-cash', money(capacity.netCash));
  set('cash-draw', money(capacity.cashDraw));
  set('opening-balance', capacity.openingBalance === null ? 'No opening loan' : `${money(capacity.openingBalance)} opening balance`);
  set('gross-withdrawal', money(withdrawal.gross));
  set('tax-oas', money(withdrawal.taxAndOas));
  set('gis-loss', money(withdrawal.gisLoss));
  set('tax-breakdown', `Extra withdrawal: ${money(withdrawal.incomeTax)} income tax + ${money(withdrawal.oasRecovery)} OAS recovery + ${money(withdrawal.gisLoss)} GIS loss. Reverse mortgage proceeds: $0 in all three.`);
  get('tax-breakdown').hidden = capacity.cashDraw === 0;

  if (capacity.openingBalance === null) {
    projectionResults.hidden = true;
    set('projection-status', 'An opening reverse mortgage balance is needed to project equity.');
    set('equity-warning', equityWarning);
    return;
  }

  renderProjection(projectEquity({
    homeValue,
    openingBalance: capacity.openingBalance,
    loanRate: number('loanRate') / 100,
    appreciation: number('appreciation') / 100,
  }));
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
