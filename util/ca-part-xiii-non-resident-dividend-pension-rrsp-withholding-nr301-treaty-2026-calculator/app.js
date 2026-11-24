import { calculate, INCOME, PRESETS } from './model.mjs';

const element = (id) => document.getElementById(id);
const form = element('tax-form');
const formatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const money = (value) => formatter.format(value);
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 2 });
const retirement = ['pension', 'rrif', 'rrsp', 'social'];

function numeric(id) {
  const input = element(id);
  if (input.disabled) return 0;
  if (!input.validity.valid) {
    input.setAttribute('aria-invalid', 'true');
    throw new RangeError(`Check the amount entered for “${input.labels[0].textContent}”.`);
  }
  return input.valueAsNumber;
}

function render() {
  const country = element('country').value;
  const corporate = element('recipient').value === 'corporate';
  const documented = country !== 'NONE' && element('documented').checked;
  const votingRequired = corporate && country !== 'NONE';
  element('documented').disabled = country === 'NONE';
  element('ireland-group').hidden = country !== 'IE' || !documented || corporate;
  element('voting-group').hidden = !votingRequired;
  element('voting').disabled = !votingRequired;
  element('japan-group').hidden = country !== 'JP' || !corporate;
  element('voting-note').textContent = votingRequired ? `This preset requires at least ${PRESETS[country].voting}%.` : '';

  for (const id of retirement) {
    element(id).disabled = corporate;
    element(id).parentElement.hidden = corporate;
  }
  element('election-group').hidden = corporate;
  element('election-group').disabled = corporate;
  const rrifGroup = element('rrif-group');
  rrifGroup.hidden = corporate || element('rrif').valueAsNumber === 0;
  rrifGroup.disabled = rrifGroup.hidden;
  for (const input of form.querySelectorAll('[aria-invalid]')) input.removeAttribute('aria-invalid');

  let result;
  try {
    result = calculate({
      country, documented, corporate,
      voting: numeric('voting'),
      japanHoldingMet: element('japan-holding-met').checked,
      irelandAuthorized: !element('ireland-group').hidden && element('ireland-authorized').checked,
      royaltyType: element('royalty-type').value,
      ...Object.fromEntries(Object.keys(INCOME).map((key) => [key, numeric(key)])),
      rrifMinimum: rrifGroup.disabled ? 0 : numeric('rrif-minimum'),
      rrifValue: rrifGroup.disabled ? 0 : numeric('rrif-value'),
      payments: rrifGroup.disabled ? 12 : numeric('payments'),
      otherWorldIncome: corporate ? 0 : numeric('other-world-income'),
      actualWithheld: corporate || (!element('actual-withheld').value && !element('actual-withheld').validity.badInput)
        ? null : numeric('actual-withheld'),
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    element('error').textContent = error.message;
    element('results').hidden = true;
    return;
  }

  element('error').textContent = '';
  element('results').hidden = false;
  element('statutory-tax').textContent = money(result.statutoryTax);
  element('treaty-tax').textContent = money(result.treatyTax);
  element('treaty-savings').textContent = money(result.treatySavings);
  const status = documented ? 'Treaty evidence accepted.' : 'Statutory rates applied.';
  const irishNote = result.nr5Reduction
    ? ` The Irish authorization lowers withholding by a further ${money(result.nr5Reduction)}.`
    : country === 'IE' && result.irishRelief
      ? ` The Irish exemption could reduce withholding by a further ${money(result.irishRelief)} with CRA authorization.`
      : '';
  element('applied').textContent = `Estimated withholding under your selection is ${money(result.appliedTax)}. ${status}${irishNote}`;

  const rows = result.lines.map(({ key, amount, statutory, treaty }) => {
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = INCOME[key];
    row.append(label);
    for (const value of [amount, statutory, treaty]) {
      const cell = document.createElement('td');
      cell.textContent = money(value);
      row.append(cell);
    }
    return row;
  });
  element('withholding-rows').replaceChildren(...rows);

  const { plan, rrifComparison: comparison, election } = result;
  element('rrif-comparison').textContent = rrifGroup.disabled
    ? 'Enter an annual RRIF amount to compare the same gross withdrawal from both accounts.'
    : `Lump-sum RRSP ${money(comparison.lumpTax)} · Scheduled RRIF ${money(comparison.rrifTax)} · Withholding saved ${money(comparison.savings)}.`;
  element('rrif-threshold').textContent = rrifGroup.disabled ? ''
    : `Annual periodic limit ${money(plan.limit)}. Your schedule has ${money(plan.periodic)} in periodic payments and ${money(plan.nonPeriodic)} in non-periodic payments.`;
  let refund = 'No retirement income eligible for Section 217 in this scenario.';
  let refundDetail = '';
  if (election) {
    refund = election.balanceDue ? `${money(election.balanceDue)} estimated balance due with the election.`
      : `${money(election.refund)} estimated potential refund.`;
    const verdict = election.savings ? `Estimated tax savings from electing are ${money(election.savings)}.`
      : 'The election does not lower the modeled tax due. If the payer withheld too much under the treaty, see Form NR7-R.';
    refundDetail = `${percent.format(election.incomeShare)} of net world income is included on the modeled return. Estimated graduated tax is ${money(election.tax)} after the basic credit and Section 217 adjustment. ${verdict}`;
  }
  element('refund').textContent = refund;
  element('refund-detail').textContent = refundDetail;
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', render);
render();
