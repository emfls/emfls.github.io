import { BASELINE, HIGH_COST, DEFAULTS, compare } from './model.mjs';

const form = document.getElementById('mortgage-form');
const preset = document.getElementById('limitPreset');
const customLimit = document.getElementById('custom-limit');
const error = document.getElementById('input-error');
const results = document.getElementById('results');
const closingSummary = document.getElementById('closing-summary');
const paymentContext = document.getElementById('payment-context');
const winners = document.getElementById('winners');
const plans = document.getElementById('plans');
const chart = document.getElementById('chart');

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 6 });
const money = (value) => dollars.format(value);
const rate = (value) => value === null ? '—' : percent.format(value / 100);
const yearsToShow = [5, 10];
const planColors = { single: '#1d4ed8', piggyback: '#0f766e', extra: '#7941a3' };

function readInputs() {
  const input = {};
  for (const field of Object.keys(DEFAULTS)) {
    const control = form.elements.namedItem(field);
    if (control.disabled) continue;
    if (control.value === '' || control.validity.badInput) {
      throw new RangeError(`Enter a number for ${control.labels[0].textContent}.`);
    }
    if (control.validity.stepMismatch) {
      throw new RangeError(`Use ${control.step === '1' ? 'whole numbers' : 'up to two decimal places'} for ${control.labels[0].textContent}.`);
    }
    input[field] = Number(control.value);
  }
  if (preset.value === 'baseline') input.countyLimit = BASELINE;
  if (preset.value === 'ceiling') input.countyLimit = HIGH_COST;
  return input;
}

function planName(plan) {
  if (plan.id === 'piggyback') return 'Piggyback';
  if (plan.id === 'extra') return 'Extra down';
  if (plan.kind === 'jumbo') return 'Single jumbo';
  if (plan.kind === 'conforming') return 'Single conforming';
  return 'Cash purchase';
}

function row(label, value) {
  return `<dt>${label}</dt><dd>${value}</dd>`;
}

function renderPlan(plan, afterSecondMonth, openSections) {
  const name = planName(plan);
  if (!plan.available) {
    const reason = plan.id === 'extra'
      ? 'Your starting loan already fits the county limit.'
      : 'The first loan covers all borrowing at the selected down payment.';
    return `<article class="plan"><h3>${name}</h3><p class="note">${reason}</p></article>`;
  }

  const details = yearsToShow.map((years) => {
    const horizon = plan.horizons[years];
    const key = `${plan.id}-${years}`;
    return `<details data-horizon="${key}"${openSections.has(key) ? ' open' : ''}>
      <summary>${years}-year breakdown</summary>
      <dl>
        ${row('Cash plus borrowing cost', money(horizon.cashPlusCost))}
        ${row('Cash paid', money(horizon.cashPaid))}
        ${row('Interest', money(horizon.interest))}
        ${row('PMI', money(horizon.pmi))}
        ${row('Remaining debt', money(horizon.balance))}
        ${plan.id === 'extra' ? row('Cumulative return on extra cash', rate(horizon.returnOnCash)) : ''}
      </dl>
    </details>`;
  }).join('');

  const ratio = plan.deductibleRatio === null ? '—' : percent.format(plan.deductibleRatio);
  return `<article class="plan">
    <h3>${name}</h3>
    <dl>
      ${row('Down payment', money(plan.down))}
      ${row('First mortgage', money(plan.first))}
      ${plan.second > 0 ? row('Second lien', money(plan.second)) : ''}
      ${row('Blended interest rate', rate(plan.blendedRate))}
      ${row('Month 1 payment', money(plan.monthOne))}
      ${plan.monthOnePmi > 0 ? row('PMI included in month 1', money(plan.monthOnePmi)) : ''}
      ${afterSecondMonth === null ? '' : row(`Month ${afterSecondMonth} payment`, money(plan.afterSecond))}
      ${row('Estimated deductible interest share', ratio)}
      ${plan.reserve === null ? '' : row('Estimated cash reserves', money(plan.reserve))}
    </dl>
    ${details}
  </article>`;
}

function renderWinners(result, years) {
  const metrics = [
    ['cashPlusCost', 'Lowest cash plus borrowing cost'],
    ['cashPaid', 'Lowest cash paid'],
    ['financing', 'Lowest borrowing cost'],
  ];
  const lines = metrics.map(([metric, label]) => {
    const winningPlans = result.winners[years][metric].map((id) => result.plans.find((plan) => plan.id === id));
    const names = winningPlans.map(planName).join(' / ');
    const amount = money(winningPlans[0].horizons[years][metric]);
    return `<p><strong>${label}</strong><br>${names} · ${amount}${winningPlans.length > 1 ? ' (tie)' : ''}</p>`;
  });
  return `<article class="winner"><h3>After ${years} years</h3>${lines.join('')}</article>`;
}

function renderChart(eligible) {
  const maximum = Math.max(1, ...eligible.map((plan) => plan.horizons[10].cashPlusCost));
  const groupHeight = 26 + eligible.length * 42;
  const bars = yearsToShow.map((years, group) => {
    const top = group * groupHeight;
    const lines = eligible.map((plan, index) => {
      const cost = plan.horizons[years].cashPlusCost;
      const y = top + 42 + index * 42;
      return `<text x="0" y="${y}">${planName(plan)}</text>
        <text x="330" y="${y}" text-anchor="end">${money(cost)}</text>
        <rect x="0" y="${y + 5}" width="330" height="10" rx="3" fill="#e2e8f0"/>
        <rect x="0" y="${y + 5}" width="${330 * cost / maximum}" height="10" rx="3" fill="${planColors[plan.id]}"/>`;
    }).join('');
    return `<text x="0" y="${top + 20}" font-weight="700">${years} years</text>${lines}`;
  }).join('');
  return `<figcaption><h3>Cash plus borrowing cost</h3></figcaption>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 ${2 * groupHeight + 2}" role="img" aria-labelledby="chart-title chart-description">
      <title id="chart-title">Five- and ten-year cash plus borrowing cost</title>
      <desc id="chart-description">Horizontal bars compare down payment, interest and PMI on the same dollar scale. Each value is also in the plan breakdowns above.</desc>
      <g fill="#172033" font-family="system-ui, sans-serif" font-size="13">${bars}</g>
    </svg>`;
}

function update() {
  const isCustom = preset.value === 'custom';
  customLimit.hidden = !isCustom;
  form.elements.namedItem('countyLimit').disabled = !isCustom;

  let result;
  let input;
  try {
    input = readInputs();
    result = compare(input);
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  error.hidden = true;
  error.textContent = '';
  const closingText = result.extraCash > 0
    ? `${money(result.extraCash)} extra down brings ${money(result.debt)} in borrowing to the ${money(input.countyLimit)} conforming limit. Closing fees are separate.`
    : `$0.00 extra down needed. Your starting debt of ${money(result.debt)} is within the ${money(input.countyLimit)} limit.`;
  if (closingSummary.textContent !== closingText) closingSummary.textContent = closingText;
  paymentContext.textContent = result.afterSecondMonth === null
    ? 'These inputs require no piggyback second lien.'
    : `Month ${result.afterSecondMonth} is the first month after the piggyback second lien is paid off. Compare all options at that same point.`;

  const openSections = new Set(Array.from(plans.querySelectorAll('details[open]'), (detail) => detail.dataset.horizon));
  plans.innerHTML = result.plans.map((plan) => renderPlan(plan, result.afterSecondMonth, openSections)).join('');
  winners.innerHTML = yearsToShow.map((years) => renderWinners(result, years)).join('');
  chart.innerHTML = renderChart(result.plans.filter((plan) => plan.available));
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
