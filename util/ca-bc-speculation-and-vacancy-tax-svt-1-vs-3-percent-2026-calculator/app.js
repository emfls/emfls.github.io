import { calculateSVT } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('svt-form');
const results = byId('results');
const error = byId('input-error');
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const formatMoney = (value) => value === null ? 'N/A' : currency.format(value);

const exemptionHelp = {
  none: 'Choose an exemption only after confirming the statutory conditions.',
  principal: 'For an eligible B.C. resident, this generally means the home where you lived longer than anywhere else in the calendar year. Spouses generally share one designation.',
  purchase: 'Check section 48 for an inheritance or section 49 for a qualifying transfer, generally involving property transfer tax paid or a listed exemption.',
  renovation: 'For an existing home, the work must prevent occupancy for at least 90 days in the tax year. Take reasonable steps to progress without undue delay. Section 41 also covers sites that do not yet have a residence.',
  hazard: 'Check section 24 for timing and damage rules. The main test requires at least 60 consecutive days uninhabitable in the tax year because of a qualifying event outside the owner’s reasonable control.',
  bereavement: 'The year of an owner’s death and the following year can qualify. For surviving owners, check that you owned an interest when the death occurred or are the deceased’s personal representative.',
  'legacy-strata': 'The legacy exemption for strata rental restrictions ended after 2021. A restriction alone does not qualify in 2026.',
};

function render() {
  const owner = byId('owner').value;
  const area = byId('area').value === 'in';
  const exemption = byId('exemption').value;
  const tenant = byId('tenant').value;
  const related = tenant === 'related' || tenant === 'mixed';
  const hasTenancy = tenant !== 'none';

  byId('resident-options').hidden = owner !== 'bc';
  byId('income-options').hidden = owner === 'bc';
  byId('tenancy-options').hidden = !hasTenancy;
  byId('related-options').hidden = owner !== 'higher' || !related;
  byId('exemption-note').textContent = exemptionHelp[exemption];

  let estimate;
  try {
    estimate = calculateSVT({
      assessedValue: byId('assessment').valueAsNumber,
      ownershipPercent: byId('ownership').valueAsNumber,
      owner,
      inTaxableArea: area,
      exemption,
      tenant,
      months: hasTenancy ? byId('months').valueAsNumber : 0,
      relatedTenantQualifies: byId('related-qualifies').checked,
      residentCreditAvailable: byId('resident-credit').checked,
      incomeBalance: owner === 'bc' ? 0 : byId('income-balance').valueAsNumber,
      wouldBeExemptAsBCResident: byId('bc-exemption-test').checked,
      rentalCosts: byId('rental-costs').valueAsNumber,
    });
  } catch (exception) {
    if (!(exception instanceof RangeError)) throw exception;
    error.textContent = exception.message;
    error.hidden = false;
    results.hidden = true;
    byId('default-estimate').hidden = true;
    return;
  }

  const amounts = {
    'net-2026': estimate.net2026,
    'share-value': estimate.taxableShare,
    'gross-2026': estimate.gross2026,
    'credit-2026': estimate.credit2026,
    'net-2025': estimate.net2025,
    'extra-2026': estimate.extra2026,
    'foreign-2027': estimate.foreign2027Gross,
    'net-2027': estimate.foreign2027Net,
    'rent-equivalent': estimate.rentEquivalentMonthly,
    'break-even': estimate.breakEvenMonthly,
    'undeclared-2026': estimate.noDeclaration2026,
  };
  for (const [id, value] of Object.entries(amounts)) {
    byId(id).textContent = formatMoney(value);
  }

  let status = 'Taxable scenario for the selected ownership share.';
  if (!area) {
    status = 'Outside the designated taxable areas for this estimate.';
  } else if (estimate.exempt) {
    status = estimate.eligibleTenancy ? 'Exempt under the qualifying tenancy inputs.' : 'Exempt under the selected scenario.';
  } else if (exemption === 'principal') {
    status = 'The principal residence exemption checked here requires the B.C. resident owner category.';
  } else if (exemption === 'legacy-strata') {
    status = 'The legacy strata rental restriction exemption has expired.';
  } else if (hasTenancy) {
    status = 'The tenancy inputs do not establish six qualifying months.';
  }

  byId('scenario-status').textContent = status;
  byId('foreign-net-row').hidden = estimate.foreign2027Net === null;
  byId('default-estimate').hidden = !area;
  error.hidden = true;
  results.hidden = false;
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
