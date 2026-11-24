import { calculate } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('super-form');
const inputs = [...form.querySelectorAll('input[type="number"]')];
const formatter = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });
const money = amount => `${amount < 0 ? '−' : ''}A$${formatter.format(Math.abs(amount))}`;
const write = (id, value) => { byId(id).textContent = value; };

function renderHistory(result) {
  const rows = result.history.map(({ year, unused, used }) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = year;
    row.append(heading);
    for (const amount of [unused, used]) {
      const cell = document.createElement('td');
      cell.textContent = money(amount);
      row.append(cell);
    }
    return row;
  });
  byId('history-rows').replaceChildren(...rows);
  write('cap-use', `Current-year cap used: ${money(result.currentCapUsed)}. Eligible carry-forward cap: ${money(result.carryForward)}.`);
  byId('history-warning').hidden = !result.historyIsConservative;
}

function renderExpiry(result) {
  const before = money(result.expiringBeforeProposal);
  const after = money(result.expiringAtRisk);
  byId('expiry-warning').dataset.blocked = String(!result.eligible);
  if (!result.eligible) {
    write('expiry-title', 'Carry-forward blocked at A$500,000 or above');
    write('expiry-detail', `Your estimated unused 2021–22 cap of ${after} is unavailable in 2026–27 and expires on 30 June 2027. Your cap this year is A$32,500.`);
  } else if (result.expiringAtRisk > 0) {
    write('expiry-title', `${after} of 2021–22 cap will expire if unused`);
    write('expiry-detail', `You have ${before} left from 2021–22 before the lump sum. After all entered contributions, ${after} remains at risk on 30 June 2027.`);
  } else {
    write('expiry-title', 'No 2021–22 cap left to expire');
    write('expiry-detail', `Your entered history and contributions leave ${after} of 2021–22 cap unused at 30 June 2027.`);
  }
}

function update() {
  const invalidInputs = inputs.filter(input => {
    const amount = input.valueAsNumber;
    const invalid = !input.validity.valid || Math.round(amount * 100) / 100 !== amount;
    if (invalid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return invalid;
  });
  const [invalid] = invalidInputs;
  byId('input-error').hidden = !invalid;
  byId('estimate-values').hidden = Boolean(invalid);
  if (invalid) {
    write('input-error', `Enter an amount from A$0 to A$1 billion, to the nearest cent, for “${invalid.labels[0].textContent}”.`);
    write('update-status', '');
    return;
  }

  const result = calculate({
    totalSuperBalance30Jun2026: byId('balance').valueAsNumber,
    taxableIncome: byId('income').valueAsNumber,
    plannedContributions: byId('planned').valueAsNumber,
    proposedContribution: byId('proposed').valueAsNumber,
    priorContributions: [...form.elements.namedItem('prior')].map(input => input.valueAsNumber),
  });
  write('total-cap', money(result.totalCap));
  write('remaining-cap', money(result.remainingBeforeProposal));
  write('expiring-cap', money(result.expiringAtRisk));

  const { tax } = result;
  write('personal-savings', tax ? money(tax.personalTaxSavings) : 'Unavailable');
  write('super-tax', tax ? money(tax.superTax) : 'Unavailable');
  write('net-gain', tax ? money(tax.netGain) : 'Unavailable');
  write('tax-split', tax ? `Fund tax ${money(tax.fundTax)} · Extra Division 293 ${money(tax.division293)}` : '');
  write('tax-note', tax
    ? 'Tax figures show the change caused by the proposed lump sum.'
    : 'The proposed deduction exceeds the entered taxable income. Cap estimates still apply to the amounts entered.');

  renderExpiry(result);
  renderHistory(result);
  byId('excess-warning').hidden = result.excess === 0;
  write('excess-detail', result.excess > 0
    ? `Your entered contributions exceed your estimated cap by ${money(result.excess)}. The excess is added to assessable income with a 15% offset and may count towards your non-concessional cap if retained in super.`
    : '');
  write('update-status', `Available cap ${money(result.totalCap)}. Expiring cap ${money(result.expiringAtRisk)}. ${tax ? `Net tax gain ${money(tax.netGain)}.` : 'Tax estimate unavailable.'}`);
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
