import { compareFirstHome } from './model.mjs';

const form = document.querySelector('#calculator');
const value = document.querySelector('#value');
const propertyType = document.querySelector('#property-type');
const region = document.querySelector('#wa-region');
const buildField = document.querySelector('#build-field');
const completedValue = document.querySelector('#completed-value');
const eligible = document.querySelector('#eligible');
const valueLabel = document.querySelector('#value-label');
const error = document.querySelector('#input-error');
const status = document.querySelector('#result-status');
const format = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const keys = ['standardDuty', 'dutyPayable', 'dutySaved', 'grant', 'totalSupport'];
const columns = [...document.querySelectorAll('[data-state]')];

function render() {
  const separateBuild = propertyType.value === 'land-build';
  const landOnly = propertyType.value === 'land';
  valueLabel.textContent = separateBuild || landOnly ? 'Dutiable land value (AUD)' : 'Dutiable home value (AUD)';
  buildField.hidden = !separateBuild;
  completedValue.disabled = !separateBuild;
  region.disabled = !eligible.checked || landOnly || propertyType.value === 'established';

  let rows;
  try {
    rows = compareFirstHome({
      value: value.valueAsNumber,
      propertyType: propertyType.value,
      waRegion: region.value,
      completedValue: completedValue.valueAsNumber,
      eligible: eligible.checked,
    });
    error.textContent = '';
  } catch (problem) {
    error.textContent = problem.message;
  }

  for (const column of columns) {
    const row = rows?.find(({ state }) => state === column.dataset.state);
    const cells = column.querySelectorAll('td');
    for (const [cellIndex, key] of keys.entries()) {
      cells[cellIndex].textContent = row ? format.format(row[key]) : '—';
    }
  }
  status.textContent = rows?.map(({ state, dutyPayable, totalSupport }) =>
    `${state} duty ${format.format(dutyPayable)}, total support ${format.format(totalSupport)}.`
  ).join(' ') ?? '';
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();
