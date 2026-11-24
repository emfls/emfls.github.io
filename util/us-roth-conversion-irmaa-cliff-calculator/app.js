import { basicDeductionCents, calculateConversion, maximumEnrollees, parseDollars } from './model.mjs';

const element = id => document.getElementById(id);
const form = element('conversion-form');
const filing = element('filing');
const deduction = element('deduction');
const enrollments = [element('part-b'), element('part-d')];
const results = element('results');
const error = element('error');
const fields = [
  ['agi', 'Adjusted gross income', 'agiCents', true],
  ['interest', 'Tax-exempt interest', 'taxExemptInterestCents'],
  ['deduction', 'Deductions', 'deductionCents'],
  ['conversion', 'Planned conversion', 'conversionCents'],
];
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const number = new Intl.NumberFormat('en-US');
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const money = cents => usd.format(cents / 100);
const room = cents => cents === null ? 'No further cutoff' : money(cents);
const comparison = (before, after) => `${before} → ${after}`;
let useBasicDeduction = true;

function updateFiling() {
  const limit = maximumEnrollees(filing.value);
  if (useBasicDeduction) deduction.value = number.format(basicDeductionCents(filing.value) / 100);
  for (const select of enrollments) {
    select.options[2].disabled = limit < 2;
    if (Number(select.value) > limit) select.value = String(limit);
  }
}

function render() {
  const input = {
    filing: filing.value,
    partBEnrollees: Number(enrollments[0].value),
    partDEnrollees: Number(enrollments[1].value),
  };
  const invalid = [];
  for (const [id, label, key, allowNegative = false] of fields) {
    const field = element(id);
    try {
      input[key] = parseDollars(field.value, { allowNegative });
      field.removeAttribute('aria-invalid');
      field.setAttribute('aria-errormessage', 'error');
    } catch (issue) {
      if (!(issue instanceof RangeError)) throw issue;
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-errormessage', 'error');
      invalid.push(`${label} — ${issue.message}`);
    }
  }
  error.textContent = invalid.join('\n');
  results.hidden = invalid.length > 0;
  if (results.hidden) return;

  const estimate = calculateConversion(input);
  const values = {
    'safe-room': room(estimate.safeRoomCents),
    'irmaa-room': input.partBEnrollees + input.partDEnrollees === 0
      ? 'No Part B or Part D coverage' : room(estimate.irmaaRoomCents),
    'tax-room': room(estimate.taxRoomCents),
    'taxable-income': comparison(money(estimate.taxableBeforeCents), money(estimate.taxableAfterCents)),
    'tax-bracket': comparison(`${estimate.bracketRateBefore}%`, `${estimate.bracketRateAfter}%`),
    magi: comparison(money(estimate.magiBeforeCents), money(estimate.magiAfterCents)),
    tier: comparison(`Tier ${estimate.tierBefore}`, `Tier ${estimate.tierAfter}`),
    'federal-tax': comparison(money(estimate.taxBeforeCents), money(estimate.taxAfterCents)),
    'annual-irmaa': comparison(money(estimate.irmaaBeforeCents), money(estimate.irmaaAfterCents)),
    'conversion-tax': money(estimate.taxDeltaCents),
    'irmaa-delta': money(estimate.irmaaDeltaCents),
    'combined-cost': money(estimate.totalCostCents),
    'combined-rate': estimate.effectiveRate === null ? '— (zero conversion)' : percent.format(estimate.effectiveRate),
  };
  for (const [id, value] of Object.entries(values)) element(id).textContent = value;

  const note = estimate.irmaaDeltaCents > 0
    ? `This conversion raises your Medicare surcharge by ${money(estimate.irmaaDeltaCents)} over 12 months at 2026 CMS rates.`
    : 'This conversion adds no Medicare surcharge at 2026 CMS rates.';
  element('result-note').textContent = note;
}

form.addEventListener('input', event => {
  if (event.target === deduction) useBasicDeduction = false;
  if (event.target === filing) updateFiling();
  render();
});
form.addEventListener('submit', event => event.preventDefault());
updateFiling();
render();

// Request manual ads only when the markup has publisher-issued slot IDs.
for (const slot of document.querySelectorAll('ins.adsbygoogle[data-ad-slot]')) {
  if (/^\d+$/.test(slot.dataset.adSlot)) (window.adsbygoogle ||= []).push({});
}
