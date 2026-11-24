import { projectRecontribution } from './model.mjs';

const byId = id => document.getElementById(id);
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const wholeCurrency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 2 });
const valueOf = id => byId(id).value;
const amountOf = id => valueOf(id).trim() === '' ? NaN : Number(valueOf(id));
const showText = (id, content) => { byId(id).textContent = content; };

const gateMessages = {
  age: 'The withdrawal and recontribution planner covers ages 60–74.',
  release: 'At age 60–64, confirm unrestricted lump-sum access before projecting a withdrawal.',
  'no-cap': 'There is no modelled contribution room this financial year.',
  'unknown-cap': 'Check your bring-forward status in ATO online services to estimate recontribution room.',
  'cap-conflict': 'Other contributions already exceed the annual cap. Check whether a bring-forward arrangement is active.',
  'no-taxable': 'This source contains no taxable amount to convert.',
  'no-target': 'Enter a positive target to project recontributions.',
  'untaxed-funding': 'Confirm how you would fund the full recontribution before modelling a withdrawal with an untaxed element.'
};
const stopMessages = {
  age: 'The next withdrawal falls at age 75 or older and is outside this planner.',
  depleted: 'The original source account is exhausted.'
};

function addMetric(list, name, value) {
  const label = document.createElement('dt');
  const amount = document.createElement('dd');
  label.textContent = name;
  amount.textContent = currency.format(value);
  list.append(label, amount);
}

function cycleCard(cycle, index) {
  const item = document.createElement('li');
  item.className = 'cycle';
  const title = document.createElement('h4');
  title.textContent = `After cycle ${index + 1}`;
  const timing = document.createElement('p');
  timing.className = 'note';
  timing.textContent = `${cycle.year}–${String(cycle.year + 1).slice(-2)} · age ${cycle.age}`;
  const metrics = document.createElement('dl');
  addMetric(metrics, 'Withdrawn and recontributed', cycle.withdrawal);
  addMetric(metrics, 'Taxable amount converted this cycle', cycle.converted);
  addMetric(metrics, 'Direct tax reduced so far', cycle.savedDirect);
  addMetric(metrics, 'Estate tax reduced so far', cycle.savedEstate);
  addMetric(metrics, 'Direct tax remaining', cycle.remaining.direct);
  addMetric(metrics, 'Estate tax remaining', cycle.remaining.estate);
  item.append(title, timing, metrics);
  return item;
}

function splitText(split) {
  return `${percent.format(split.taxFreePct / 100)} tax-free and ${percent.format(split.taxablePct / 100)} taxable`;
}

function update() {
  const age = amountOf('age');
  const untaxed = amountOf('untaxed');
  const arrangement = valueOf('arrangement');
  byId('fresh-fields').hidden = arrangement !== 'fresh';
  byId('active-cap-field').hidden = arrangement !== 'active';
  byId('active-reset-field').hidden = arrangement !== 'active';
  byId('release-field').hidden = !(age >= 60 && age < 65);
  byId('untaxed-field').hidden = !(untaxed > 0);

  let plan;
  try {
    plan = projectRecontribution({
      taxFree: amountOf('tax-free'), taxed: amountOf('taxed'), untaxed,
      tsb: amountOf('tsb'), age, release: byId('release').checked,
      beneficiary: valueOf('beneficiary'), target: amountOf('target'), arrangement,
      otherContributions: amountOf('other-contributions'), remainingCap: amountOf('remaining-cap'),
      yearsToReset: Number(valueOf('reset-year')), untaxedFunding: byId('untaxed-funding').checked
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    byId('results').hidden = true;
    byId('error').hidden = false;
    showText('error', error.message);
    return;
  }

  byId('error').hidden = true;
  const { current, initialSplit, tier, gate, cycles, stop } = plan;
  showText('direct-tax', currency.format(current.direct));
  showText('estate-tax', currency.format(current.estate));
  showText('levy-saving', currency.format(current.levy));
  const period = tier.years > 1 ? `over ${tier.years} years` : 'annual only';
  showText('tier', tier.cap
    ? `2026–27 TSB tier for a new arrangement: ${wholeCurrency.format(tier.cap)} (${period}).`
    : '2026–27 TSB tier: nil.');
  showText('gate', gate.code === 'eligible'
    ? `Meets the modelled age, access and cap checks. Estimated 2026–27 contribution room: ${currency.format(gate.available)}.`
    : gateMessages[gate.code]);

  byId('cycle-rows').replaceChildren(...cycles.map(cycleCard));
  byId('projection').hidden = cycles.length === 0;
  byId('stop').hidden = !stop;
  showText('stop', stopMessages[stop] ?? '');
  if (cycles.length) {
    const finalSplit = cycles.at(-1).split;
    showText('split', `Combined split moves from ${splitText(initialSplit)} to ${splitText(finalSplit)} after ${cycles.length} ${cycles.length === 1 ? 'cycle' : 'cycles'}.`);
    byId('tax-free-bar').style.width = `${finalSplit.taxFreePct}%`;
  }
  byId('results').hidden = false;
}

const form = byId('calculator');
form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
