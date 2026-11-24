import { calculateQoz } from './model.mjs';

const form = document.querySelector('#qoz-form');
const error = document.querySelector('#input-error');
const summary = document.querySelector('#summary');
const scenarios = document.querySelector('#scenarios');
const template = document.querySelector('#scenario-template');
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
});
const points = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
const names = {
  standard_qof_10pct: 'Standard QOF',
  rural_qrof_30pct: 'Rural QROF',
};

function money(value) {
  return currency.format(Math.abs(value) < 0.005 ? 0 : value);
}

function annualized(value) {
  return value === null ? 'N/A' : percent.format(value);
}

function irrLift(value) {
  return value === null ? 'N/A' : `${points.format(value * 100)} pp`;
}

function card(title, data, selected) {
  const element = template.content.firstElementChild.cloneNode(true);
  element.classList.toggle('selected', selected);
  element.querySelector('h3').textContent = title;
  const list = element.querySelector('dl');
  const metrics = [
    ['netWealth', 'Final net after-tax wealth', money(data.netWealth)],
    ['upfrontTax', 'Tax paid today', money(data.upfrontTax)],
    ['invested', 'Amount invested', money(data.invested)],
    ['deferredTax', data.inclusionYear < 5
      ? `Deferred tax due at early exit (year ${data.inclusionYear})`
      : 'Year-5 deferred tax due', data.deferredTax === undefined ? '—' : money(data.deferredTax)],
    ['exitTax', 'Tax on exit gain', money(data.exitTax)],
    ['federalAppreciationTaxSaved', 'Federal exit tax saved by 10-year election',
      data.federalAppreciationTaxSaved === undefined ? '—' : money(data.federalAppreciationTaxSaved)],
    ['dollarAdvantage', 'Dollar advantage vs. taxable',
      data.dollarAdvantage === undefined ? '—' : money(data.dollarAdvantage)],
    ['irr', 'After-tax IRR', annualized(data.irr)],
    ['irrLift', 'IRR lift vs. taxable', data.irrLift === undefined ? '—' : irrLift(data.irrLift)],
  ];
  for (const [key, label, value] of metrics) {
    const term = document.createElement('dt');
    const definition = document.createElement('dd');
    term.textContent = label;
    definition.dataset.value = key;
    definition.textContent = value;
    list.append(term, definition);
  }
  return element;
}

function render() {
  const fields = form.elements;
  const fundType = fields.fundType.value;
  let comparison;
  try {
    comparison = calculateQoz({
      gain: fields.gain.valueAsNumber,
      fundType,
      years: fields.years.valueAsNumber,
      growthPct: fields.growthPct.valueAsNumber,
      ltcgPct: Number(fields.ltcgPct.value),
      niit: fields.niit.value === 'yes',
      statePct: fields.statePct.valueAsNumber,
      stateConforms: fields.stateConforms.value === 'yes',
    });
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    error.hidden = false;
    summary.hidden = true;
    scenarios.hidden = true;
    return;
  }

  const { taxable, funds, selected } = comparison;
  const advantage = Math.abs(selected.dollarAdvantage) < 0.005 ? 0 : selected.dollarAdvantage;
  const difference = advantage === 0
    ? 'matches taxable reinvestment'
    : `ends ${money(Math.abs(advantage))} ${advantage > 0 ? 'ahead of' : 'behind'} taxable reinvestment`;
  summary.textContent = `${names[fundType]} ${difference}. IRR lift ${irrLift(selected.irrLift)}.`;
  scenarios.replaceChildren(
    card('A · Taxable account', taxable, false),
    card('B · Standard QOF (10%)', funds.standard_qof_10pct, fundType === 'standard_qof_10pct'),
    card('C · Rural QROF (30%)', funds.rural_qrof_30pct, fundType === 'rural_qrof_30pct'),
  );
  error.hidden = true;
  summary.hidden = false;
  scenarios.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  render();
});
render();
