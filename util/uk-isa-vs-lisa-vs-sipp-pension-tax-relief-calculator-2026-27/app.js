import { compare, lisaWithdrawal } from './model.mjs';

const byId = id => document.getElementById(id);
const number = id => byId(id).valueAsNumber;
const rate = id => Number(byId(id).value);
const checked = id => byId(id).checked;
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percentage = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const money = amount => currency.format(amount);
const write = (id, value) => { byId(id).textContent = value; };

function setFieldVisibility(id, visible) {
  const field = byId(id);
  field.hidden = !visible;
  for (const control of field.querySelectorAll('input, select')) control.disabled = !visible;
  if (field instanceof HTMLFieldSetElement) field.disabled = !visible;
}

function validationMessage(form) {
  const invalid = [...form.elements].find(control => control.willValidate && !control.validity.valid);
  if (!invalid) return '';
  const label = invalid.labels[0].textContent;
  return `${label}: ${invalid.validationMessage}`;
}

function updateComparison() {
  const salarySacrifice = checked('salarySacrifice');
  const lisaExit = byId('lisaExit').value;
  setFieldVisibility('home-price-field', lisaExit === 'home');
  setFieldVisibility('salary-fields', salarySacrifice);
  setFieldVisibility('earnings-field', !salarySacrifice);

  const error = validationMessage(byId('comparison'));
  write('comparison-error', error);
  byId('cards').hidden = Boolean(error);
  if (error) {
    write('winner', '');
    return;
  }

  const { isa, lisa, pension, winners, endAge, lisaYears, actualLisaExit } = compare({
    budget: number('budget'),
    age: number('age'),
    years: number('years'),
    annualReturn: number('annualReturn') / 100,
    relief: rate('relief'),
    retirementTax: rate('retirementTax'),
    hasLisa: checked('hasLisa'),
    lisaExit,
    price: number('price'),
    salarySacrifice,
    employeeNI: rate('employeeNI'),
    shareEmployerNI: checked('shareEmployerNI'),
    sacrificeLimit: number('sacrificeLimit'),
    relevantEarnings: number('relevantEarnings'),
    pensionHeadroom: number('pensionHeadroom'),
    remainingLSA: number('remainingLSA'),
    mpaa: checked('mpaa'),
    thresholdIncome: number('thresholdIncome'),
    adjustedIncome: number('adjustedIncome')
  });
  const labels = {
    isa: 'Stocks & Shares ISA',
    lisa: 'Lifetime ISA strategy',
    pension: salarySacrifice ? 'Workplace pension strategy' : 'SIPP strategy'
  };
  const winnerNames = winners.map(key => labels[key]);
  const headline = winners.length === 1 ? `Highest spendable balance: ${winnerNames[0]}`
    : `Tie: ${new Intl.ListFormat('en-GB').format(winnerNames)}`;
  write('winner', `${headline} at age ${endAge} (${money({ isa, lisa, pension }[winners[0]].total)}).`);
  for (const key of Object.keys(labels)) {
    byId(`${key}-card`).toggleAttribute('data-winner', winners.includes(key));
  }

  const values = {
    'isa-total': isa.total,
    'isa-first': isa.firstDeposit,
    'isa-cash': isa.cash,
    'lisa-total': lisa.total,
    'lisa-first': lisa.firstDeposit,
    'lisa-account': lisa.account,
    'lisa-charge': lisa.charge,
    'lisa-excess': lisa.isaBalance + lisa.cash,
    'pension-total': pension.total,
    'pension-first': pension.firstDeposit,
    'pension-account': pension.account,
    'pension-free': pension.withdrawal.taxFree,
    'pension-tax': pension.withdrawal.tax,
    'pension-excess': pension.isaBalance + pension.cash
  };
  for (const [id, value] of Object.entries(values)) write(id, money(value));

  let lisaNote = `Lifetime ISA funded for ${lisaYears} of ${number('years')} years.`;
  if (lisaExit === 'later' && actualLisaExit === 'early' && lisa.account > 0) {
    lisaNote += ' The horizon ends before age 60, so the 25% charge applies.';
  }
  if (number('age') >= 40 && !checked('hasLisa')) {
    lisaNote = 'A new Lifetime ISA is unavailable at this age. This strategy uses the standard ISA allowance.';
  }
  write('lisa-note', lisaNote);
  write('pension-title', labels.pension);
  byId('pension-note').hidden = !pension.locked;
  write('pension-note', pension.locked
    ? `Pension locked until age ${pension.minimumAge} under normal access rules. Estimated pension after tax once accessible, using the horizon value: ${money(pension.withdrawal.net)}.`
    : '');
}

function updateSimulator() {
  const exit = byId('sim-exit').value;
  setFieldVisibility('sim-price-field', exit === 'home');
  setFieldVisibility('sim-date-field', exit === 'home');
  const error = validationMessage(byId('simulator'));
  write('sim-error', error);
  byId('sim-output').hidden = Boolean(error);
  if (error) return;

  const { bonus, pot, charge, net, rate: chargeRate, gain, gainRate } = lisaWithdrawal(
    number('sim-deposit'), exit, number('sim-price'), byId('sim-date').value
  );
  const difference = gain < 0 ? 'less than' : 'more than';
  const outcome = gain === 0 ? 'Equal to your original contribution.'
    : `${money(Math.abs(gain))} ${difference} you contributed (${percentage.format(Math.abs(gainRate))}).`;
  write('sim-output', `Bonus ${money(bonus)} · Pot before charge ${money(pot)} · Charge ${money(charge)} (${percentage.format(chargeRate)})\nYou receive ${money(net)}. ${outcome}`);
}

for (const [id, update] of [['comparison', updateComparison], ['simulator', updateSimulator]]) {
  const form = byId(id);
  form.addEventListener('input', update);
  form.addEventListener('submit', event => event.preventDefault());
  update();
}

for (const ad of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (ad.dataset.adSlot) (window.adsbygoogle ||= []).push({});
}
