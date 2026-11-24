import { estimateSale } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('sale-form');
const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', currencyDisplay: 'code'
});
const format = amount => amount === null ? '—' : currency.format(amount);

function readNumber(id, optional = false) {
  const input = byId(id);
  if (!input.validity.valid || (!optional && input.value === '')) {
    const label = input.labels[0].textContent;
    throw new RangeError(`Check "${label}" and enter a number within the allowed range.`);
  }
  return input.value === '' ? null : input.valueAsNumber;
}

function toggle(id, visible) {
  const group = byId(id);
  group.hidden = !visible;
  for (const field of group.querySelectorAll('input')) field.disabled = !visible;
  if (group instanceof HTMLFieldSetElement) group.disabled = !visible;
}

function render(result, quebec) {
  const totals = {
    'gross-holdback': result?.grossHoldback,
    'certificate-remittance': result?.certificateRemittance,
    'cash-released': result?.cashReleased,
    'cra-refund': result?.cra.refund,
    'quebec-refund': result?.qc.refund,
    'late-penalty': result?.latePenalty
  };
  for (const [id, amount] of Object.entries(totals)) byId(id).textContent = format(amount ?? null);
  for (const [prefix, account] of [['cra', result?.cra], ['qc', quebec ? result?.qc : null]]) {
    for (const [key, amount] of Object.entries({
      holdback: account?.holdback, certificate: account?.certificate, tax: account?.tax,
      balance: account?.balanceDue, penalty: account?.penalty
    })) byId(`${prefix}-${key}`).textContent = format(amount ?? null);
  }
}

function update() {
  const property = byId('property').value;
  const quebec = byId('quebec').checked;
  const hypothetical35 = byId('hypothetical35').checked;
  const rental = property === 'rental';
  const special = property !== 'capital';
  toggle('building-fields', rental);
  toggle('certificate-fields', special);
  toggle('quebec-payment', special && quebec);
  toggle('cra-days', property !== 'inventory');
  toggle('quebec-days', quebec && property !== 'inventory');
  byId('quebec-refund-card').hidden = !quebec;
  byId('scenario').hidden = !hypothetical35;
  byId('cost-label').textContent = property === 'inventory' ? 'Inventory cost' : 'Adjusted cost base';

  const error = byId('error');
  const note = byId('calculation-note');
  try {
    const result = estimateSale({
      property, quebec, hypothetical35, grossRemitted: byId('payment').value === 'gross',
      proceeds: readNumber('proceeds'), costBase: readNumber('costBase'),
      commission: readNumber('commission'), legalFees: readNumber('legalFees'),
      otherIncome: readNumber('otherIncome'),
      daysToCra: property === 'inventory' ? 0 : readNumber('daysToCra'),
      daysToQuebec: quebec && property !== 'inventory' ? readNumber('daysToQuebec') : 0,
      buildingProceeds: rental ? readNumber('buildingProceeds') : 0,
      buildingCost: rental ? readNumber('buildingCost') : 0,
      recapture: rental ? readNumber('recapture', true) : null,
      federalSpecialPayment: special ? readNumber('federalSpecialPayment', true) : null,
      quebecSpecialPayment: special && quebec ? readNumber('quebecSpecialPayment', true) : null
    });
    render(result, quebec);
    const messages = [];
    if (result.taxableIncome !== null) messages.push(`Taxable income added by the sale is ${format(result.taxableIncome)}.`);
    if (result.certificateRemittance === null) messages.push('Enter the applicable special-property payments to estimate combined certificate cash flow.');
    if (result.taxableIncome === null) messages.push('Enter the building’s CCA recapture to estimate final tax.');
    if (result.cashReleased < 0) messages.push('The certificate estimate exceeds the gross holdback by the difference shown.');
    note.textContent = messages.join(' ');
    error.hidden = true;
    error.textContent = '';
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    render(null, quebec);
    note.textContent = '';
    error.textContent = problem.message;
    error.hidden = false;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
