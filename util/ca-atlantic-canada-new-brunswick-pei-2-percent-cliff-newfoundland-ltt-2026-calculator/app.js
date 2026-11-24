import { calculateAtlantic, PEI_CLIFF, PEI_TARGET } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('atlantic-calculator');
const inputs = [...form.querySelectorAll('input[type="number"]')];
const results = byId('results');
const breakdown = byId('breakdown');
const error = byId('input-error');
const warning = byId('pei-warning');
const scenarioStatus = byId('pei-scenario-status');
const ranking = byId('ranking');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cad = value => money.format(value);

function renderRanking(rows) {
  ranking.replaceChildren(...rows.map(row => {
    const tr = document.createElement('tr');
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = row.name;
    tr.append(name);
    for (const value of [cad(row.tax), cad(row.fees), cad(row.total), percent.format(row.fractionOfPrice)]) {
      tr.insertCell().textContent = value;
    }
    return tr;
  }));
}

function render() {
  const invalid = inputs.filter(input => {
    const value = input.valueAsNumber;
    return !input.validity.valid || Number(value.toFixed(2)) !== value;
  });
  for (const input of inputs) {
    input.setAttribute('aria-invalid', String(invalid.includes(input)));
  }
  if (invalid.length) {
    const label = invalid[0].labels[0].textContent;
    error.textContent = `${label} needs an amount from ${cad(Number(invalid[0].min))} to ${cad(Number(invalid[0].max))}, with up to two decimal places.`;
    error.hidden = false;
    results.hidden = true;
    breakdown.hidden = true;
    warning.dataset.triggered = 'false';
    scenarioStatus.textContent = '';
    return;
  }

  const amounts = Object.fromEntries(inputs.map(input => [input.name, input.valueAsNumber]));
  const proposal = form.elements.peiRules.value === 'proposal';
  const firstTime = form.elements.buyerStatus.value === 'eligible';
  const { taxBase, nb, pei, nl, ranking: rows } = calculateAtlantic({ ...amounts, proposal, firstTime });
  const peiMode = proposal ? 'PEI budget proposal' : 'PEI published rules';
  const lowest = rows.filter(row => row.total === rows[0].total).map(row => row.name).join(' and ');
  const summary = `${peiMode}. NB and PEI taxable base: ${cad(taxBase)}. Lowest included cost: ${lowest} at ${cad(rows[0].total)}.`;

  warning.dataset.triggered = String(pei.cliffTriggered);
  if (!proposal) {
    scenarioStatus.textContent = 'Your estimate uses PEI’s published 2026 rules.';
  } else if (amounts.assessedValue >= PEI_CLIFF) {
    scenarioStatus.textContent = `Cliff triggered by the assessment. A ${cad(PEI_TARGET)} offer still results in ${cad(pei.targetTax)} of proposed PEI tax.`;
  } else if (pei.cliffTriggered) {
    const savings = Math.round((pei.tax - pei.targetTax) * 100) / 100;
    scenarioStatus.textContent = `Cliff triggered. At a ${cad(PEI_TARGET)} purchase price and the same assessment, proposed PEI tax falls from ${cad(pei.tax)} to ${cad(pei.targetTax)}, a ${cad(savings)} tax saving.`;
  } else {
    scenarioStatus.textContent = `Your taxable value of ${cad(taxBase)} is below the proposed cliff. At a ${cad(PEI_TARGET)} price and the same assessment, the proposed tax would be ${cad(pei.targetTax)}.`;
  }

  renderRanking(rows);
  for (const [id, value] of Object.entries({
    'pei-savings': pei.firstTimeSavings,
    'nb-deed': nb.deedFee,
    'nb-mortgage': nb.mortgageFee,
    'nl-deed': nl.deedFee,
    'nl-uncapped': nl.uncappedMortgageFee,
    'nl-mortgage': nl.mortgageFee,
    'nl-cap-savings': nl.capSavings,
  })) {
    byId(id).textContent = cad(value);
  }
  error.hidden = true;
  results.hidden = false;
  breakdown.hidden = false;
  byId('result-summary').textContent = summary;
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
