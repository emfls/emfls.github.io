export const LISA_RULES = Object.freeze({
  annualCap: 4000,
  isaAllowance: 20000,
  bonusRate: 0.25,
  propertyCap: 450000,
  overCapRate: 0.20,
  unauthorisedRate: 0.25,
  reducedRateFrom: '2026-10-29',
  minOpeningAge: 18,
  maxOpeningAge: 39,
  stopContributionAge: 50,
  retirementAge: 60,
});

function validateNumber(value, min, max, label, whole = false) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`Enter ${whole ? 'a whole number' : 'a number'} from ${min} to ${max} for ${label}.`);
  }
}

export function projectLisa({
  annualContribution, openingAge, years, annualReturn, holders, propertyPrice, homeEligible, reducedRateDate,
}) {
  const rules = LISA_RULES;
  validateNumber(annualContribution, 0, rules.annualCap, 'annual contributions per person');
  validateNumber(openingAge, rules.minOpeningAge, rules.maxOpeningAge, 'opening age', true);
  validateNumber(years, 1, 42, 'projection years', true);
  validateNumber(annualReturn, -100, 100, 'annual return');
  validateNumber(holders, 1, 2, 'LISA holders', true);
  validateNumber(propertyPrice, 0.01, 1000000000, 'home price');
  if (typeof homeEligible !== 'boolean' || typeof reducedRateDate !== 'boolean') {
    throw new RangeError('Choose a first-home eligibility answer and a withdrawal rule date.');
  }

  const contributionYears = Math.min(years, rules.stopContributionAge - openingAge);
  const ageAtWithdrawal = openingAge + years;
  const annualPrincipal = annualContribution * holders;
  const annualBonus = annualPrincipal * rules.bonusRate;
  const principal = annualPrincipal * contributionYears;
  const bonus = annualBonus * contributionYears;

  // Apply a full year of return after each year's start-of-year deposit.
  // Use the same cash flows and return in the standard ISA comparison.
  const annualFactor = 1 + annualReturn / 100;
  let isaPot = 0;
  for (let year = 0; year < years; year += 1) {
    const deposit = year < contributionYears ? annualPrincipal : 0;
    isaPot = (isaPot + deposit) * annualFactor;
  }
  const pot = isaPot * (1 + rules.bonusRate);
  const overCapCharge = pot * rules.overCapRate;
  const overCapNet = pot - overCapCharge;
  const unauthorisedCharge = pot * rules.unauthorisedRate;
  const unauthorisedNet = pot - unauthorisedCharge;
  const unauthorisedPrincipalLoss = Math.max(0, principal - unauthorisedNet);
  const noGrowthOwnCapitalLossRate = 1 - (1 + rules.bonusRate) * (1 - rules.unauthorisedRate);
  const age60Access = ageAtWithdrawal >= rules.retirementAge;
  const homeRate = !homeEligible ? null
    : age60Access || propertyPrice <= rules.propertyCap ? 0
    : reducedRateDate ? rules.overCapRate : rules.unauthorisedRate;
  const homeNet = homeRate === null || pot > propertyPrice ? null : pot * (1 - homeRate);

  return {
    contributionYears, ageAtWithdrawal, annualBonus, principal, bonus, pot,
    growth: pot - principal - bonus,
    qualifiedNet: pot,
    overCapCharge, overCapNet, unauthorisedCharge, unauthorisedNet,
    unauthorisedPrincipalLoss,
    unauthorisedPrincipalLossRate: principal === 0 ? 0 : unauthorisedPrincipalLoss / principal,
    noGrowthOwnCapitalLoss: principal * noGrowthOwnCapitalLossRate,
    noGrowthOwnCapitalLossRate,
    coupleAnnualBonus: annualContribution * 2 * rules.bonusRate,
    homeRate, homeNet,
    retirementNet: age60Access ? pot : null,
    isaPot,
    // A £1 net pension payment is £1.25 gross at 20% relief at source.
    sippGross: isaPot / (1 - 0.20),
  };
}
