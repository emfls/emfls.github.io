import { calculate } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('calculator');
const results = byId('results');
const error = byId('error');
const fields = form.elements;
const numbers = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const exactNumbers = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });

function dollars(value, format = numbers) {
  const rounded = format.format(Math.abs(value));
  const sign = value < 0 && Number(rounded) !== 0 ? '−' : '';
  return `${sign}A$${rounded}`;
}

function put(id, text) {
  byId(id).textContent = text;
}

function renderComparison({ deposit, help, five, twenty }) {
  const rows = [
    ['Buyer deposit', deposit, five.deposit, twenty.deposit],
    ['LMI premium', 0, five.premium, twenty.premium],
    ['Cash at purchase (deposit + upfront LMI)', deposit, five.upfront, twenty.upfront],
    ['Starting loan', help.principal, five.principal, twenty.principal],
    ['Monthly P&I', help.monthly, five.monthly, twenty.monthly],
    ['Interest through exit', help.interest, five.interest, twenty.interest],
    ['Loan balance at exit', help.balance, five.balance, twenty.balance],
    ['Help to Buy cash saved upfront', null, five.upfrontSaved, twenty.upfrontSaved],
    ['Help to Buy monthly payment savings', null, five.monthlySaved, twenty.monthlySaved],
    ['Help to Buy interest savings through exit', null, five.interestSaved, twenty.interestSaved],
    ['Help to Buy net wealth difference', null, five.net, twenty.net]
  ];

  byId('comparison-rows').replaceChildren(...rows.map(([label, ...values]) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    const format = label === 'Monthly P&I' || label === 'Help to Buy monthly payment savings' ? cents : numbers;
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value === null ? '—' : dollars(value, format);
      row.append(cell);
    }
    return row;
  }));
}

function render(model, input) {
  const { checks, eligible, incomeCap, priceCap, five, govCapitalGainShare } = model;
  const badge = byId('eligibility');
  badge.dataset.state = eligible ? 'pass' : 'fail';
  badge.textContent = eligible ? 'Pass · modelled thresholds' : 'Fail · modelled thresholds';

  const failed = [];
  if (!checks.income) failed.push('taxable income exceeds the cap');
  if (!checks.price) failed.push('purchase price exceeds the cap');
  if (!checks.deposit) failed.push('deposit is below 2%');
  const incomePeriod = input.incomeYear === 'indexed' ? '2026–27' : '2025–26';
  const limits = `${incomePeriod} income cap ${dollars(incomeCap, exactNumbers)} · location price cap ${dollars(priceCap, exactNumbers)} · deposit minimum 2%.`;
  put('eligibility-details', eligible ? limits : `${limits} Check failed: ${failed.join('; ')}. The amounts below illustrate this scenario.`);

  put('buyer-deposit', dollars(model.deposit));
  put('government-equity', `${dollars(model.govEquity)} (${Math.round(model.govEquityRate * 100)}%)`);
  put('monthly-savings', `${dollars(five.monthlySaved, cents)}/mo`);
  put('lmi-avoided', dollars(model.lmiAvoided));
  put('buyout-label', `Year ${input.holdingYears} government buyout`);
  put('buyout', dollars(model.govBuyoutPayout));
  put('net-wealth', dollars(five.net));

  const equityChange = govCapitalGainShare >= 0
    ? `The buyout includes ${dollars(govCapitalGainShare)} of appreciation.`
    : `The buyout is ${dollars(-govCapitalGainShare)} below the original government contribution.`;
  put('exit-details', `Projected home value at exit is ${dollars(model.futureHomeValue)}. ${equityChange}`);

  const difference = Math.round(Math.abs(five.net));
  let verdict = 'The two scenarios are within A$1 of each other';
  if (difference > 0) {
    const ahead = five.net > 0 ? 'Help to Buy' : 'the standard 5% loan';
    verdict = `The model puts ${ahead} ahead by ${dollars(Math.abs(five.net))}`;
  }
  put('net-details', `${verdict} after ${input.holdingYears} years, assuming you retain the cash savings.`);
  renderComparison(model);
}

function update() {
  fields.depositRate.max = fields.home.value === 'new' ? '60' : '70';
  const invalid = [...fields].find((field) => !field.validity.valid);
  if (invalid) {
    const label = invalid.labels[0].textContent;
    error.textContent = `${label}. ${invalid.validationMessage}`;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const input = Object.fromEntries([...fields].map((field) => [
    field.name, field.type === 'number' ? field.valueAsNumber : field.value
  ]));
  render(calculate(input), input);
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});
update();
