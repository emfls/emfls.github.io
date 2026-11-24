export const LIMITS = Object.freeze({
  year: 2026,
  base: 24_500,
  age50: 8_000,
  age60To63: 11_250,
  rothWages: 150_000,
  serviceAnnual: 3_000,
  serviceLifetime: 15_000,
  servicePerYear: 5_000,
  earlyTaxRate: 0.10,
});

function nonnegative(value, label, maximum = Number.MAX_SAFE_INTEGER / 100) {
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new RangeError(`Enter a valid nonnegative value for ${label}.`);
  }
}

function wholeNumber(value, label, maximum) {
  nonnegative(value, label, maximum);
  if (!Number.isInteger(value)) throw new RangeError(`Enter a whole number for ${label}.`);
}

const roundDollars = (amount) => Math.round(amount * 100) / 100;

function ageAllowance(amount, enabled, hasRoth, wages) {
  const rothRequired = wages > LIMITS.rothWages;
  const blockedByRoth = enabled && amount > 0 && rothRequired && !hasRoth;
  return {
    amount: enabled && !blockedByRoth ? amount : 0,
    rothRequired,
    blockedByRoth,
  };
}

function planResult(age, specialCatchUp, serviceCatchUp, catchUp) {
  const ageCatchUp = catchUp === 'special' ? 0 : age.amount;
  const mandatoryRoth = age.rothRequired ? ageCatchUp : 0;
  const preTaxEligible = roundDollars(LIMITS.base + specialCatchUp + serviceCatchUp + ageCatchUp - mandatoryRoth);
  return {
    total: roundDollars(preTaxEligible + mandatoryRoth),
    preTaxEligible,
    mandatoryRoth,
    ageCatchUp,
    specialCatchUp,
    serviceCatchUp,
    catchUp,
    blockedByRoth: age.blockedByRoth,
  };
}

export function calculateContributions({
  age,
  planType = '403b',
  wages457 = 0,
  wagesWorkplace = 0,
  ageCatchUp457 = true,
  ageCatchUpWorkplace = true,
  roth457 = true,
  rothWorkplace = true,
  normalRetirementYear,
  unused457 = 0,
  yearsOfService = 0,
  priorDeferrals = 0,
  lifetimeUsed = 0,
}) {
  wholeNumber(age, 'age at year-end', 120);
  if (planType !== '403b' && planType !== '401k') throw new RangeError('Select a 403(b) or 401(k).');
  nonnegative(wages457, 'governmental 457(b) employer FICA wages');
  nonnegative(wagesWorkplace, '403(b) or 401(k) employer FICA wages');
  nonnegative(unused457, 'unused 457(b) room');
  nonnegative(yearsOfService, '403(b) years of service', 120);
  nonnegative(priorDeferrals, 'prior deferrals');
  nonnegative(lifetimeUsed, 'prior 15-year catch-up usage');
  if (normalRetirementYear !== undefined) {
    wholeNumber(normalRetirementYear, 'normal retirement year', 2200);
    if (normalRetirementYear < 1900) throw new RangeError('Enter a four-digit normal retirement year.');
  }

  let ageLimit = 0;
  if (age >= 50) ageLimit = age >= 60 && age <= 63 ? LIMITS.age60To63 : LIMITS.age50;
  const eligible457 = ageAllowance(ageLimit, ageCatchUp457, roth457, wages457);
  const eligibleWorkplace = ageAllowance(ageLimit, ageCatchUpWorkplace, rothWorkplace, wagesWorkplace);

  const yearsBeforeRetirement = normalRetirementYear - LIMITS.year;
  const specialWindow = yearsBeforeRetirement >= 1 && yearsBeforeRetirement <= 3;
  const special457 = specialWindow ? roundDollars(Math.min(LIMITS.base, unused457)) : 0;
  // Favor the special rule on a tie so the same limit remains pre-tax eligible.
  const useSpecial = special457 > 0 && special457 >= eligible457.amount;
  const choice457 = useSpecial ? 'special' : eligible457.amount > 0 ? 'age' : 'none';

  const service403b = planType === '403b' && yearsOfService >= 15
    ? roundDollars(Math.max(0, Math.min(
      LIMITS.serviceAnnual,
      LIMITS.serviceLifetime - lifetimeUsed,
      Math.round(yearsOfService * LIMITS.servicePerYear * 100) / 100 - priorDeferrals,
    )))
    : 0;

  const governmental457 = planResult(eligible457, useSpecial ? special457 : 0, 0, choice457);
  const workplace = planResult(eligibleWorkplace, 0, service403b, eligibleWorkplace.amount > 0 ? 'age' : 'none');
  return {
    governmental457,
    workplace,
    specialWindow,
    combined: roundDollars(governmental457.total + workplace.total),
    preTaxEligible: roundDollars(governmental457.preTaxEligible + workplace.preTaxEligible),
    mandatoryRoth: governmental457.mandatoryRoth + workplace.mandatoryRoth,
  };
}

export function compareEarlyWithdrawal({ withdrawal, withdrawalAge, separationYearAge }) {
  nonnegative(withdrawal, 'taxable withdrawal');
  nonnegative(withdrawalAge, 'age at withdrawal', 120);
  wholeNumber(separationYearAge, 'age reached in the year of separation', 120);
  if (separationYearAge > Math.ceil(withdrawalAge)) {
    throw new RangeError('Separation must be in or before the withdrawal year.');
  }

  // Compare only the federal additional tax on a native 457(b) withdrawal after separation.
  const withdrawalCents = Math.round(withdrawal * 100);
  const iraTax = withdrawalAge < 59.5 ? Math.round(withdrawalCents * LIMITS.earlyTaxRate) / 100 : 0;
  return { governmental457Tax: 0, workplaceTax: separationYearAge >= 55 ? 0 : iraTax, iraTax };
}
