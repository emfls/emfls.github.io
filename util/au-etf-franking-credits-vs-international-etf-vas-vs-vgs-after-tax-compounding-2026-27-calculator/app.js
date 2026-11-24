import { compareEtfs, TAX_PROFILES } from './model.mjs';

const form = document.querySelector('#calculator');
const results = document.querySelector('#results');
const status = document.querySelector('#calculation-status');
const crossover = document.querySelector('#crossover-rows');
const field = (name) => form.elements.namedItem(name);
const amounts = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0,
});
const money = (value) => amounts.format(Math.round(value) || 0);
const percent = (value) => (value * 100).toFixed(2) + '%';
const points = (value) => Math.abs(value * 100).toFixed(2) + ' pp';
const winner = (gap) => {
  if (Math.round(Math.abs(gap)) === 0) return 'Tie';
  return gap > 0 ? 'Australian' : 'International';
};
const show = (id, value) => { document.getElementById(id).textContent = value; };

function render() {
  const invalid = Array.from(form.elements).find((element) => element.validity && !element.validity.valid);
  if (invalid) {
    results.hidden = true;
    status.textContent = invalid.labels[0].textContent + ' — ' + invalid.validationMessage;
    return;
  }

  const rate = (name) => field(name).valueAsNumber / 100;
  const options = {
    principal: field('principal').valueAsNumber,
    years: field('years').valueAsNumber,
    auYield: rate('auYield'),
    auGrowth: rate('auGrowth'),
    frankingPct: rate('frankingPct'),
    intlYield: rate('intlYield'),
    intlGrowth: rate('intlGrowth'),
    profile: field('profile').value,
    foreignTaxMode: field('foreignTaxMode').value,
  };
  const { australian, international, valueGap, cagrGap } = compareEtfs(options);
  const lead = winner(valueGap);
  show('au-value', money(australian.finalValue));
  show('intl-value', money(international.finalValue));
  show('au-cagr', percent(australian.cagr) + ' after-tax CAGR');
  show('intl-cagr', percent(international.cagr) + ' after-tax CAGR');
  const highest = Math.max(australian.finalValue, international.finalValue);
  document.getElementById('au-bar').style.width = percent(australian.finalValue / highest);
  document.getElementById('intl-bar').style.width = percent(international.finalValue / highest);
  show('credit-total', money(australian.frankingCredits));
  show('refund-total', money(australian.frankingRefunds));
  show('au-cgt', money(australian.cgt));
  show('intl-cgt', money(international.cgt));
  show('au-income-tax', money(australian.annualTaxPaid));
  show('intl-income-tax', money(international.annualTaxPaid));
  show('results-heading', options.years + '-year after-tax comparison');
  show('cagr-gap', points(cagrGap));

  const scenarios = TAX_PROFILES.map((profile) => ({
    profile, ...compareEtfs({ ...options, profile: profile.id }),
  }));
  crossover.replaceChildren(...scenarios.map(({ profile, australian, international, valueGap }) => {
    const row = document.createElement('tr');
    if (profile.id === options.profile) row.classList.add('selected');
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = profile.label;
    row.append(label);
    for (const value of [money(australian.finalValue), money(international.finalValue), winner(valueGap)]) {
      const cell = row.insertCell();
      cell.textContent = value;
    }
    return row;
  }));

  const personal = scenarios.filter(({ profile }) => profile.id.startsWith('personal'));
  const flips = [];
  for (let i = 1; i < personal.length; i += 1) {
    if (winner(personal[i - 1].valueGap) !== winner(personal[i].valueGap)) {
      flips.push(percent(personal[i - 1].profile.rate) + ' → ' + percent(personal[i].profile.rate));
    }
  }
  show('crossover-note', flips.length
    ? 'Personal rate steps where the modeled lead changes · ' + flips.join(', ') + '.'
    : 'The modeled lead is the same across the personal rate presets.');
  status.textContent = lead === 'Tie'
    ? 'The portfolios tie to the nearest dollar.'
    : lead + ' ETF leads by ' + money(Math.abs(valueGap)) + '.';
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  render();
});
form.addEventListener('reset', () => queueMicrotask(render));
render();
