import {
  amortizationFactor, lifeFactor, lockDates, minimumBalance, payments, rateCeiling, recapture, rule55,
} from './model.mjs';

const el = id => document.getElementById(id);
const value = id => el(id).value;
const number = id => el(id).valueAsNumber;
const set = (id, text) => { el(id).textContent = text; };
const yearOf = date => Number(date.slice(0, 4));
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
const dateLabel = date => dateFormat.format(new Date(`${date}T00:00:00Z`));
const percent = rate => `${rate.toFixed(2)}%`;
const quarters2026 = { '2026-Q1': 7, '2026-Q2': 6, '2026-Q3': 7, '2026-Q4': 7 };
const priorInputs = new Map();

function show(id, render) {
  try {
    set(id, render());
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    set(id, error.message);
  }
}

function updatePlan() {
  const ceiling = rateCeiling(value('start'));
  const months = ceiling.months.map(([month, rate]) => `${month} ${percent(rate)}`).join(' and ');
  set('rate-limit', `Eligible annual 120% mid-term AFRs are ${months}. Your ceiling is ${percent(ceiling.maxRate)}.`);
  const lock = lockDates(value('birth'), value('start'));
  const age = yearOf(value('start')) - yearOf(value('birth'));
  const table = value('table');
  const balance = number('balance');
  const rate = number('rate');
  const plan = payments({ balance, rmdBalance: number('rmd-balance'), age, table, rate, maxRate: ceiling.maxRate });

  for (const method of ['rmd', 'amortization', 'annuitization']) {
    set(method, money.format(plan[method]));
  }
  set('divisors', `Calendar-year age ${age} · Life expectancy factor ${plan.life.toFixed(1)} · Single-life annuity factor ${plan.annuityDivisor.toFixed(6)}`);
  set('lock', `Earliest change date ${dateLabel(lock.release)}. Fifth anniversary ${dateLabel(lock.anniversary)} · Age 59½ on ${dateLabel(lock.halfBirthday)}.`);
  el('plan-results').hidden = false;
  return { ...plan, age, balance, ceiling: ceiling.maxRate, lock, rate, table };
}

function carveOut(plan) {
  const rate = value('split-rate') === 'maximum' ? plan.ceiling : plan.rate;
  const needed = minimumBalance(number('target'), amortizationFactor(plan.life, rate));
  const difference = plan.balance - needed;
  const remaining = difference >= 0
    ? `${money.format(difference)} can stay in a separate IRA.`
    : `The target needs ${money.format(-difference)} more than the entered fixed-method balance.`;
  return `Minimum carve-out ${money.format(needed)} at ${percent(rate)}. ${remaining}`;
}

function switchToRmd(plan) {
  const year = number('switch-year');
  const balance = number('switch-balance');
  if (!Number.isInteger(year) || year <= yearOf(value('start')) || year > 2051 || `${year}-01-01` >= plan.lock.release) {
    throw new RangeError('Choose a subsequent calendar year that begins before the lock ends.');
  }
  if (!Number.isFinite(balance) || balance < 0 || balance > 1e12) {
    throw new RangeError('Enter a switch balance between $0 and $1 trillion.');
  }
  const age = year - yearOf(value('birth'));
  return `${year} RMD payment ${money.format(balance / lifeFactor(age, plan.table))}. Recalculate annually using that year’s age and applicable balance.`;
}

function priorYearFields(year) {
  if (!priorInputs.has(year)) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'prior-row';
    fieldset.innerHTML = `<legend>${year}</legend>
      <div class="grid">
        <div><label for="amount-${year}">Taxable SEPP amount ($)</label><input id="amount-${year}" type="number" inputmode="decimal" min="0" step="0.01"></div>
        <div><label for="from-${year}">Interest start date</label><input id="from-${year}" type="date" value="${year + 1}-04-15" required></div>
      </div>`;
    priorInputs.set(year, fieldset);
  }
  return priorInputs.get(year);
}

