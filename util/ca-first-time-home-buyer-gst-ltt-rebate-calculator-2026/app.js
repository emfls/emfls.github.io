import { calculate } from './model.mjs';

const element = id => document.getElementById(id);
const form = element('buyer-form');
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const amounts = {
  'closing-savings': 'closingSavings',
  'potential-relief': 'potentialRelief',
  'gst-rebate': 'gstRebate',
  'provincial-tax': 'provincialTax',
  'provincial-relief': 'provincialRelief',
  'municipal-tax': 'municipalTax',
  'municipal-relief': 'municipalRelief',
  'net-transfer-tax': 'netTransferTax',
  'title-fee': 'titleFee',
  'mortgage-fee': 'mortgageFee',
  'home-buyers-credit': 'homeBuyersCredit',
  fhsa: 'fhsa',
  hbp: 'hbp',
  'down-payment-pool': 'downPaymentPool',
};

function render() {
  const jurisdiction = element('jurisdiction').value;
  const home = element('home').value;
  const resale = home === 'resale';
  const ontario = jurisdiction === 'on';
  const bc = jurisdiction === 'bc';
  const alberta = jurisdiction === 'ab';
  const toronto = ontario && element('toronto').checked;
  const localRelief = ontario || bc;
  const price = element('price');
  const mortgage = element('mortgage');

  element('agreement-field').hidden = resale;
  element('federal-field').hidden = resale;
  element('toronto-field').hidden = !ontario;
  element('toronto-period-field').hidden = !toronto;
  element('mortgage-field').hidden = !alberta;
  element('transfer-field').hidden = !localRelief;
  element('bc-new-field').hidden = !bc || home !== 'new';
  element('transfer-timing-field').hidden = !localRelief;
  element('gross-provincial-row').hidden = !localRelief;
  element('relief-provincial-row').hidden = !localRelief;
  element('gross-municipal-row').hidden = !toronto;
  element('relief-municipal-row').hidden = !toronto;
  element('title-row').hidden = !alberta;
  element('mortgage-row').hidden = !alberta;

  const error = element('input-error');
  const results = element('results');
  const agreement = element('agreement');
  const inputs = [
    [price, 'Enter a purchase value from $0.01 to $1 billion with up to two decimal places.'],
    ...(alberta ? [[mortgage, 'Enter a mortgage principal from $0 to $1 billion with up to two decimal places.']] : []),
    ...(!resale ? [[agreement, 'Enter a valid builder agreement date.']] : []),
  ];

  for (const field of [price, mortgage, agreement]) field.removeAttribute('aria-invalid');
  const invalid = inputs.find(([field]) => !field.validity.valid);
  if (invalid) {
    const [field, message] = invalid;
    field.setAttribute('aria-invalid', 'true');
    results.hidden = true;
    error.hidden = false;
    error.textContent = message;
    return;
  }

  let estimate;
  try {
    estimate = calculate({
      price: price.valueAsNumber,
      jurisdiction,
      home,
      agreement: agreement.value,
      buyers: Number(element('buyers').value),
      federalEligible: element('federal-eligible').checked,
      transferEligible: element('transfer-eligible').checked,
      bcNewEligible: element('bc-new-eligible').checked,
      creditEligible: element('credit-eligible').checked,
      toronto,
      torontoPeriod: element('toronto-period').value,
      gstAtClosing: element('gst-at-closing').checked,
      transferAtClosing: element('transfer-at-closing').checked,
      mortgage: alberta ? mortgage.valueAsNumber : 0,
    });
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    results.hidden = true;
    error.hidden = false;
    error.textContent = exception.message;
    return;
  }

  element('provincial-label').textContent = bc ? 'BC property transfer tax' : 'Ontario land transfer tax';
  element('relief-label').textContent = bc
    ? { new: 'BC newly built home exemption', 'first-time': 'BC first-time buyer exemption' }[estimate.bcExemption]
      ?? 'BC property transfer tax exemption'
    : 'Ontario first-time buyer refund';

  const notes = [];
  if (resale) {
    notes.push('Ordinary resale homes receive no first-time buyer GST rebate.');
  } else if (!agreement.value || agreement.value < '2025-03-20' || agreement.value >= '2031-01-01') {
    notes.push('The federal estimate requires an original builder agreement dated March 20, 2025 through December 31, 2030.');
  }
  if (estimate.gstRebate > 0 && !element('gst-at-closing').checked) {
    notes.push('The federal GST estimate is treated as a later rebate.');
  }
  if ((estimate.provincialRelief > 0 || estimate.municipalRelief > 0) && !element('transfer-at-closing').checked) {
    notes.push('Transfer tax relief is treated as a later refund.');
  }
  if (jurisdiction === 'other') {
    notes.push('Totals cover federal programs only. Check local transfer taxes and registration fees.');
  }
  element('estimate-note').textContent = notes.join(' ');
  element('estimate-note').hidden = notes.length === 0;

  error.hidden = true;
  error.textContent = '';
  results.hidden = false;
  for (const [id, key] of Object.entries(amounts)) {
    const value = estimate[key] === null ? 'N/A' : money.format(estimate[key]);
    if (element(id).textContent !== value) element(id).textContent = value;
  }
}

form.addEventListener('input', render);
form.addEventListener('submit', event => event.preventDefault());
render();

// A manual unit can be requested once its publisher-specific slot is configured.
for (const slot of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (slot.dataset.adSlot) (window.adsbygoogle = window.adsbygoogle || []).push({});
}
