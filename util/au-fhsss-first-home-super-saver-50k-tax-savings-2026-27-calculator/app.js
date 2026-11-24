import { calculateFHSS } from './model.mjs';

const element = id => document.getElementById(id);
const form = element('fhss-form');
const partner = element('buyer-2');
const error = element('input-error');
const results = element('results');
const money = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', currencyDisplay: 'code'
});
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 2 });

const resultFields = {
  'net-release': 'netRelease',
  'bank-savings': 'bankSavings',
  'deposit-boost': 'boost',
  eligible: 'eligible',
  'concessional-principal': 'concessionalPrincipal',
  'non-concessional-principal': 'nonConcessionalPrincipal',
  earnings: 'associatedEarnings',
  'gross-release': 'grossRelease',
  assessable: 'assessable',
  'withdrawal-tax': 'withdrawalTax',
  'overflow-bank': 'overflowBank',
  'strategy-deposit': 'strategyDeposit'
};

function readBuyer(index) {
  return {
    salary: element(`salary-${index}`).valueAsNumber,
    concessional: element(`concessional-${index}`).valueAsNumber,
    nonConcessional: element(`after-tax-${index}`).valueAsNumber,
    otherConcessional: element(`other-${index}`).valueAsNumber,
    medicare: Number(element(`medicare-${index}`).value)
  };
}

function update() {
  const couple = element('buyer-count').value === '2';
  partner.disabled = partner.hidden = !couple;
  let firstInvalid;
  for (const input of form.querySelectorAll('input')) {
    const invalid = !input.validity.valid;
    input.toggleAttribute('aria-invalid', invalid);
    if (invalid && !firstInvalid) firstInvalid = input;
  }

  let estimate;
  try {
    if (firstInvalid) {
      throw new RangeError(`${firstInvalid.labels[0].textContent} — ${firstInvalid.validationMessage}`);
    }
    estimate = calculateFHSS({
      buyers: couple ? [readBuyer(1), readBuyer(2)] : [readBuyer(1)],
      years: Number(element('years').value),
      sic: element('sic').valueAsNumber,
      bank: element('bank').valueAsNumber
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    results.hidden = true;
    error.textContent = problem.message;
    error.hidden = false;
    return;
  }

  for (const [id, key] of Object.entries(resultFields)) {
    element(id).textContent = money.format(estimate[key]);
  }
  element('deposit-boost').toggleAttribute('data-negative', estimate.boost < -0.005);
  element('boost-note').textContent = `FHSS path total: ${money.format(estimate.strategyDeposit)}, including ${money.format(estimate.overflowBank)} saved in the bank from unused budget.`;
  element('buyer-summary').textContent = estimate.people.map((person, index) =>
    `Buyer ${index + 1}: ${money.format(person.eligible)} eligible contributions, ${money.format(person.employerSG)} estimated annual SG, ${money.format(person.capRoom)} annual concessional cap room and ${percent.format(person.rate)} estimated release tax rate.`
  ).join(' ');

  const overCap = estimate.people.flatMap((person, index) => person.concessionalCapExceeded ? [`Buyer ${index + 1}`] : []);
  const warning = element('cap-warning');
  warning.hidden = overCap.length === 0;
  warning.textContent = overCap.length
    ? `Concessional cap check: ${overCap.join(' and ')} would exceed AUD 32,500 per year if the full pre-tax budget went into super alongside employer and other concessional contributions. The estimate keeps unused budget in the bank.`
    : '';
  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
