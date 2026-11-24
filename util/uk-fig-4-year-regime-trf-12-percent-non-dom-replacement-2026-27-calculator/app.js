import { checkIht, compareFig, compareTrf } from './model.mjs';

const form = document.getElementById('calculator');
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const byId = id => document.getElementById(id);
const write = (id, value) => { byId(id).textContent = value; };
const money = value => value == null ? '—' : gbp.format(value);
const yes = id => byId(id).value === 'yes';
const numericFields = [...form.querySelectorAll('input[type="number"]')];

function renderFig(fig, valid) {
  write('fig-standard', money(fig?.standard?.total));
  write('fig-claim', money(fig?.withClaim?.total));

  const savings = fig?.claimSavings;
  let effect = '—';
  if (savings != null) {
    effect = savings === 0 ? 'Same tax' :
      savings > 0 ? `${money(savings)} less` : `${money(-savings)} more`;
  }
  write('fig-savings', effect);

  let message = 'Enter a valid amount or tax year in the highlighted field.';
  if (valid) {
    if (!fig.standard) message = 'The tax comparison covers UK residents.';
    else if (!fig.eligible) message = 'The residence details entered fall outside the four-year FIG window.';
    else if (!fig.withClaim) message = 'You meet the residence screen. Enter qualifying amounts to compare a claim.';
    else {
      message = `Without the claim, your Personal Allowance is ${money(fig.standard.personalAllowance)} and your CGT annual exemption is ${money(fig.standard.annualExemptAmount)}. A claim removes both allowances.`;
    }
  }
  write('fig-status', message);
}

function renderTrf(trf, valid, formerUser) {
  write('trf-now', money(trf?.taxNow));
  write('trf-later', money(trf?.taxLater));
  write('trf-standard', money(trf?.standardTax));
  write('trf-deadline', money(trf?.deadlineSavings));
  write('trf-savings', money(trf?.standardSavings));

  let message = 'Correct the highlighted inputs to update this comparison.';
  if (valid) {
    if (!formerUser) message = 'TRF requires previous use of the remittance basis.';
    else if (trf.taxNow == null || trf.taxLater == null) {
      message = 'The designation rate is available only for a year in which you are UK tax resident.';
    } else if (trf.standardSavings < 0) {
      message = `In this scenario, standard remittance costs ${money(-trf.standardSavings)} less than a 12% TRF designation.`;
    } else message = '';
  }
  write('trf-status', message);
}

const residenceFields = Array.from({ length: 29 }, (_, index) => {
  const start = 2025 - index;
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = index === 0;
  const year = `${start}/${String(start + 1).slice(-2)}`;
  label.append(checkbox, year);
  byId(index < 20 ? 'iht-years' : 'iht-older-years').append(label);
  return checkbox;
});

function renderIht() {
  const result = checkIht(residenceFields.map(input => input.checked));
  write('iht-count', `${result.previous20} of 20`);
  write('iht-status', result.longTermResident ? 'Yes' : 'No');
  write('iht-tail', result.tail ? `${result.tail} years` : '—');
  let scope = 'Under the general test, outright overseas assets are outside UK IHT based on this residence history.';
  if (result.longTermResident) {
    scope = 'Under the general test, outright overseas assets are generally within UK IHT scope.';
    if (!yes('ukResident')) {
      scope += ` The general departure tail has ${result.tailRemaining} tax year${result.tailRemaining === 1 ? '' : 's'} left, including 2026/27.`;
    }
  }
  write('iht-scope', scope);
}

function calculate() {
  const values = {};
  const invalid = new Set();
  for (const field of numericFields) {
    const isInvalid = !field.validity.valid;
    field.setAttribute('aria-invalid', String(isInvalid));
    if (isInvalid) invalid.add(field.id);
    values[field.id] = field.value === '' ? 0 : field.valueAsNumber;
  }
  const ukResident = yes('ukResident');
  const formerUser = yes('formerUser');
  const figValid = [...invalid].every(id => id === 'legacyIncome' || id === 'legacyGains');
  const trfValid = [...invalid].every(id => id === 'windowYear' || id === 'yearsBeforeArrival');
  renderFig(figValid ? compareFig({ ...values, ukResident }) : null, figValid);
  renderTrf(trfValid ? compareTrf({ ...values, ukResident, formerUser, residentNextYear: yes('residentNextYear') }) : null, trfValid, formerUser);
  renderIht();
}

form.addEventListener('input', calculate);
form.addEventListener('submit', event => event.preventDefault());
calculate();
