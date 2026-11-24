import { compare, timing } from './model.mjs';

const form = document.querySelector('#tax-form');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const winner = document.querySelector('#winner');
const annualRows = document.querySelector('#annual-gains');
const stateNames = {
  wa: 'Washington',
  ma: 'Massachusetts',
  ca: 'California',
  zero: 'Texas / Florida / Nevada',
};
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const names = new Intl.ListFormat('en-US');
const putMoney = (id, amount) => {
  document.getElementById(id).textContent = currency.format(amount);
};

function render() {
  if (!form.checkValidity()) {
    error.textContent = 'Enter amounts from $0 to $1 billion with up to two decimal places, and 1 to 30 whole years.';
    results.hidden = true;
    return;
  }

  const fields = form.elements;
  const scenario = {
    filing: fields.filing.value,
    wages: fields.wages.valueAsNumber,
    shortGain: fields.shortGain.valueAsNumber,
    longGain: fields.longGain.valueAsNumber,
    realEstateGain: fields.realEstateGain.valueAsNumber,
    gifts: fields.gifts.valueAsNumber,
  };
  const years = fields.years.valueAsNumber;
  const { taxes, winners } = compare(scenario);
  const plan = timing(scenario, years);
  error.textContent = '';

  for (const [state, amounts] of Object.entries(taxes)) {
    putMoney(`${state}-base`, amounts.baseTax);
    putMoney(`${state}-surtax`, amounts.surtax);
    putMoney(`${state}-total`, amounts.total);
    document.getElementById(`${state}-row`).classList.toggle('lowest', winners.includes(state));
  }
  putMoney('wa-ma-gap', Math.abs(taxes.wa.total - taxes.ma.total));
  document.querySelector('#wa-ma-lower').textContent = taxes.wa.total === taxes.ma.total
    ? 'Washington and Massachusetts tie'
    : `${taxes.wa.total < taxes.ma.total ? 'Washington' : 'Massachusetts'} is lower`;
  winner.textContent = `Lowest modeled state tax: ${names.format(winners.map(state => stateNames[state]))} at ${currency.format(taxes[winners[0]].total)}.`;
  putMoney('ca-sdi', taxes.ca.sdi);
  putMoney('ca-with-sdi', taxes.ca.withSdi);

  for (const state of ['wa', 'ma']) {
    putMoney(`${state}-lump`, plan[state].lumpTax);
    putMoney(`${state}-split`, plan[state].splitTax);
    putMoney(`${state}-savings`, plan[state].savings);
    putMoney(`${state}-first-room`, plan[state].firstYearRoom);
    putMoney(`${state}-later-room`, plan[state].laterYearRoom);
  }
  putMoney('ma-split-surtax', plan.ma.splitSurtax);

  const items = plan.annualGains.map((gain, index) => {
    const item = document.createElement('li');
    item.textContent = `Year ${index + 1}: ${currency.format(gain)}`;
    return item;
  });
  annualRows.replaceChildren(...items);
  results.hidden = false;
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', render);
form.addEventListener('change', render);
render();
