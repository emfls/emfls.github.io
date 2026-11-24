import { compareNua } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('nua-calculator');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
const amount = (value) => money.format(Math.abs(value) < 0.005 ? 0 : value);
const numeric = (id) => byId(id).valueAsNumber;
const rate = (id) => numeric(id) / 100;
const set = (id, text) => { byId(id).textContent = text; };

function render() {
  const useLots = byId('use-lots').checked;
  byId('lots').disabled = !useLots;
  byId('lots').hidden = !useLots;
  const trigger = byId('trigger').value;
  let result;

  try {
    const invalid = Array.from(form.elements).find((field) => field.willValidate && !field.validity.valid);
    if (invalid) throw new RangeError(`${invalid.labels[0].textContent}: ${invalid.validationMessage}`);
    result = compareNua({
      marketValue: numeric('market-value'),
      costBasis: numeric('cost-basis'),
      currentOrdRate: rate('current-ordinary'),
      retirementOrdRate: rate('retirement-ordinary'),
      federalLtcgRate: Number(byId('federal-ltcg').value) / 100,
      stateCapRate: rate('state-gains'),
      age: numeric('age'),
      years: numeric('years'),
      growth: rate('growth'),
      dividendYield: rate('dividend'),
      niitApplies: byId('niit').checked,
      ruleOf55: byId('rule-of-55').checked,
      disability: byId('disability').checked,
      trigger,
      fullDistribution: byId('full-distribution').checked,
      lots: useLots ? { marketValue: numeric('lot-value'), costBasis: numeric('lot-basis') } : null,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    set('error', error.message);
    byId('error').hidden = false;
    byId('results').hidden = true;
    return;
  }

  byId('error').hidden = true;
  byId('results').hidden = false;
  const { immediate, horizon, projections } = result;
  set('eligibility', result.qualified
    ? 'Your entries satisfy the checklist. Confirm the timing and lot handling with your plan administrator.'
    : 'Qualification unconfirmed. The NUA figures below assume a qualifying distribution.');
  set('summary', horizon.winner === 'Tie'
    ? `Year ${horizon.year}: tied after taxes (to the nearest cent).`
    : `Year ${horizon.year}: ${horizon.winner} leads by ${amount(Math.abs(horizon.gap))} after taxes.`);
  set('basis-result', `${amount(result.nuaCostBasis)} (${percent.format(result.costBasisRatio)})`);
  set('spread-result', amount(result.nuaSpread));
  set('remaining-result', amount(result.iraRemainder));
  set('upfront-result', `${amount(result.upfrontTax)} (${amount(result.upfrontIncomeTax)} ordinary tax, ${amount(result.upfrontPenalty)} early tax)`);
  set('immediate-nua', amount(immediate.nuaNet));
  set('immediate-ira', amount(immediate.iraNet));
  set('horizon-nua', amount(horizon.nuaNet));
  set('horizon-ira', amount(horizon.iraNet));
  set('realized-result', amount(horizon.realizedNua));
  set('gain-result', amount(horizon.postDistributionGain));
  set('niit-result', amount(horizon.niitAvoided));

  const changes = projections.filter((row, index) => index > 0 && row.winner !== projections[index - 1].winner);
  set('break-even', changes.length
    ? changes.map((row) => `Year ${row.year}: ${row.winner}`).join(' · ')
    : `No change in the lead in years 0–20 (${immediate.winner.toLowerCase()}).`);

  const rows = projections.map((row) => {
    const element = document.createElement('tr');
    const yearCell = document.createElement('th');
    yearCell.scope = 'row';
    yearCell.textContent = row.year;
    element.append(yearCell);
    for (const value of [row.nuaNet, row.iraNet, row.gap]) {
      const cell = document.createElement('td');
      cell.textContent = amount(value);
      element.append(cell);
    }
    return element;
  });
  byId('yearly-results').replaceChildren(...rows);
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
