import { calculate, constants } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('portability-form');
const results = byId('calculator-results');
const error = byId('input-error');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });

function setText(id, value) {
  const element = byId(id);
  if (element.textContent !== value) element.textContent = value;
}

function readNumber(id) {
  const field = byId(id);
  if (!field.validity.valid) {
    throw new RangeError(`Check the value for ${field.labels[0].textContent.toLowerCase()}.`);
  }
  return field.valueAsNumber;
}

function showTax(prefix, estimate) {
  setText(`${prefix}-assessed`, usd.format(estimate.assessed));
  setText(`${prefix}-school`, usd.format(estimate.taxable.school));
  setText(`${prefix}-non-school`, usd.format(estimate.taxable.nonSchool));
  setText(`${prefix}-tax`, usd.format(estimate.tax));
}

function render() {
  let estimate;
  let oldMarketValue;
  try {
    oldMarketValue = readNumber('old-market');
    estimate = calculate({
      oldMarketValue,
      oldAssessedValue: readNumber('old-assessed'),
      newMarketValue: readNumber('new-market'),
      schoolMills: readNumber('school-mills'),
      nonSchoolMills: readNumber('non-school-mills'),
      lastExemptionYear: readNumber('last-exemption'),
      marketGrowth: readNumber('market-growth') / 100,
      futureCpi: readNumber('future-cpi') / 100,
    });
  } catch (issue) {
    if (!(issue instanceof RangeError)) throw issue;
    results.hidden = true;
    error.hidden = false;
    setText('input-error', issue.message);
    return;
  }

  error.hidden = true;
  setText('input-error', '');
  results.hidden = false;
  const { oldBenefit, portableBenefit, mode, uncappedBenefit, capped, firstYear, window } = estimate;
  setText('old-benefit', usd.format(oldBenefit));
  setText('portable-benefit', usd.format(portableBenefit));
  setText('annual-savings', usd.format(firstYear.savings));
  setText('total-savings', usd.format(estimate.totalSavings));
  showTax('with', firstYear.withPortability);
  showTax('without', firstYear.withoutPortability);

  let formula = mode === 'UPSIZING'
    ? 'UPSIZING · The old dollar benefit transfers up to $500,000.'
    : `DOWNSIZING · Multiply the new just value by the old SOH discount of ${percent.format(oldBenefit / oldMarketValue)}, then apply the $500,000 cap.`;
  if (capped) formula += ` The cap reduced the calculated transfer from ${usd.format(uncappedBenefit)}.`;
  setText('formula', formula);

  const filing = window.eligible
    ? `The prior exemption year is within the lookback. File DR-501T with DR-501 for the new homestead. The ${window.filingYear} timely deadline was ${constants.filingDeadline}. January 1, ${window.lastEstablishmentYear}, is the last establishment date under the three-year lookback for the prior exemption year entered.`
    : `The prior exemption year is outside the 2026 lookback. The last eligible establishment date under this lookback was January 1, ${window.lastEstablishmentYear}. The estimate applies a $0 transfer.`;
  setText('filing', filing);
  setText('result-announcement', `Estimated transfer ${usd.format(portableBenefit)}. Estimated 2026 tax savings ${usd.format(firstYear.savings)}.`);

  const rows = estimate.projection.map((year) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = year.year;
    row.append(heading);
    for (const value of [year.withPortability.tax, year.withoutPortability.tax, year.savings]) {
      const cell = document.createElement('td');
      cell.textContent = usd.format(value);
      row.append(cell);
    }
    return row;
  });
  byId('projection-rows').replaceChildren(...rows);
}

form.addEventListener('input', render);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  render();
});
render();
