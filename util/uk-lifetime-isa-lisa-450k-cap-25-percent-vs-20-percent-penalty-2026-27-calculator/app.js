import { projectLisa, LISA_RULES } from './model.mjs';

const get = (id) => document.getElementById(id);
const form = get('lisa-form');
const results = get('lisa-results');
const error = get('lisa-error');
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 2 });
const numericIds = ['annual-contribution', 'opening-age', 'years', 'annual-return', 'property-price'];
const set = (id, value) => { get(id).textContent = value; };

function update() {
  let result;
  try {
    const inputs = numericIds.map(get);
    const invalid = inputs.find((input) => !input.checkValidity());
    if (invalid) throw new RangeError(`${invalid.labels[0].textContent}. ${invalid.validationMessage}`);
    const [annualContribution, openingAge, years, annualReturn, propertyPrice] =
      inputs.map((input) => input.valueAsNumber);
    result = projectLisa({
      annualContribution, openingAge, years, annualReturn, propertyPrice,
      holders: Number(get('holders').value),
      homeEligible: get('eligible').value === '1',
      reducedRateDate: get('rule-date').value === '1',
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    error.hidden = false;
    results.hidden = true;
    set('isa-pot', '—');
    set('sipp-gross', '—');
    return;
  }

  error.hidden = true;
  error.textContent = '';
  results.hidden = false;

  for (const [id, value] of Object.entries({
    pot: result.pot,
    principal: result.principal,
    bonus: result.bonus,
    growth: result.growth,
    'qualified-net': result.qualifiedNet,
    'over-cap-net': result.overCapNet,
    'over-cap-charge': result.overCapCharge,
    'unauthorised-net': result.unauthorisedNet,
    'unauthorised-charge': result.unauthorisedCharge,
    'couple-bonus': result.coupleAnnualBonus,
    'annual-bonus': result.annualBonus,
    'isa-pot': result.isaPot,
    'sipp-gross': result.sippGross,
  })) set(id, money.format(value));

  set('principal-loss', `${money.format(result.unauthorisedPrincipalLoss)} (${percent.format(result.unauthorisedPrincipalLossRate)})`);
  set('no-growth-loss', `${money.format(result.noGrowthOwnCapitalLoss)} (${percent.format(result.noGrowthOwnCapitalLossRate)})`);
  set('projection-timing', `Age ${result.ageAtWithdrawal} at withdrawal · ${result.contributionYears} contribution years per saver`);
  set('home-net', result.homeNet === null ? '—' : money.format(result.homeNet));

  let homeStatus;
  if (result.homeRate === null) {
    homeStatus = 'The selected purchase does not meet the other first-home conditions. The 25% scenario shows an ordinary unauthorised cash-out before 60.';
  } else if (result.homeNet === null) {
    homeStatus = 'The full pot exceeds the purchase price. Ask your conveyancer about a partial withdrawal.';
  } else if (result.retirementNet !== null) {
    homeStatus = `You can withdraw charge-free at age ${LISA_RULES.retirementAge} or later.`;
  } else {
    homeStatus = `Estimated full-pot withdrawal after a ${percent.format(result.homeRate)} charge under the selected rule.`;
  }
  set('home-status', homeStatus);
  set('retirement-status', result.retirementNet === null
    ? `Age-${LISA_RULES.retirementAge} access falls outside this projection.`
    : `At projected age ${result.ageAtWithdrawal}, age-based withdrawal is charge-free.`);
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());
update();
