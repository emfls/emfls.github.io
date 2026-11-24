import { ANNUAL_EXCLUSION, ELECTION_YEARS, STATE_RULES, calculate } from './model.mjs';

const get = id => document.getElementById(id);
const value = id => get(id).value;
const numeric = id => get(id).valueAsNumber;
const show = (id, text) => { get(id).textContent = text; };
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = amount => dollars.format(Math.abs(amount) < 0.005 ? 0 : amount);
const form = get('calculator');
let previousGiftMode = value('giftMode');

function showGift(id, name, gift) {
  let message = `${name} — `;
  if (gift.election > 0) {
    message += `Form 709 election for ${money(gift.election)} in 2026 (${money(gift.election / ELECTION_YEARS)} allocated annually in total). Each electing donor files their own return.`;
  } else if (gift.split && gift.firstYearFiling) {
    message += 'Form 709 gift-splitting consent and reporting generally apply.';
  } else if (gift.firstYearFiling) {
    message += '2026 gifts exceed the modeled exclusion. Form 709 generally applies.';
  } else {
    message += 'The modeled gifts do not trigger Form 709 in 2026.';
  }
  const later = gift.rows.filter(row => row.year > 2026 && (row.excess > 0 || (gift.split && (row.other > 0 || (!gift.election && row.allocated > 0)))));
  if (later.length) message += ` Review Form 709 for ${later[0].year}${later.length > 1 ? ' and other later years' : ''}.`;
  message += gift.excess > 0
    ? ` ${money(gift.excess)} exceeds the annual exclusions across the modeled years and may use lifetime exemption.`
    : ' The modeled gifts use $0 of lifetime exemption.';
  show(id, message);
}

function update() {
  const state = value('state');
  const mode = value('giftMode');
  const cap = (mode === 'one' ? 1 : 2) * ANNUAL_EXCLUSION * ELECTION_YEARS;
  const oldCap = (previousGiftMode === 'one' ? 1 : 2) * ANNUAL_EXCLUSION * ELECTION_YEARS;
  if (mode !== previousGiftMode && numeric('total') === oldCap) get('total').value = cap;
  previousGiftMode = mode;
  show('gift-limit', `Five-year election ceiling for this donor arrangement is ${money(cap)} per beneficiary.`);

  const age = numeric('age');
  const years = get('years');
  if (Number.isInteger(age) && age >= 0 && age <= 13) {
    const max = 18 - age;
    if (max !== Number(years.max) && years.valueAsNumber > max) years.value = max;
    years.max = max;
    show('years-note', `5–${max} years at this age. The first deposit is today.`);
  }

  const custom = state === 'CUSTOM';
  const credit = state === 'IN' || (custom && value('customKind') === 'credit');
  document.querySelectorAll('.custom').forEach(field => { field.hidden = !custom; });
  get('rate-field').hidden = state === 'IN';
  get('liability-field').hidden = !credit;
  show('rate-label', credit ? 'Custom state credit rate (%)' : 'State marginal income tax rate (%)');
  show('cap-label', credit ? 'Custom annual credit cap (USD)' : 'Custom annual deduction cap (USD)');

  try {
    const result = calculate({
      state, giftMode: mode, filing: value('filing'), inState: value('inState') === 'yes',
      customKind: value('customKind'),
      ...Object.fromEntries(['total', 'age', 'years', 'returnRate', 'gainsRate', 'otherFirst', 'otherLater',
        'rate', 'customCap', 'customCarry', 'liability', 'expenses', 'planned', 'prior'].map(id => [id, numeric(id)]))
    });
    const { lump, spread, policy, k12 } = result;
    const installments = result.annual;
    const low = installments.at(-1);
    const high = installments[0];
    show('schedule', `Both strategies contribute ${money(result.total)}. The annual plan deposits ${money(low)}${low === high ? '' : `–${money(high)}`} each year for ${installments.length} years. Both balances are measured in ${result.horizon} years.`);
    show('extra', money(result.extraWealth));

    for (const [prefix, scenario] of [['lump', lump], ['annual', spread]]) {
      show(`${prefix}-balance`, money(scenario.balance));
      show(`${prefix}-gains`, money(scenario.gainsTax));
      show(`${prefix}-first`, money(scenario.state.first));
      show(`${prefix}-later`, money(scenario.state.later));
      show(`${prefix}-state`, money(scenario.state.total));
    }

    const carry = policy.carry === Infinity ? 'unlimited carryforward'
      : policy.carry ? `${policy.carry}-year carryforward` : 'zero carryforward years';
    show('state-rule', policy.eligible
      ? `${money(policy.cap)} annual ${policy.credit ? 'credit' : 'deduction'} cap, ${new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 4 }).format(policy.rate)} rate, ${carry}.`
      : 'The selected plan does not qualify for the modeled state benefit.');
    show('state-comparison', Math.abs(result.stateDifference) < 0.005
      ? 'The two strategies have the same estimated total state savings.'
      : `${result.stateDifference > 0 ? 'The lump sum saves' : 'Annual deposits save'} ${money(Math.abs(result.stateDifference))} more in projected state tax.`);

    showGift('lump-gift', 'Lump sum', lump.gift);
    showGift('annual-gift', 'Annual deposits', spread.gift);
    get('gift-rows').replaceChildren(...lump.gift.rows.map(row => {
      const tr = document.createElement('tr');
      const year = document.createElement('th');
      year.scope = 'row';
      year.textContent = row.year;
      tr.append(year);
      for (const amount of [row.allocated, row.other, row.remaining, row.excess]) {
        tr.insertCell().textContent = money(amount);
      }
      return tr;
    }));

    show('k12-result', `${money(k12.remainingLimit)} of the federal cap remains before the proposed withdrawal. ${money(k12.qualified)} of your planned withdrawal can be matched to eligible expenses within that cap.${k12.excess > 0 ? ` ${money(k12.excess)} exceeds the remaining cap or eligible expenses.` : ''}`);
    get('error').hidden = true;
    get('results').hidden = false;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    show('state-rule', '');
    show('error', error.message);
    get('error').hidden = false;
    get('results').hidden = true;
  }
}

form.addEventListener('input', event => {
  if (event.target === get('state')) get('rate').value = STATE_RULES[value('state')]?.rate ?? 6;
  update();
});
form.addEventListener('submit', event => { event.preventDefault(); });
update();
