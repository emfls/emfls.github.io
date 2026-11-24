import { calculateStrategies } from './model.mjs';

const form = document.getElementById('ccpc-form');
const error = document.getElementById('input-error');
const results = document.getElementById('scenario-results');
const status = document.getElementById('results-status');
const rateNote = document.getElementById('rate-note');
const cards = document.getElementById('strategy-cards');
const template = document.getElementById('strategy-card');
const fields = form.elements;
const dollars = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 4 });
const strategies = [
  ['salary', '100% salary'],
  ['dividend', '100% non-eligible dividends'],
  ['hybrid', 'Hybrid strategy'],
];

const views = strategies.map(([key, title]) => {
  const card = template.content.firstElementChild.cloneNode(true);
  card.classList.toggle('highlight', key === 'hybrid');
  card.querySelector('h3').textContent = title;
  cards.append(card);
  return {
    key,
    metrics: Array.from(card.querySelectorAll('[data-metric]')),
    pensionLabel: card.querySelector('[data-pension-label]'),
    qpipRow: card.querySelector('[data-qpip]'),
  };
});

function update() {
  try {
    const invalid = Array.from(fields).find(field => field.willValidate && !field.validity.valid);
    if (invalid) {
      throw new RangeError(`${invalid.labels[0].textContent}. ${invalid.validationMessage}`);
    }

    const result = calculateStrategies({
      province: fields.province.value,
      profit: fields.profit.valueAsNumber,
      goal: fields.goal.value,
      retainRate: fields.retention.valueAsNumber / 100,
      federalLimit: fields.federalLimit.valueAsNumber,
      provincialLimit: fields.provincialLimit.valueAsNumber,
      start: fields.start.value,
      end: fields.end.value,
    });
    const quebec = fields.province.value === 'QC';

    for (const view of views) {
      for (const metric of view.metrics) {
        metric.textContent = dollars.format(result[view.key][metric.dataset.metric]);
      }
      view.pensionLabel.textContent = quebec ? 'QPP + QPP2, both sides' : 'CPP + CPP2, both sides';
      view.qpipRow.hidden = !quebec;
    }

    rateNote.textContent = `Combined corporate rates for the selected dates: ${percent.format(result.rates.small)} where both small-business limits apply and ${percent.format(result.rates.general)} at the general rate.`;
    const targetNote = result.salaryTargetAffordable
      ? ''
      : ` The profit pool cannot fund the ${dollars.format(result.salaryTarget)} salary target plus employer contributions.`;
    status.textContent = `Hybrid salary ${dollars.format(result.hybrid.salary)} · Personal cash ${dollars.format(result.hybrid.netCash)} · Retained corporate cash ${dollars.format(result.hybrid.retained)}.${targetNote}`;
    error.textContent = '';
    results.hidden = false;
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    status.textContent = '';
    results.hidden = true;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
form.addEventListener('input', update);
update();
