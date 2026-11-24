import { apply2026Cola, claimingFactor, compareClaiming, withdrawalImpact } from './model.mjs';

const field = id => document.getElementById(id);
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const roundedDollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });

function write(id, value) {
  field(id).textContent = value;
}

function readNumber(id) {
  const input = field(id);
  if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) {
    const format = input.step === '1' ? 'a whole number' : 'a number';
    throw new RangeError(`Enter ${format} from ${Number(input.min).toLocaleString('en-US')} to ${Number(input.max).toLocaleString('en-US')} for “${input.labels[0].textContent}”.`);
  }
  return input.valueAsNumber;
}

function getPia() {
  const pia = readNumber('pia');
  return field('pia-year').value === 'before' ? apply2026Cola(pia) : pia;
}

function fillRows(id, rows) {
  const elements = rows.map(([label, ...values]) => {
    const row = document.createElement('tr');
    const title = document.createElement('th');
    title.scope = 'row';
    title.textContent = label;
    row.append(title);
    for (const value of values) row.insertCell().textContent = value;
    return row;
  });
  field(id).replaceChildren(...elements);
}

function paymentLabel(age) {
  const months = Math.round(age * 12);
  const years = Math.floor(months / 12);
  return `${years}y ${months % 12}m`;
}

function renderClaiming() {
  const totalAge = readNumber('total-age');
  const discountRate = readNumber('discount') / 100;
  const pia2026 = getPia();
  const { benefits, crossings } = compareClaiming({
    pia2026, futureCola: readNumber('future-cola') / 100, discountRate, totalAge,
  });
  write('benefit-caption', discountRate ? `Present value by age ${totalAge}` : `Gross benefits by age ${totalAge}`);
  fillRows('benefits', benefits.map(({ age, monthly, cumulative }) =>
    [age, dollars.format(monthly), roundedDollars.format(cumulative)]));
  fillRows('crossings', crossings.map(({ earlier, later, age, paymentAge }) => [
    `${earlier} vs ${later}`,
    age === null ? (pia2026 ? 'No catch-up by 120' : 'No benefits') : age.toFixed(2),
    paymentAge === null ? '—' : paymentLabel(paymentAge),
  ]));
}

function showField(id, visible) {
  const wrapper = field(`${id}-field`);
  wrapper.hidden = !visible;
  field(id).disabled = !visible;
}

function renderTax() {
  const status = field('filing').value;
  const claimAge = field('tax-claim').value;
  const itemized = field('deduction-method').value === 'itemized';
  const custom = claimAge === 'custom';
  showField('spouse', status === 'mfj');
  showField('itemized', itemized);
  showField('other-ss', !custom);
  showField('actual-ss', custom);
  field('mfs-note').hidden = !status.startsWith('mfs');

  const seniors = [field('senior').value];
  if (status === 'mfj') seniors.push(field('spouse').value);
  const annualSocialSecurity = custom
    ? readNumber('actual-ss')
    : readNumber('other-ss') + getPia() * claimingFactor(Number(claimAge) * 12) * 12;
  const impact = withdrawalImpact({
    status, annualSocialSecurity,
    otherIncome: readNumber('other-income'),
    traditionalIra: readNumber('ira'),
    muniInterest: readNumber('muni'),
    age65Count: seniors.filter(value => value !== 'under').length,
    eligibleSeniorCount: seniors.filter(value => value === 'eligible').length,
    itemizedDeduction: itemized ? readNumber('itemized') : null,
  });
  const { base } = impact;
  write('traditional-rate', percent.format(impact.traditionalRate));
  write('roth-rate', percent.format(impact.qualifiedRothRate));
  write('withdrawal-detail', `The extra withdrawal adds ${dollars.format(impact.additionalTaxableBenefit)} of taxable Social Security and reduces the senior deduction by ${dollars.format(impact.lostSeniorBonus)}.`);
  const rows = {
    'annual-ss': annualSocialSecurity,
    'extra-tax': impact.additionalTax,
    'provisional-income': base.provisionalIncome,
    'taxable-ss': base.taxableSocialSecurity,
    magi: base.magi,
    deduction: base.deduction,
    'senior-bonus': base.seniorBonus,
    'taxable-income': base.taxableIncome,
    'federal-tax': base.federalTax,
  };
  for (const [id, value] of Object.entries(rows)) write(id, dollars.format(value));
}

function render(section, calculate) {
  const results = field(`${section}-results`);
  try {
    calculate();
    write(`${section}-error`, '');
    results.hidden = false;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    results.hidden = true;
    write(`${section}-error`, error.message);
  }
}

function updateClaiming() {
  render('claim', renderClaiming);
}

function updateTax() {
  render('tax', renderTax);
}

field('claim-form').addEventListener('input', event => {
  updateClaiming();
  if (event.target.id === 'pia' || event.target.id === 'pia-year') updateTax();
});
field('tax-form').addEventListener('input', updateTax);
for (const form of document.querySelectorAll('form')) {
  form.addEventListener('submit', event => event.preventDefault());
}

updateClaiming();
updateTax();
