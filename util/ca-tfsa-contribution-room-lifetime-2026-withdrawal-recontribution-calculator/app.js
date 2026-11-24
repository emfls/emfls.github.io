import {
  calculateTfsa, excessTax, parseNonResidentYears, PROJECTED_2027_LIMIT
} from './model.mjs';

const byId = id => document.getElementById(id);
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const dollars = amount => money.format(amount);
const form = byId('tfsa-form');
const fields = [...form.querySelectorAll('input[type="number"]')];
const results = byId('calc-results');
const error = byId('calc-error');
const breakdown = byId('breakdown');
const years = byId('years');
const monthlyPeaks = byId('monthlyPeaks');
const months = byId('monthsExcessRemains');

function readNumber(input) {
  if (!input.validity.valid) {
    input.setAttribute('aria-invalid', 'true');
    const label = input.labels[0].textContent;
    throw new RangeError(`${label}: enter a valid number between ${input.min} and ${input.max} with a step of ${input.step}.`);
  }
  input.removeAttribute('aria-invalid');
  return input.valueAsNumber;
}

function readMonthlyTax(value) {
  const peaks = value.split(',').map(item => {
    const amount = item.trim();
    if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(amount)) {
      throw new RangeError('Enter monthly peaks as non-negative amounts with up to two decimals, separated by commas.');
    }
    return Number(amount);
  });
  return excessTax(peaks);
}

function renderBreakdown(rows) {
  const entries = rows.map(({ year, limit, reason, earned, cumulative }) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = year;
    row.append(heading);
    for (const value of [limit, reason, earned, cumulative]) {
      const cell = row.insertCell();
      const isAmount = typeof value === 'number';
      cell.textContent = isAmount ? dollars(value) : value;
      if (isAmount) cell.className = 'money';
    }
    return row;
  });
  years.replaceChildren(...entries);
}

function update() {
  const useMonthlyPeaks = monthlyPeaks.value.trim() !== '';
  months.disabled = useMonthlyPeaks;
  months.removeAttribute('aria-invalid');
  try {
    const input = Object.fromEntries(fields.filter(field => !field.disabled)
      .map(field => [field.id, readNumber(field)]));
    input.nonResidentYears = parseNonResidentYears(byId('nonResidentYears').value);
    const calculation = calculateTfsa(input);
    const tax = useMonthlyPeaks ? readMonthlyTax(monthlyPeaks.value) : calculation.estimatedTax;
    const {
      available2026Room, cumulativeEligibleRoom, projected2027Room, projected2027RoomIfUncorrected,
      excessAmount, withdrawToCorrect, recontribution2027, eligibleIn2026
    } = calculation;

    byId('room').textContent = dollars(available2026Room);
    byId('earned').textContent = dollars(cumulativeEligibleRoom);
    byId('projection').textContent = dollars(projected2027Room);
    byId('tax').textContent = dollars(tax);
    byId('tax-label').textContent = useMonthlyPeaks ? 'Tax on entered monthly peaks' : 'Constant-excess tax estimate';
    byId('tax-note').textContent = useMonthlyPeaks
      ? 'Calculated at 1% of each entered monthly peak. Include the month of removal if there was an excess at any time that month.'
      : 'Based on the remaining excess and the number of months entered. Use the monthly peaks option for any earlier excess or a balance that changed.';

    const eligibilityNote = byId('eligibility-note');
    eligibilityNote.hidden = eligibleIn2026;
    eligibilityNote.textContent = eligibleIn2026 ? '' :
      'You did not earn new room in 2026. Any positive balance is carried room. Contributions require age 18 or older and Canadian tax residency.';

    const projection = `${dollars(recontribution2027)} from 2026 withdrawals returns as room on January 1. The annual amount assumes ${dollars(PROJECTED_2027_LIMIT)} for 2027 if eligible and resident.`;
    byId('projection-note').textContent = excessAmount > 0
      ? `${projection} The main projection assumes you clear the excess in 2026. If it carries into 2027, projected usable room is ${dollars(projected2027RoomIfUncorrected)}.`
      : projection;

    const overage = byId('overage');
    overage.hidden = excessAmount === 0;
    overage.textContent = excessAmount > 0
      ? `OVER-CONTRIBUTION ALERT! Your remaining excess is ${dollars(excessAmount)}. Withdraw ${dollars(withdrawToCorrect)} promptly to stop this excess generating tax in later months. The removal month still counts.`
      : '';

    renderBreakdown(calculation.breakdown);
    error.hidden = true;
    results.hidden = false;
    breakdown.hidden = false;
  } catch (invalid) {
    if (!(invalid instanceof RangeError)) throw invalid;
    error.textContent = invalid.message;
    error.hidden = false;
    results.hidden = true;
    breakdown.hidden = true;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();

// Only request ads for slots assigned to the configured publisher.
for (const slot of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (!slot.dataset.adSlot) continue;
  (window.adsbygoogle ??= []).push({});
}
