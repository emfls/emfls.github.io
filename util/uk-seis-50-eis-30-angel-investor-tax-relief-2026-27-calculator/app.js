import { calculate } from './model.mjs';

const form = document.getElementById('tax-form');
const results = document.getElementById('results');
const error = document.getElementById('input-error');
const comparison = document.getElementById('comparison');
const fields = [...form.querySelectorAll('input, select')];
const money = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const percentage = new Intl.NumberFormat('en-GB', {
  style: 'percent', maximumFractionDigits: 2,
});
const multiple = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2, maximumFractionDigits: 4,
});
const formatMoney = value => money.format(Math.abs(value) < 0.005 ? 0 : value);
const write = (id, text) => { document.getElementById(id).textContent = text; };

function addRow(label, values) {
  const row = comparison.insertRow();
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = label;
  row.append(heading);

  for (const [value, description] of values) {
    const cell = row.insertCell();
    const primary = document.createElement('strong');
    primary.textContent = value;
    cell.append(primary);
    if (description) {
      const secondary = document.createElement('small');
      secondary.textContent = description;
      cell.append(secondary);
    }
  }
}

function render(model) {
  for (const [scheme, result] of Object.entries(model)) {
    write(`${scheme}-risk`, percentage.format(result.downsideRisk));
    write(`${scheme}-loss`, formatMoney(-result.scenarios[0].netProfit));
  }

  const columns = Object.values(model);
  comparison.replaceChildren();
  const amounts = field => columns.map(result => [formatMoney(result[field])]);
  addRow('Upfront Income Tax relief', amounts('incomeTaxRelief'));
  addRow('Capital at risk after upfront relief', amounts('netExposure'));
  addRow('Income Tax loss relief at 0×', columns.map(result => [formatMoney(result.scenarios[0].lossRelief)]));
  addRow('Share CGT at upside exit', columns.map(result => [formatMoney(result.scenarios[2].shareCgt)]));

  const upside = model.seis.scenarios[2].multiple;
  const labels = ['0× failure', '1× gross break-even', `${upside}× upside`];
  labels.forEach((label, index) => {
    addRow(label, columns.map(({ scenarios }) => {
      const { netMultiple, netProfit } = scenarios[index];
      return [`${multiple.format(netMultiple)}×`, `${formatMoney(netProfit)} net`];
    }));
  });

  write('seis-reinvestment', `SEIS reinvestment exempts ${formatMoney(model.seis.exemptGain)} of the other gain and saves ${formatMoney(model.seis.cgtSaving)} in CGT.`);
  write('eis-deferral', `EIS defers ${formatMoney(model.eis.deferredGain)} of the other gain, postponing ${formatMoney(model.eis.cgtDeferred)} in CGT. The estimated tax revived at disposal is ${formatMoney(model.eis.scenarios[0].revivedTax)} before future offsets.`);
  write('results-status', `The estimated loss at 0× is ${formatMoney(-model.seis.scenarios[0].netProfit)} with SEIS and ${formatMoney(-model.eis.scenarios[0].netProfit)} with EIS.`);
}

function update() {
  try {
    const inputs = {};
    for (const field of fields) {
      if (field.type === 'number' && (field.value === '' || field.validity.stepMismatch)) {
        const label = field.labels[0].textContent;
        throw new RangeError(`Enter a valid amount for “${label}” using up to two decimal places.`);
      }
      inputs[field.name] = Number(field.value);
    }

    const model = calculate(inputs);
    error.hidden = true;
    error.textContent = '';
    results.hidden = false;
    render(model);
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.hidden = false;
    error.textContent = problem.message;
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
