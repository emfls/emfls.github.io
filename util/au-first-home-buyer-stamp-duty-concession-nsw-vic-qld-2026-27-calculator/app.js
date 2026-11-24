import { calculateDuty, MAX_VALUE, STATES } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('duty-form');
const { state, propertyType, value, completedValue } = form.elements;
const results = byId('results');
const error = byId('error');
const comparisonRows = [...document.querySelectorAll('#comparison tr[data-metric]')];
const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const money = cents => currency.format(cents / 100);

const occupancy = {
  NSW: {
    home: 'For duty relief on a home, move in within 12 months of settlement and live there continuously for at least 12 months.',
    land: 'NSW’s vacant land duty relief requires an intention to build a home. If claiming the grant, move in within 12 months of completing the eligible build and live there continuously for at least 12 months.',
  },
  VIC: {
    home: 'For first home duty relief, move in within 12 months of settlement and live there continuously for at least 12 months.',
    land: 'For vacant land duty relief, move in within 12 months of the occupancy certificate or 36 months of settlement, whichever comes first, and live there continuously for 12 months.',
  },
  QLD: {
    home: 'For duty relief, move in within 12 months of settlement. Selling, transferring or renting out the whole home within a year of moving in can trigger a reassessment.',
    land: 'For vacant land duty relief, build and move in within two years of settlement. Selling, transferring or leasing the whole property within a year of moving in can trigger a reassessment.',
  },
};

function updateComparison(estimates, selectedState) {
  STATES.forEach((code, index) => {
    const selected = code === selectedState;
    byId('col-' + code).dataset.selected = selected;
    for (const row of comparisonRows) {
      const cell = row.cells[index + 1];
      cell.textContent = estimates ? money(estimates[index][row.dataset.metric]) : '—';
      cell.dataset.selected = selected;
    }
  });
}

function update() {
  const code = state.value;
  const type = propertyType.value;
  const land = type === 'vacant_land';
  const assessedValue = value.valueAsNumber;
  const buildValue = land && completedValue.value !== '' ? completedValue.valueAsNumber : null;
  byId('build-field').hidden = !land;
  completedValue.disabled = !land;
  const residence = occupancy[code];
  let reminder = land ? residence.land : residence.home;
  if ((type === 'new_home' && code === 'NSW') || (type !== 'established' && code === 'VIC')) {
    reminder += ' The grant also requires 12 months of continuous occupancy starting within 12 months of the eligible transaction being completed.';
  }
  if (code === 'QLD' && type !== 'established') {
    reminder += ' For the grant, move in within 12 months of completion and live there continuously for six months.';
  }
  byId('occupancy').textContent = reminder;

  let message = '';
  if (!value.validity.valid) {
    message = 'Enter a dutiable value between A$0.01 and ' + money(MAX_VALUE * 100) + ', with up to two decimal places.';
  } else if (land && (!completedValue.validity.valid || (buildValue !== null && buildValue < assessedValue))) {
    message = 'Enter a completed home value at least as high as the land value, or leave it blank.';
  }
  error.textContent = message;
  error.hidden = !message;
  value.setAttribute('aria-invalid', String(!value.validity.valid));
  completedValue.setAttribute('aria-invalid', String(Boolean(message) && value.validity.valid));
  results.hidden = Boolean(message);
  if (message) {
    byId('comparison-caption').textContent = 'Enter a valid dutiable value to compare states';
    updateComparison(null, code);
    return;
  }

  const estimates = STATES.map(stateCode => calculateDuty({
    state: stateCode, propertyType: type, value: assessedValue, completedValue: buildValue,
  }));
  const selected = estimates[STATES.indexOf(code)];
  const scenario = money(Math.round(assessedValue * 100)) + ' · ' + propertyType.selectedOptions[0].textContent;
  byId('scenario').textContent = code + ' · ' + scenario;
  byId('comparison-caption').textContent = scenario + ' · AUD';
  for (const [metric, cents] of Object.entries(selected)) {
    byId(metric).textContent = money(cents);
  }
  byId('result-note').textContent = land && buildValue === null
    ? 'Enter a completed home value to include a potential grant for a separate build.'
    : 'Assumes all scheme requirements are met. Grant payment timing varies by transaction.';
  updateComparison(estimates, code);
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
