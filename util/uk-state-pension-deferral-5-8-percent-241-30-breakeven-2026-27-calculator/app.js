import { calculateDeferral } from './model.mjs';

const form = document.querySelector('#pension-calculator');
const results = document.querySelector('#pension-results');
const error = document.querySelector('#pension-error');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const signedMoney = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', signDisplay: 'exceptZero'
});
const ageLabel = (age) => age === null ? 'Never at this return' : age.toFixed(2);
const input = (name) => {
  const value = form.elements.namedItem(name).value;
  return value === '' ? NaN : Number(value);
};
const display = (id, value) => {
  document.getElementById(id).textContent = value;
};

function update() {
  let estimate;
  try {
    estimate = calculateDeferral({
      pensionAge: input('pensionAge'),
      qualifyingNiYears: input('qualifyingNiYears'),
      deferralYears: input('deferralYears'),
      workingTaxRate: input('workingTaxRate'),
      retirementTaxRate: input('retirementTaxRate'),
      isaRealReturn: input('isaRealReturn')
    });
  } catch (problem) {
    error.textContent = problem.message;
    results.hidden = true;
    return;
  }

  error.textContent = '';
  display('pre-tax-age', ageLabel(estimate.preTaxBreakEvenAge));
  display('after-tax-age', ageLabel(estimate.afterTaxBreakEvenAge));
  display('isa-age', ageLabel(estimate.isaBreakEvenAge));
  const amounts = {
    'base-weekly': estimate.baseWeekly,
    'base-annual': estimate.baseAnnual,
    'boosted-weekly': estimate.boostedWeekly,
    'boosted-annual': estimate.boostedAnnual,
    'gross-missed': estimate.foregoneGross,
    'net-missed': estimate.foregoneNet,
    'weekly-extra': estimate.extraWeekly,
    'net-annual-extra': estimate.extraNetAnnual
  };
  for (const [id, amount] of Object.entries(amounts)) display(id, money.format(amount));
  display('uplift', (estimate.deferralBoostPct * 100).toFixed(2) + '%');
  display('claim-age', estimate.startClaimAge);
  for (const [age, gains] of [[85, estimate.gainsAt85], [90, estimate.gainsAt90]]) {
    for (const [basis, amount] of Object.entries(gains)) {
      display(basis + '-' + age, signedMoney.format(amount));
    }
  }

  const isaGain = estimate.gainsAt90.isa;
  const difference = money.format(Math.abs(isaGain));
  if (Math.abs(isaGain) < 0.005) {
    display('verdict', 'At age 90, the two strategies are level on the ISA assumptions.');
  } else if (isaGain > 0) {
    display('verdict', 'At age 90, deferring is ahead by ' + difference + ' on the ISA assumptions.');
  } else {
    display('verdict', 'At age 90, claiming at pension age and investing is ahead by ' +
      difference + ' on the ISA assumptions.');
  }
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
