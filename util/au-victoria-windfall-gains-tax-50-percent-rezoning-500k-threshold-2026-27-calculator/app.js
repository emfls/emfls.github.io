import { assessWgt, projectDeferral, compareSale } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('wgt-form');
const results = byId('wgt-results');
const error = byId('wgt-error');
const amountFormat = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 2 });
const money = value => (value < 0 ? '−' : '') + 'A$' + amountFormat.format(Math.abs(value));
const percent = value => percentFormat.format(value / 100);
const fieldNumber = id => byId(id).valueAsNumber;
const showText = (id, text) => { byId(id).textContent = text; };

const bands = [
  ['EXEMPT_UNDER_100K', 'Up to $100,000', '0%'],
  ['MARGINAL_62_5_PCT', 'Over $100,000 and under $500,000', '62.5% on excess'],
  ['FLAT_50_PCT', '$500,000 and over', '50% on entire taxable uplift'],
];

function renderRows(target, rows, selectedIndex = -1) {
  byId(target).replaceChildren(...rows.map(([heading, ...values], index) => {
    const row = document.createElement('tr');
    if (index === selectedIndex) row.setAttribute('aria-current', 'true');
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = heading;
    row.append(label);
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }));
}

function renderAssessment(assessment) {
  const labels = {
    none: 'No residential exemption assumed.',
    full: 'Full residential exemption indicated for this parcel.',
    partial: 'Partial residential exemption indicated. The taxable uplift uses the area above 2 hectares divided by total qualifying area. Confirm the area and apportionment with SRO Victoria if several titles share the exemption.',
  };
  showText('tax', money(assessment.tax));
  showText('effectiveRate', percent(assessment.effectiveRate));
  showText('netEquity', money(assessment.netEquity));
  showText('exemption', labels[assessment.exemption]);
  showText('uplift', money(assessment.uplift));
  showText('exemptUplift', money(assessment.exemptUplift));
  showText('taxableUplift', money(assessment.taxableUplift));
  results.dataset.tier = assessment.tier;
  renderRows('wgt-bands', bands.map(([tier, label, rate]) => {
    if (tier !== assessment.tier) return [label, rate, '—', '—'];
    const base = assessment.bandRate === 0 ? assessment.taxableUplift : assessment.bandTaxBase;
    return [label + ' (applied)', rate, money(base), money(assessment.tax)];
  }), bands.findIndex(([tier]) => tier === assessment.tier));
}

function calculate() {
  const invalid = form.querySelector('input:invalid');
  if (invalid) {
    error.textContent = invalid.labels[0].textContent + ' — ' + invalid.validationMessage;
    error.hidden = false;
    results.hidden = true;
    return;
  }

  const assessment = assessWgt({
    preRezoningCiv: fieldNumber('preRezoningCiv'),
    postRezoningCiv: fieldNumber('postRezoningCiv'),
    allowableDeductions: fieldNumber('allowableDeductions'),
    hectares: fieldNumber('hectares'),
    residential: byId('residential').value !== 'none',
  });
  const deferral = projectDeferral({
    tax: assessment.tax,
    deferredPercent: fieldNumber('deferredPercent'),
    annualRatePercent: fieldNumber('annualRatePercent'),
  });
  const saleYear = Number(byId('saleYear').value);
  const saleIndex = deferral.schedule.findIndex(row => row.years === saleYear);
  const saleInterest = deferral.schedule[saleIndex].interest;
  const sale = compareSale({
    preRezoningCiv: fieldNumber('preRezoningCiv'),
    saleProceeds: fieldNumber('saleProceeds'),
    baseCost: fieldNumber('baseCost'),
    effectiveCgtPercent: fieldNumber('effectiveCgtPercent'),
    includeWgtInCostBase: byId('includeWgt').value === 'include',
    tax: assessment.tax,
    interest: saleInterest,
  });

  renderAssessment(assessment);
  showText('payNow', money(assessment.tax));
  showText('dueNow', money(deferral.dueNow));
  showText('deferredPrincipal', money(deferral.deferredPrincipal));
  renderRows('deferral-rows', deferral.schedule.map(({ years, interest, balance, totalPaid }) =>
    [years, money(interest), money(balance), money(totalPaid)]
  ), saleIndex);

  showText('deferral-warning', saleInterest > 0
    ? 'Deferring to year ' + saleYear + ' adds ' + money(saleInterest) + ' in interest before any CGT effect. Set aside enough for the deferred balance if a sale or other qualifying event brings payment forward.'
    : 'This scenario projects no deferral interest. If a balance is deferred, a future rate change or an earlier qualifying transaction can change the amount due at settlement.');

  showText('sale-horizon', saleYear);
  renderRows('sale-rows', [
    ['Adjusted CGT cost base', money(sale.payNow.costBase), money(sale.defer.costBase)],
    ['Positive gain before CGT adjustments', money(sale.payNow.gain), money(sale.defer.gain)],
    ['Estimated federal CGT', money(sale.payNow.cgt), money(sale.defer.cgt)],
    ['Net uplift after WGT, interest and incremental CGT', money(sale.payNow.netUplift), money(sale.defer.netUplift)],
  ]);
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('input', calculate);
form.addEventListener('submit', event => {
  event.preventDefault();
  calculate();
});
calculate();
