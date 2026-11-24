import { cadToCents, calculateYears, FIRST_YEAR, LAST_YEAR } from './model.mjs';

const form = document.querySelector('#t1135-form');
const years = document.querySelector('#tax-years');
const total = document.querySelector('#overall-total');
const note = document.querySelector('#overall-note');
const addYearButton = document.querySelector('#add-year');
const yearTemplate = document.querySelector('#year-template');
const snapshotTemplate = document.querySelector('#snapshot-template');

const dollars = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const fractionalCent = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', minimumFractionDigits: 3,
});
const filingLabels = {
  EXEMPT: 'EXEMPT — NO T1135 REQUIRED',
  'PART A': 'PART A — SIMPLIFIED REPORTING METHOD',
  'PART B': 'PART B — DETAILED REPORTING METHOD',
};
const example = { stocks: '87500', bank: '16500', registered: '32000', canadianFunds: '14000' };

function money(cents) {
  return (Number.isInteger(cents) ? dollars : fractionalCent).format(cents / 100);
}

function field(card, key) {
  return card.querySelector(`[data-field="${key}"]`);
}

function addSnapshot(card, values = {}) {
  const snapshot = snapshotTemplate.content.firstElementChild.cloneNode(true);
  for (const input of snapshot.querySelectorAll('[data-cost]')) {
    input.value = values[input.dataset.cost] ?? '';
  }
  card.querySelector('[data-snapshots]').append(snapshot);
  return snapshot;
}

function addYear(year, sample = false) {
  const card = yearTemplate.content.firstElementChild.cloneNode(true);
  field(card, 'year').value = year;
  field(card, 'due').value = `${year + 1}-04-30`;
  field(card, 'end').value = sample ? `${year + 1}-05-12` : field(card, 'due').value;
  addSnapshot(card, sample ? example : {});
  years.append(card);
  return card;
}

function readEntry(card) {
  const snapshots = [...card.querySelectorAll('.snapshot')].map((snapshot) => {
    return Object.fromEntries([...snapshot.querySelectorAll('[data-cost]')].map((input) => {
      try {
        return [input.dataset.cost, cadToCents(input.value)];
      } catch (error) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', card.querySelector('[data-error]').id);
        const label = input.closest('label').textContent.trim();
        throw new RangeError(`${label}. ${error.message}`);
      }
    }));
  });
  return {
    year: field(card, 'year').valueAsNumber,
    snapshots,
    due: field(card, 'due').value,
    end: field(card, 'end').value,
    scenario: field(card, 'scenario').value,
    demand: field(card, 'demand').value,
  };
}

function showResult(card, result) {
  const { penalty, jointPeak, jointTier } = result;
  const days = penalty.days === 1 ? 'day' : 'days';
  const months = penalty.months === 1 ? 'month' : 'months';
  const timing = result.tier === 'EXEMPT' ? '' : [
    `${penalty.days} ${days} past the due date.`,
    penalty.months ? `${penalty.months} counted calendar ${months} under section 162(10).` : '',
  ].filter(Boolean).join(' ');
  const outputs = {
    tier: filingLabels[result.tier],
    peak: money(result.peak),
    excludedPeak: money(result.excludedPeak),
    jointPeak: money(jointPeak),
    standard: money(penalty.standard),
    enhanced: money(penalty.enhanced),
    additional: money(penalty.additional),
    total: money(penalty.total),
    timing,
    jointTier: jointPeak ? `Joint account alone for each owner: ${filingLabels[jointTier]}. Include each owner's other eligible holdings when checking their filing obligation.` : '',
  };
  for (const [key, value] of Object.entries(outputs)) {
    const output = card.querySelector(`[data-output="${key}"]`);
    output.textContent = value;
    output.hidden = value === '';
  }
}

function refresh() {
  const cards = [...years.children];
  const chosenYears = cards.map((card) => field(card, 'year').valueAsNumber);
  let combined = 0;
  let invalid = false;

  for (const [index, card] of cards.entries()) {
    const selected = chosenYears[index];
    card.querySelector('[data-year-label]').textContent = Number.isFinite(selected) ? selected : '';
    card.querySelector('[data-action="remove-year"]').hidden = cards.length === 1;

    const snapshots = [...card.querySelectorAll('.snapshot')];
    for (const [snapshotIndex, snapshot] of snapshots.entries()) {
      snapshot.querySelector('[data-snapshot-label]').textContent = snapshotIndex + 1;
      snapshot.querySelector('[data-action="remove-snapshot"]').hidden = snapshots.length === 1;
    }

    const showDemand = field(card, 'scenario').value === 'demandOnly';
    card.querySelector('[data-demand-label]').hidden = !showDemand;
    field(card, 'demand').disabled = !showDemand;
    const message = card.querySelector('[data-error]');
    message.id = `year-error-${index + 1}`;
    const resultPanel = card.querySelector('.annual-result');
    for (const input of card.querySelectorAll('[aria-invalid]')) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }

    try {
      if (chosenYears.some((year, other) => index !== other && selected === year)) {
        throw new RangeError('Enter each tax year only once.');
      }
      const calculation = calculateYears([readEntry(card)]);
      showResult(card, calculation.results[0]);
      combined += calculation.total;
      resultPanel.hidden = false;
      message.hidden = true;
      message.textContent = '';
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      invalid = true;
      resultPanel.hidden = true;
      message.textContent = error.message;
      message.hidden = false;
    }
  }
  total.textContent = invalid ? '—' : money(combined);
  note.textContent = invalid ? 'Correct the highlighted year entries to see the combined estimate.' : '';
  addYearButton.disabled = cards.length >= LAST_YEAR - FIRST_YEAR + 1;
}

form.addEventListener('input', refresh);
form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const card = button.closest('.year-card');
  let focus;
  if (button === addYearButton) {
    const inUse = [...years.children].map((entry) => field(entry, 'year').valueAsNumber);
    let available = LAST_YEAR;
    while (inUse.includes(available) && available >= FIRST_YEAR) available--;
    if (available < FIRST_YEAR) return;
    focus = field(addYear(available), 'year');
  } else {
    switch (button.dataset.action) {
      case 'remove-year': {
        const remaining = card.nextElementSibling ?? card.previousElementSibling;
        card.remove();
        focus = field(remaining, 'year');
        break;
      }
      case 'add-snapshot':
        focus = addSnapshot(card).querySelector('input');
        break;
      case 'remove-snapshot':
        button.closest('.snapshot').remove();
        focus = card.querySelector('[data-action="add-snapshot"]');
        break;
      default:
        return;
    }
  }
  refresh();
  focus.focus();
});

addYear(LAST_YEAR, true);
refresh();
form.hidden = false;
