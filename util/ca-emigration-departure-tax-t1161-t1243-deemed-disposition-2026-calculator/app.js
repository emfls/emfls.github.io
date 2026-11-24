import { calculateDepartureTax } from './model.mjs';

const form = document.querySelector('#departure-form');
const assets = document.querySelector('#assets');
const template = document.querySelector('#asset-template');
const results = document.querySelector('#results');
const error = document.querySelector('#input-error');
const fields = Object.fromEntries(
  [...results.querySelectorAll('[data-result]')].map(element => [element.dataset.result, element]),
);
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const capitalKinds = new Set(['capital', 'personal']);

function update() {
  const residentMonths = form.elements.residentMonths.valueAsNumber;
  const rows = [...assets.children].map((row, index) => {
    row.querySelector('legend').textContent = `Asset ${index + 1}`;
    const kind = row.querySelector('[data-kind]').value;
    const capital = capitalKinds.has(kind);
    const arrival = row.querySelector('[data-arrival]');
    const tcp = row.querySelector('[data-tcp]');
    const shortStayOptions = capital && residentMonths <= 60;
    arrival.closest('label').hidden = !shortStayOptions;
    tcp.closest('label').hidden = !shortStayOptions || !arrival.checked;

    const acb = row.querySelector('[data-acb]');
    const needsAcb = capital && !(shortStayOptions && arrival.checked);
    acb.closest('label').hidden = !needsAcb;
    acb.disabled = !needsAcb;
    return {
      kind,
      fmv: row.querySelector('[data-fmv]').valueAsNumber,
      acb: acb.valueAsNumber,
      preArrivalOrInherited: shortStayOptions && arrival.checked,
      taxableCanadianProperty: tcp.checked,
    };
  });

  const invalid = form.querySelector(':invalid:not(form):not(fieldset)');
  if (invalid) {
    error.textContent = `${invalid.labels[0].textContent.trim()} — ${invalid.validationMessage}`;
    results.hidden = true;
    for (const row of assets.children) row.querySelector('[data-asset-result]').textContent = '';
    return;
  }

  const estimate = calculateDepartureTax({
    province: form.elements.province.value,
    ytdCanadianIncome: form.elements.income.valueAsNumber,
    residentMonths,
    daysLate: form.elements.daysLate.valueAsNumber,
    assets: rows,
  });
  error.textContent = '';
  results.hidden = false;

  for (const key of [
    'totalTax', 'reportableFmv', 'latePenalty', 'netUnrealizedGain',
    'taxableCapitalGain', 'federalTax', 'provincialTax', 'excludedFmv', 'shortStayExemptFmv',
  ]) {
    fields[key].textContent = cad.format(estimate[key]);
  }
  fields.filingRequired.textContent = estimate.filingRequired ? 'Filing required' : 'Below or at filing threshold';
  const { threshold, securityRequired, federalSecurityEstimate } = estimate.deferral;
  fields.threshold.textContent = cad.format(threshold);
  fields.security.textContent = securityRequired ? 'Federal security indicated' : 'Federal security threshold not exceeded';
  fields.federalSecurityEstimate.textContent = cad.format(federalSecurityEstimate);
  fields.deferralAmount.textContent = cad.format(estimate.totalTax);

  estimate.assetResults.forEach(({ reportable, deemedDisposition, gain }, index) => {
    const report = reportable ? 'Counts toward T1161' : 'Excluded from T1161';
    const tax = deemedDisposition ? `Deemed gain or loss ${cad.format(gain)}` : 'Excluded from departure tax';
    assets.children[index].querySelector('[data-asset-result]').textContent = `${report} · ${tax}`;
  });
}

function addAsset(kind, fmv, acb) {
  const row = template.content.firstElementChild.cloneNode(true);
  row.querySelector('[data-kind]').value = kind;
  row.querySelector('[data-fmv]').value = fmv;
  row.querySelector('[data-acb]').value = acb;
  assets.append(row);
  return row;
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('click', event => {
  if (event.target.matches('[data-add]')) {
    const row = addAsset('capital', 0, 0);
    update();
    row.querySelector('[data-kind]').focus();
  }
  if (event.target.matches('[data-remove]')) {
    const row = event.target.closest('fieldset');
    const focusTarget = row.nextElementSibling?.querySelector('[data-remove]')
      ?? row.previousElementSibling?.querySelector('[data-remove]')
      ?? form.querySelector('[data-add]');
    row.remove();
    update();
    focusTarget.focus();
  }
});

addAsset('capital', 180000, 110000);
addAsset('canadianRealEstate', 620000, 0);
addAsset('retirement', 95000, 0);
addAsset('tfsa', 42000, 0);
update();
