export const LIMITS_2026 = Object.freeze({
  standardBase: 17000,
  enhancedBase: 18100,
  standardCatchUp: 4000,
  enhancedCatchUp: 3850,
  superCatchUp: 5250,
  compensationCap: 360000,
  additionalNonelectiveCap: 5300,
  additionalNonelectiveMinPay: 5000,
  base401k: 24500,
  catchUp401k: 8000,
  superCatchUp401k: 11250
});

function validateNumber(value, label, max, whole = false) {
  if (!Number.isFinite(value) || value < 0 || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${whole ? 'a whole number' : 'a number'} from 0 to ${max.toLocaleString('en-US')}.`);
  }
}

function money(value) {
  const cents = value * 100;
  return Math.round(cents + Math.abs(cents) * Number.EPSILON) / 100;
}

function incomeTax(amount, federalRate, stateRate) {
  const federal = money(amount * federalRate / 100);
  const state = money(amount * stateRate / 100);
  return { federal, state, total: money(federal + state) };
}

// Assumes one SIMPLE plan, eligible pay and the employer terms entered by the user.
export function calculateContribution({
  compensation, age, employeeCount, section117Eligible, smallEmployerGrace = false,
  enhancedElection, employerMethod, additionalRate, plannedDeferral, federalRate, stateRate
}) {
  validateNumber(compensation, 'Compensation', 100000000);
  validateNumber(age, 'Year-end age', 120, true);
  if (Number.isInteger(employeeCount) && employeeCount > 100) {
    throw new RangeError('This estimator covers up to 100 qualifying employees. Check your plan notice if a transition rule applies.');
  }
  validateNumber(employeeCount, 'Employee count', 100, true);
  validateNumber(plannedDeferral, 'Planned deferral', 100000000);
  validateNumber(additionalRate, 'Additional nonelective rate', 10);
  validateNumber(federalRate, 'Federal rate', 100);
  validateNumber(stateRate, 'State rate', 100);
  if (!['match', 'nonelective'].includes(employerMethod)) {
    throw new RangeError('Employer contribution must be matching or nonelective.');
  }

  const limits = LIMITS_2026;
  const smallEmployer = employeeCount <= 25 || smallEmployerGrace;
  const electedEnhanced = section117Eligible && !smallEmployer && enhancedElection;
  const enhanced = Boolean(section117Eligible && (smallEmployer || electedEnhanced));
  const baseLimit = enhanced ? limits.enhancedBase : limits.standardBase;
  const superCatchUp = age >= 60 && age <= 63;
  const regularCatchUp = enhanced ? limits.enhancedCatchUp : limits.standardCatchUp;
  const catchUp = superCatchUp ? limits.superCatchUp : age >= 50 ? regularCatchUp : 0;
  const statutoryLimit = baseLimit + catchUp;
  const employeeMaximum = money(Math.min(compensation, statutoryLimit));
  const employeeContribution = money(Math.min(plannedDeferral, employeeMaximum));

  const isMatch = employerMethod === 'match';
  const employerRate = (isMatch ? 3 : 2) + Number(Boolean(electedEnhanced));
  const employerPay = isMatch ? compensation : Math.min(compensation, limits.compensationCap);
  const employerCeiling = money(employerPay * employerRate / 100);
  const employerContribution = isMatch ? Math.min(employeeContribution, employerCeiling) : employerCeiling;
  const employerMaximum = isMatch ? Math.min(employeeMaximum, employerCeiling) : employerCeiling;
  const additionalPay = compensation >= limits.additionalNonelectiveMinPay
    ? Math.min(compensation, limits.compensationCap)
    : 0;
  const additionalContribution = money(Math.min(
    additionalPay * additionalRate / 100, limits.additionalNonelectiveCap
  ));

  const catchUp401k = superCatchUp ? limits.superCatchUp401k : age >= 50 ? limits.catchUp401k : 0;
  return {
    enhanced, baseLimit, catchUp, statutoryLimit, employeeMaximum, employeeContribution, employerRate,
    employerContribution, employerMaximum, additionalContribution,
    remainingDeferral: money(employeeMaximum - employeeContribution),
    combinedContribution: money(employeeContribution + employerContribution + additionalContribution),
    combinedMaximum: money(employeeMaximum + employerMaximum + additionalContribution),
    taxSavings: incomeTax(employeeContribution, federalRate, stateRate),
    maximumTaxSavings: incomeTax(employeeMaximum, federalRate, stateRate),
    base401k: limits.base401k,
    ageAdjusted401k: limits.base401k + catchUp401k,
    baseLimitGap: limits.base401k - baseLimit
  };
}

// The requested amount represents entirely pre-tax SIMPLE IRA funds.
export function simulateDistribution({
  amount, transaction, withinTwoYears, age, qualifiesForException = false, federalRate, stateRate
}) {
  validateNumber(amount, 'Amount', 100000000);
  validateNumber(age, 'Age at transaction', 120);
  validateNumber(federalRate, 'Federal rate', 100);
  validateNumber(stateRate, 'State rate', 100);
  if (!['cash', 'simple', 'traditional', '401k', 'roth'].includes(transaction)) {
    throw new RangeError('Transaction type is invalid.');
  }

  let status = 'withdrawal';
  if (transaction === 'simple') status = 'rollover';
  else if (transaction !== 'cash') {
    if (withinTwoYears) status = 'restricted';
    else status = transaction === 'roth' ? 'conversion' : 'rollover';
  }

  const taxableAmount = status === 'rollover' ? 0 : money(amount);
  const earlyDistribution = status === 'withdrawal' || status === 'restricted';
  const penaltyRate = earlyDistribution && age < 59.5 && !qualifiesForException
    ? (withinTwoYears ? 25 : 10)
    : 0;
  const penalty = money(taxableAmount * penaltyRate / 100);
  const income = incomeTax(taxableAmount, federalRate, stateRate);
  const totalTax = money(income.total + penalty);

  return {
    status, taxableAmount, penaltyRate, penalty,
    federalTax: income.federal, stateTax: income.state, incomeTax: income.total,
    totalTax, afterTax: money(amount - totalTax)
  };
}
