import { calculate } from './model.mjs';

const byId = id => document.getElementById(id);
const number = id => byId(id).valueAsNumber;
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const rate = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
const form = byId('calculator');
const region = byId('region');
const error = byId('error');
const results = byId('results');
const ceilingInput = byId('ceiling');
const unitIds = ['school', 'county', 'city', 'special'];
const rateFields = unitIds.flatMap(unit => [unit + '-rate', unit + '-percent']);
const presets = {
  austin: [0.98, 0, 0.37, 20, 0.50, 20, 0.12, 0],
  dallas: [1.00, 0, 0.22, 20, 0.70, 20, 0.19, 0],
  houston: [0.88, 20, 0.39, 20, 0.52, 20, 0.24, 0],
  'san-antonio': [1.03, 0, 0.30, 20, 0.54, 20, 0.15, 0],
  'fort-worth': [1.05, 0, 0.19, 20, 0.67, 20, 0.16, 0],
};

function showField(fieldId, inputId, show) {
  byId(fieldId).hidden = !show;
  byId(inputId).disabled = !show;
}

function tableRow(label, amounts) {
  const row = document.createElement('tr');
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = label;
  row.append(heading);
  for (const amount of amounts) {
    const cell = document.createElement('td');
    cell.textContent = money.format(amount);
    row.append(cell);
  }
  return row;
}

function render() {
  const capActive = byId('cap-active').value === 'yes';
  const senior = byId('senior').checked;
  const veteran = byId('veteran').checked;

  showField('prior-field', 'prior', capActive);
  showField('improvements-field', 'improvements', capActive);
  showField('ceiling-field', 'ceiling', senior && !veteran);
  error.hidden = true;

  try {
    const invalid = [...form.elements].find(input => input.willValidate && !input.validity.valid);
    if (invalid) {
      const label = invalid.labels[0].textContent.trim();
      throw new RangeError(label + '. ' + invalid.validationMessage);
    }
    const { years, cumulativeSavings } = calculate({
      market: number('market'),
      priorAppraised: number('prior'),
      improvements: number('improvements'),
      capActive,
      senior,
      veteran,
      ceiling: ceilingInput.value === '' ? null : ceilingInput.valueAsNumber,
      growth: number('growth'),
      schoolRate: number('school-rate'),
      schoolPercent: number('school-percent'),
      localUnits: unitIds.slice(1).map(unit => ({
        rate: number(unit + '-rate'),
        percent: number(unit + '-percent'),
      })),
    });

    const first = years[0];
    const summaries = {
      'with-tax': first.withHomestead,
      'without-tax': first.uncappedTax,
      saved: first.savings,
      'old-saved': first.oldExemptionSavings,
      cumulative: cumulativeSavings,
      appraised: first.appraised,
    };
    for (const [id, amount] of Object.entries(summaries)) {
      byId(id).textContent = money.format(amount);
    }
    byId('effective').textContent = first.effectiveRate === null ? 'N/A' : rate.format(first.effectiveRate) + '%';
    byId('applied-ceiling').textContent = first.schoolCeiling === null
      ? 'Not applied'
      : money.format(first.schoolCeiling) + (ceilingInput.value === '' ? ' (estimated first-year ceiling)' : '');

    const localLabels = ['County', 'City', 'Special district / MUD'];
    byId('tax-units').replaceChildren(
      tableRow('School district (ISD)', [first.schoolTaxable, first.schoolTax]),
      ...first.locals.map((unit, index) => tableRow(localLabels[index], [unit.taxable, unit.tax])),
    );
    byId('projection').replaceChildren(...years.map(row => tableRow(row.year, [
      row.market, row.appraised, row.withHomestead, row.uncappedTax, row.savings,
    ])));
    results.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.hidden = false;
    error.textContent = issue.message;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === region && region.value !== 'custom') {
    presets[region.value].forEach((value, index) => {
      byId(rateFields[index]).value = value;
    });
  } else if (rateFields.includes(event.target.id)) {
    region.value = 'custom';
  }
  render();
});
render();
