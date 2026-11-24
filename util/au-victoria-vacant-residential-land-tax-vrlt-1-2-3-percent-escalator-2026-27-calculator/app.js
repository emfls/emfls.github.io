import { estimateHoldingCosts } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('vrlt-form');
const field = name => form.elements.namedItem(name);
const number = name => field(name).valueAsNumber;
const value = name => field(name).value;
const checked = name => field(name).checked;
const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent' });

const statusLabels = {
  'eligible': 'Meets the checklist · exemption assumed',
  'review': 'SRO review needed · VRLT included',
  'criteria-unmet': 'Eligibility criteria unmet',
  'not-claimed': 'No holiday-home claim selected',
  'not-applicable': 'Applies to dwellings only',
};

function showFields(id, show) {
  const group = byId(id);
  group.hidden = !show;
  group.disabled = !show;
}

function update() {
  const propertyType = value('propertyType');
  const dwelling = propertyType === 'dwelling';
  const taxYear = Number(value('taxYear'));
  const stack = value('stack');
  const genuineHoliday = dwelling && checked('genuineHoliday');
  showFields('dwelling-fields', dwelling);
  showFields('land-fields', !dwelling);
  showFields('holiday-fields', genuineHoliday);
  showFields('site-fields', stack !== 'none');
  showFields('rental-fields', dwelling);
  byId('occupancy-year').textContent = taxYear - 1;
  byId('notification-date').textContent = `15 February ${taxYear}`;
  byId('tax-stack-note').textContent = stack === 'none'
    ? 'VRLT only. General land tax and the surcharge are excluded.'
    : 'Includes estimated taxes at the selected general land tax rates.';

  const invalid = Array.from(form.elements).find(control => control.willValidate && !control.validity.valid);
  byId('results').hidden = Boolean(invalid);
  byId('input-error').hidden = !invalid;
  if (invalid) {
    const label = invalid.labels[0].textContent;
    byId('input-error').textContent = `${label}: ${invalid.validationMessage}`;
    return;
  }

  const result = estimateHoldingCosts({
    propertyType, taxYear, stack, genuineHoliday,
    civ: number('civ'),
    vacancyMonths: number('vacancyMonths'),
    liabilityYear: Number(value('liabilityYear')),
    developableMetro: checked('developableMetro'),
    undevelopedYears: number('undevelopedYears'),
    adjoiningExemption: checked('adjoiningExemption'),
    australianPpr: checked('australianPpr'),
    holidayDays: number('holidayDays'),
    notification: value('notification'),
    siteValue: number('siteValue'),
    rentalMonths: number('rentalMonths'),
    monthlyRent: number('monthlyRent'),
    rentalCosts: number('rentalCosts'),
  });

  byId('annual-tax').textContent = aud.format(result.vrlt);
  byId('annual-rate').textContent = `${percent.format(result.rate)} of CIV · ${taxYear} tax year`;
  byId('total-tax').textContent = aud.format(result.total);
  byId('holiday-status').textContent = statusLabels[result.holidayStatus];
  byId('holiday-status').dataset.status = result.holidayStatus;
  byId('land-tax').textContent = aud.format(result.landTax);
  byId('surcharge').textContent = aud.format(result.surcharge);
  for (const [index, row] of result.schedule.entries()) {
    const cells = byId('schedule').rows[index].cells;
    cells[0].textContent = row.year;
    cells[1].textContent = percent.format(row.rate);
    cells[2].textContent = aud.format(row.tax);
    cells[3].textContent = aud.format(row.cumulative);
  }

  byId('rental-result').hidden = !result.rental;
  if (result.rental) {
    const { netIncome, vrltAvoided, rentalTax, cashSwing } = result.rental;
    byId('net-rent').textContent = aud.format(netIncome);
    byId('vrlt-avoided').textContent = aud.format(vrltAvoided);
    byId('rental-tax').textContent = aud.format(rentalTax);
    byId('cash-swing').textContent = aud.format(cashSwing);
  }
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
update();
