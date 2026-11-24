import { estimate } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('inputs');
const assets = byId('assets');
const add = byId('add-asset');
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format;
const years = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 }).format;
const printDate = new Intl.DateTimeFormat('en-AU', {
  dateStyle: 'medium', timeZone: 'UTC'
}).format;
let nextAsset = 0;

const methodNotes = {
  instant: 'Select only if rental income is the main use and the asset does not belong to a set or group of identical items costing over A$300 in total.',
  pool: 'Use the pool only if eligible. Electing a pool generally commits you to pooling future eligible low-cost assets.',
  dv: '',
  pc: ''
};

function addAsset(values = {}) {
  const row = byId('asset-template').content.firstElementChild.cloneNode(true);
  const defaults = { name: '', kind: 'new', cost: 0, ready: '2026-07-01', use: 100, method: 'dv', life: 10 };
  for (const [key, value] of Object.entries({ ...defaults, ...values })) {
    row.querySelector(`[name="${key}"]`).value = value;
  }
  row.querySelector('legend').textContent = `Asset ${++nextAsset}`;
  assets.append(row);
  return row;
}

function updateAssetControls(row) {
  const kind = row.querySelector('[name="kind"]').value;
  const method = row.querySelector('[name="method"]').value;
  const restricted = kind === 'restricted';
  for (const field of row.querySelectorAll('[data-eligible]')) {
    field.hidden = restricted;
    field.firstElementChild.disabled = restricted;
  }
  const life = row.querySelector('[data-life]');
  life.hidden = restricted || !['pc', 'dv'].includes(method);
  life.firstElementChild.disabled = life.hidden;
  const note = row.querySelector('[data-method-note]');
  const message = restricted
    ? 'Annual deduction A$0. A separate capital gain or loss may arise on disposal.'
    : methodNotes[method];
  note.textContent = message;
  note.hidden = !message;
}

function readAsset(row) {
  const value = (key) => row.querySelector(`[name="${key}"]`).value;
  const numeric = (key) => row.querySelector(`[name="${key}"]`).valueAsNumber;
  return {
    name: value('name'), kind: value('kind'), cost: numeric('cost'),
    method: value('method'), ready: value('ready'), life: numeric('life'),
    use: value('kind') === 'restricted' ? 0 : numeric('use') / 100
  };
}

function showSchedule(schedule) {
  const rows = schedule.map(({ year, div43, div40, total, cumulative, taxSaving }) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = `${year}–${String(year + 1).slice(-2)}`;
    row.append(heading);
    for (const amount of [div43, div40, total, cumulative, taxSaving]) {
      row.insertCell().textContent = money(amount);
    }
    return row;
  });
  byId('schedule').replaceChildren(...rows);
}

function recalculate() {
  const input = (name) => form.elements.namedItem(name);
  const numeric = (name) => input(name).valueAsNumber;
  const value = (name) => input(name).value;
  const rows = Array.from(assets.children);
  rows.forEach(updateAssetControls);

  const useProfitCap = value('futureUse') === 'cap';
  byId('profit-field').hidden = !useProfitCap;
  input('profit').disabled = !useProfitCap;
  const cgtDiscount = value('cgt') === 'half';

  const work = (prefix) => ({
    cost: numeric(`${prefix}Cost`),
    started: value(`${prefix}Started`),
    completed: value(`${prefix}Completed`)
  });

  try {
    const result = estimate({
      works: [work('building'), work('renovation')],
      assets: rows.map(readAsset),
      rental: {
        start: value('rentalStart'), firstDays: numeric('firstDays'), laterDays: numeric('laterDays')
      },
      share: numeric('share') / 100,
      income: numeric('income'),
      medicare: value('medicare') === 'full',
      saleRate: numeric('saleRate') / 100,
      discountRate: numeric('discountRate') / 100,
      saleYears: numeric('saleYears'),
      cgtDiscount,
      futureRentalProfit: useProfitCap ? numeric('profit') : Infinity
    });

    const first = result.schedule[0];
    byId('total').textContent = money(first.total);
    byId('split').textContent = `Division 43 ${money(first.div43)} · Division 40 ${money(first.div40)}`;
    byId('saving').textContent = money(first.taxSaving);
    byId('window').textContent = `${years(result.capital[0].remainingYears)} years · original`;
    const descriptions = result.capital.map((entry, index) => {
      const name = index === 0 ? 'Original' : 'Renovation';
      if (!entry.expiry) return `${name}: no modeled claim window`;
      const expiry = printDate(new Date(`${entry.expiry}T00:00:00Z`));
      const remaining = `${years(entry.remainingYears)} yr left`;
      return `${name}: ${remaining}, ends ${expiry}`;
    });
    byId('expiry').textContent = descriptions.join(' · ');
    byId('npv').textContent = money(result.npv);
    const scenario = cgtDiscount ? '50% discount' : 'No discount';
    byId('sale-impact').textContent =
      `${scenario} scenario · Cost-base reduction ${money(result.costBaseReduction)} · Extra sale tax ${money(result.saleTax)}`;
    showSchedule(result.schedule);
    byId('results').hidden = false;
    byId('error').hidden = true;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    byId('results').hidden = true;
    byId('error').textContent = error.message;
    byId('error').hidden = false;
    showSchedule([]);
  }
}

form.addEventListener('input', recalculate);
form.addEventListener('submit', (event) => event.preventDefault());
add.addEventListener('click', () => {
  const row = addAsset();
  recalculate();
  row.querySelector('[name="name"]').focus();
});
assets.addEventListener('click', (event) => {
  if (!event.target.closest('[data-remove]')) return;
  event.target.closest('.asset').remove();
  recalculate();
  add.focus();
});

addAsset({ name: 'New split-system air conditioner', cost: 3200 });
addAsset({ name: 'Carpets left by the seller', kind: 'restricted', cost: 4500 });
recalculate();