function showPriorYears(years) {
  const container = el('prior-years');
  const fields = years.map(priorYearFields);
  if (fields.length !== container.children.length || fields.some((row, i) => row !== container.children[i])) {
    container.replaceChildren(...fields);
  }
}

function quarterlyRates() {
  const rates = { ...quarters2026 };
  for (const line of value('quarterly').split('\n').map(line => line.trim()).filter(Boolean)) {
    const match = /^(\d{4}-Q[1-4])\s+(\d+(?:\.\d+)?)$/.exec(line);
    if (!match || Object.hasOwn(rates, match[1]) || Number(match[2]) > 100) {
      throw new RangeError('Enter unique additional quarters and rates between 0 and 100, in the format 2027-Q1 7.');
    }
    rates[match[1]] = Number(match[2]);
  }
  return rates;
}

function simulateRecapture(plan) {
  const start = value('start');
  const bust = value('bust');
  const end = value('interest-end') || bust;
  if (!bust || yearOf(bust) > 2051 || bust < start || (value('interest-end') && end < bust)) {
    showPriorYears([]);
    throw new RangeError('Choose a modification date from the first payment through 2051 and an interest end date on or after modification.');
  }
  if (bust >= plan.lock.release) {
    showPriorYears([]);
    return 'The selected modification date is on or after the lock end. SEPP recapture is $0.00.';
  }
  const years = [];
  for (let year = yearOf(start); year < yearOf(bust) && `${year}-01-01` < plan.lock.halfBirthday; year++) {
    years.push(year);
  }
  showPriorYears(years);
  if (years.length === 0) return 'No prior tax years to recapture. The modification-year additional tax may still apply.';
  const fallback = value('fallback') === '' ? undefined : number('fallback');
  if (fallback !== undefined && (!Number.isFinite(fallback) || fallback < 0 || fallback > 100)) {
    throw new RangeError('Enter a fallback rate from 0% to 100% or leave it blank.');
  }

  let assumed = false;
  const rows = years.map(year => {
    const amountId = `amount-${year}`;
    const needsAmount = `${year}-12-31` >= plan.lock.halfBirthday;
    el(amountId).placeholder = needsAmount ? 'Enter amount before age 59½' : plan.amortization.toFixed(2);
    if (value(amountId) === '' && needsAmount) {
      throw new RangeError(`Enter the eligible taxable amount for ${year}, the year you reached 59½.`);
    }
    const useDefault = value(amountId) === '';
    assumed ||= useDefault;
    return { amount: useDefault ? Number(plan.amortization.toFixed(2)) : number(amountId), from: value(`from-${year}`) };
  });

  const charge = recapture({ active: true, rows, through: end, quarters: quarterlyRates(), fallback });
  const tax = `${assumed ? 'Example recapture tax' : 'Recapture tax'} ${money.format(charge.tax)}`;
  if (charge.total === null) return `${tax}. Interest and total unavailable until you supply all quarterly rates.`;
  const interestLabel = charge.projected ? 'Projected deferral interest' : 'Deferral interest using entered dates and rates';
  return `${tax} · ${interestLabel} ${money.format(charge.interest)} · ${assumed || charge.projected ? 'Projected total' : 'Total for entered inputs'} ${money.format(charge.total)}.`;
}

function update() {
  set('rate-limit', '');
  set('plan-error', '');
  let plan;
  try {
    plan = updatePlan();
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    el('plan-results').hidden = true;
    set('plan-error', error.message);
  }

  const pending = 'Complete the annual SEPP inputs to calculate this result.';
  show('carve-result', () => plan ? carveOut(plan) : pending);
  show('switch-result', () => plan ? switchToRmd(plan) : pending);
  show('recapture-result', () => plan ? simulateRecapture(plan) : pending);
  show('rule55-result', () => rule55(value('birth'), value('separation'), value('start'))
    ? 'The dates meet the general Rule of 55 timing test for a qualifying distribution from that employer’s plan.'
    : 'The dates do not meet the general Rule of 55 timing test.');
}

el('plan').addEventListener('submit', event => event.preventDefault());
document.querySelector('main').addEventListener('input', update);
update();
