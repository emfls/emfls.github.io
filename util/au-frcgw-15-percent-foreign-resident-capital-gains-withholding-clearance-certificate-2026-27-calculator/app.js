import { calculateSettlement, CERTIFICATE_LEAD_DAYS } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('frcgw-calculator');
const status = byId('status');
const estimate = byId('estimate');
const error = byId('input-error');
const amounts = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (amount) => `${amount < 0 ? '−' : ''}A$${amounts.format(Math.abs(amount))}`;
const setText = (id, text) => { byId(id).textContent = text; };

function showMessage(id, message) {
  const element = byId(id);
  element.textContent = message;
  element.hidden = !message;
}

function setField(wrapper, input, visible) {
  byId(wrapper).hidden = !visible;
  byId(input).disabled = !visible;
}

function certificateMessage(timing) {
  if (timing === 'valid') {
    return 'Give the buyer your valid certificate by settlement. Check that it is within 12 months of issue and covers the vendor on title.';
  }
  if (timing === 'urgent') {
    return `Fewer than ${CERTIFICATE_LEAD_DAYS} days remain. Apply now and tell your conveyancer so they can plan for withholding if your certificate is late.`;
  }
  if (timing === 'apply') {
    return `Apply now and allow at least ${CERTIFICATE_LEAD_DAYS} days for ATO processing. Give the buyer a valid certificate by settlement.`;
  }
  return '';
}

function showEstimate(result, hasVariation) {
  for (const key of ['withholding', 'netCash', 'shortfall', 'estimatedCgt', 'returnBalance']) {
    setText(key, money(Math.abs(result[key])));
  }
  setText('withholding-label', `FRCGW withheld at settlement (${result.withholdingPercent}%)`);
  const returnLabel = result.returnBalance > 0 ? 'Estimated refund from this sale'
    : result.returnBalance < 0 ? 'Estimated extra tax due from this sale' : 'Estimated tax-return balance from this sale';
  setText('return-label', returnLabel);
  byId('shortfall-card').classList.toggle('deficit', result.shortfall > 0);
  setText('settlement-breakdown', `Your share of the price is ${money(result.shareOfPrice)}. After ${money(result.shareOfCosts)} in costs and ${money(result.shareOfMortgage)} for the mortgage, your balance before withholding is ${money(result.settlementBalanceWithoutWithholding)}.`);
  setText('gain-breakdown', `Your estimated taxable gain is ${money(result.taxableGain)} after any relief selected above.`);

  const comparison = result.defaultReturnBalance > 0
    ? `exceeds estimated tax on the gain by ${money(result.defaultReturnBalance)}`
    : result.defaultReturnBalance < 0
      ? `falls short of estimated tax on the gain by ${money(-result.defaultReturnBalance)}`
      : 'matches estimated tax on the gain';
  showMessage('foreign-comparison', result.foreign
    ? `Default 15% withholding of ${money(result.defaultWithholding)} ${comparison}.` : '');
  showMessage('variation-savings', hasVariation
    ? `Your approved variation releases ${money(result.variationSavings)} at settlement compared with the 15% rate. Your tax credit decreases by the same amount.` : '');

  let shortfallMessage = '';
  if (result.shortfall > 0) {
    shortfallMessage = `You may need to bring ${money(result.shortfall)} to settlement to cover the mortgage and selling costs.`;
    if (result.settlementBalanceWithoutWithholding >= 0) {
      shortfallMessage += ' Withholding puts this settlement into shortfall.';
    }
  }
  const timingMessage = certificateMessage(result.certificateTiming);
  showMessage('shortfall-warning', shortfallMessage);
  showMessage('timing-warning', timingMessage);
  byId('settlement-warning').hidden = !(shortfallMessage || timingMessage);
  estimate.hidden = false;
}

function update() {
  const hasVariation = status.value === 'foreign_resident_variation';
  const resident = status.value === 'au_resident_with_cert' || status.value === 'au_resident_no_cert_trap';
  setField('resident-field', 'residentCgt', resident);
  setField('timing-field', 'daysToSettlement', status.value === 'au_resident_no_cert_trap');
  setField('variation-field', 'variationPercent', hasVariation);

  const data = { status: status.value, residentCgt: byId('residentCgt').value };
  const numberInputs = form.querySelectorAll('input[type="number"]:enabled');
  let invalidInput;
  for (const input of numberInputs) {
    input.setAttribute('aria-invalid', String(!input.validity.valid));
    data[input.name] = input.valueAsNumber;
    if (!input.validity.valid && !invalidInput) invalidInput = input;
  }
  if (invalidInput) {
    estimate.hidden = true;
    showMessage('input-error', `${invalidInput.labels[0].textContent}. ${invalidInput.validationMessage}`);
    return;
  }

  try {
    const result = calculateSettlement(data);
    error.hidden = true;
    showEstimate(result, hasVariation);
  } catch (err) {
    if (!(err instanceof RangeError)) throw err;
    estimate.hidden = true;
    showMessage('input-error', err.message);
  }
}

form.addEventListener('input', update);
form.addEventListener('change', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
