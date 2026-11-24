import { calculateDeathTaxes, MAX_ESTATE, relationshipMatrix } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('tax-form');
const { estate, outside, relationship, earlyPayment, paYoungChildTransfer } = form.elements;
const results = byId('results');
const error = byId('input-error');
const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percentFormat = new Intl.NumberFormat('en-US', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const money = value => moneyFormat.format(value);

const labels = {
  spouse: 'Surviving spouse',
  lineal_child_parent: 'Child, parent or other lineal heir',
  sibling: 'Sibling',
  collateral_other: 'Niece, nephew or other nonexempt heir',
};

function row(label, values, selected = false) {
  const tr = document.createElement('tr');
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = label;
  tr.append(heading);
  if (selected) {
    const indicator = document.createElement('small');
    indicator.className = 'note';
    indicator.textContent = ' (selected)';
    heading.append(indicator);
  }
  for (const value of values) {
    const cell = document.createElement('td');
    cell.textContent = value;
    tr.append(cell);
  }
  return tr;
}

function update() {
  const isLineal = relationship.value === 'lineal_child_parent';
  byId('young-option').hidden = !isLineal;
  paYoungChildTransfer.disabled = !isLineal;

  const messages = [
    [estate, `Enter a net taxable estate between $0 and ${money(MAX_ESTATE)}.`],
    [outside, 'Enter an out-of-state percentage from 0 to 100.'],
  ];
  let validationMessage = '';
  for (const [input, message] of messages) {
    const invalid = !input.validity.valid;
    if (invalid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    if (invalid && !validationMessage) validationMessage = message;
  }
  error.textContent = validationMessage;
  error.hidden = !validationMessage;
  results.hidden = Boolean(validationMessage);
  if (validationMessage) return;

  const options = {
    outsidePercent: outside.valueAsNumber,
    earlyPayment: earlyPayment.checked,
  };
  const selectedOptions = {
    ...options,
    paYoungChildTransfer: isLineal && paYoungChildTransfer.checked,
  };
  const { ranked, md, pa } = calculateDeathTaxes({
    ...selectedOptions, estate: estate.valueAsNumber, relationship: relationship.value,
  });

  byId('ranking').replaceChildren(...ranked.map(state => row(state.name, [
    state.rank, money(state.total), percentFormat.format(state.effectiveRate),
  ])));

  const lowest = ranked.filter(state => state.rank === 1);
  const names = lowest.map(state => state.name).join(', ');
  byId('result-summary').textContent = lowest.length === 1
    ? `${names} has the lowest estimated tax at ${money(lowest[0].total)}.`
    : `${names} tie for the lowest estimated tax at ${money(lowest[0].total)}.`;

  const amounts = {
    'md-gross': md.grossEstateTax,
    'md-inheritance': md.inheritanceTax,
    'md-credit': md.credit,
    'md-net': md.netEstateTax,
    'md-total': md.total,
    'md-comparison-estate': md.comparisonEstateTax,
    'md-comparison-total': md.comparisonTotal,
    'pa-gross': pa.grossTax,
    'pa-savings': pa.potentialSavings,
    'pa-discount': pa.discount,
    'pa-total': pa.total,
  };
  for (const [id, amount] of Object.entries(amounts)) byId(id).textContent = money(amount);

  const matrix = relationshipMatrix(estate.valueAsNumber, selectedOptions);
  byId('matrix').replaceChildren(...matrix.map(item => {
    const isSelected = item.relationship === relationship.value;
    const label = item.relationship === 'lineal_child_parent' && selectedOptions.paYoungChildTransfer
      ? 'Qualifying parent–child transfer'
      : labels[item.relationship];
    return row(label, [money(item.ma.total), money(item.md.total), money(item.pa.total)], isSelected);
  }));
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
