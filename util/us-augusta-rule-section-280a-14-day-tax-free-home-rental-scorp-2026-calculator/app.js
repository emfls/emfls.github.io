import { calculateAugustaRule, RENT_REPORTING_THRESHOLD } from './model.mjs';

const get = id => document.getElementById(id);
const set = (id, text) => { get(id).textContent = text; };
const form = get('calculator');
const paperwork = [...form.querySelectorAll('[name="paperwork"]')];
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 3 });
const money = amount => currency.format(amount);

const riskLabels = {
  LOW_AUDIT_RISK: 'Low FMV markup',
  MODERATE: 'Moderate FMV markup',
  HIGH_SINOPOLI_AUDIT_RISK: 'High Sinopoli-style FMV risk',
};

function update() {
  const entity = get('entity').value;
  const isCorporation = entity === 'c-corp';
  get('corporate-fields').hidden = !isCorporation;
  get('qbi-field').hidden = entity !== 's-corp' && entity !== 'partnership';
  const checked = paperwork.map(field => field.checked);
  const activeFields = [...form.querySelectorAll('input[type="number"]')]
    .filter(input => !input.closest('[hidden]'));

  try {
    const invalid = activeFields.find(input => !input.validity.valid);
    if (invalid) throw new RangeError(invalid.labels[0].textContent + ' — ' + invalid.validationMessage);
    const result = calculateAugustaRule({
      entity,
      rentalDays: get('business-days').valueAsNumber,
      otherRentalDays: get('other-days').valueAsNumber,
      usedAsResidence: get('residence').checked,
      dailyFmvRate: get('daily-rent').valueAsNumber,
      localHotelBenchmarkRate: get('benchmark').valueAsNumber,
      federalMarginalRate: get('federal-rate').valueAsNumber / 100,
      stateMarginalRate: get('state-rate').valueAsNumber / 100,
      stateCorpRate: isCorporation ? get('corporate-state').valueAsNumber / 100 : 0,
      qbiEligible: get('qbi').checked,
      dividendRate: Number(get('dividend-rate').value),
      dividendNiitApplies: get('dividend-niit').checked,
      paperwork: checked,
    });

    let eligibility = 'The scenario has no rent from your business.';
    if (!result.eligible) {
      eligibility = 'Ineligible for this strategy. A sole proprietor or disregarded single-member LLC cannot deduct rent paid to itself.';
    } else if (!get('residence').checked) {
      eligibility = 'The residence requirement is unmet. The federal rent exclusion is unavailable.';
    } else if (result.cliffTriggered) {
      eligibility = `15-day cliff triggered. At ${result.totalRentalDays} total rental days, all rent enters the federal rental income calculation.`;
    } else if (result.totalRentPaid > 0) {
      eligibility = `The federal exclusion applies under these assumptions. ${result.totalRentalDays} of 14 rental days used.`;
    }
    set('eligibility', eligibility);
    set('rent-total', money(result.totalRentPaid));
    set('tax-free', money(result.taxFreeCashExtracted));
    set('annual-savings', money(result.netTaxSavings));
    set('five-year', money(result.fiveYearTaxSavings));
    set('taxable-rent', money(result.taxableRentalIncome));
    set('personal-tax', money(result.personalTaxOnRent));

    const qbi = result.qbiApplies ? ' with the full QBI adjustment' : '';
    set('business-tax', `Business-side tax savings ${money(result.businessTaxSavings)} at ${percent.format(result.businessRate)} combined (${percent.format(result.effectiveFederalRate)} federal${qbi}).`);
    get('dividend-savings').hidden = !isCorporation;
    set('dividend-savings', `Compared with distributing the same pretax earnings as a qualified dividend, estimated annual tax savings are ${money(result.taxSavingsVsDividend)}, including ${money(result.avoidedDividendTax)} in avoided federal dividend tax.`);

    const threshold = money(RENT_REPORTING_THRESHOLD);
    const reporting = result.form1099MiscTriggered
      ? `Box 1 threshold met. Generally file Form 1099-MISC for ${threshold} or more in 2026 reportable rent paid to this payee.`
      : `Box 1 threshold not reached by this scenario. Check all reportable rent the business paid to this payee in 2026 against ${threshold}.`;
    set('reporting', result.eligible ? reporting : 'Form 1099-MISC rent threshold does not apply to this blocked self-rental scenario.');

    get('fmv').hidden = !result.eligible;
    get('fmv').dataset.risk = result.fmvRisk;
    set('fmv', `${riskLabels[result.fmvRisk]} · proposed rent is ${result.fmvRatio.toFixed(2)}× the entered comparable rate`);
    const cliffImpact = result.cliffLoss < 0
      ? `Modeled annual savings increase by ${money(-result.cliffLoss)} from day 14 to day 15.`
      : `Modeled annual savings fall by ${money(result.cliffLoss)} from day 14 to day 15.`;
    set('cliff', result.cliffApplicable
      ? `${cliffImpact} Estimated personal tax on all business rent at day 15 is ${money(result.cliffPersonalTax)}.`
      : 'A 14-to-15 comparison is unavailable for this entity, property use or number of other rental days.');

    set('paperwork-score', `${result.paperworkScore} of ${paperwork.length} items checked`);
    get('results').hidden = false;
    get('error').hidden = true;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    set('paperwork-score', `${checked.filter(Boolean).length} of ${paperwork.length} items checked`);
    get('results').hidden = true;
    set('error', error.message);
    get('error').hidden = false;
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', event => event.preventDefault());
update();
