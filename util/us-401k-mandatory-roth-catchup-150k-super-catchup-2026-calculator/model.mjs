export const LIMITS = Object.freeze({
  baseDeferral: 24_500,
  standardCatchUp: 8_000,
  superCatchUp: 11_250,
  annualAdditions: 72_000,
  rothWageThreshold: 150_000,
});

export const PAY_PERIODS = Object.freeze([12, 24, 26, 52]);

function checkRange(value, min, max, label, whole = false) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${whole ? 'a whole number ' : ''}from ${min} to ${max}.`);
  }
}

export function calculateCatchUp({
  age, wages, employment, base, catchUp, currentRate, retirementRate,
  years, annualReturn, gainsRate, payPeriods,
}) {
  checkRange(age, 45, 75, 'Year-end age', true);
  if (!['same', 'new', 'self'].includes(employment)) {
    throw new RangeError('Select a 2025 employer wage situation.');
  }
  const employerWages = employment === 'same' ? wages : 0;
  checkRange(employerWages, 0, 1_000_000_000, '2025 employer wages');
  checkRange(base, 0, 1_000_000_000, 'Planned base deferral');
  checkRange(catchUp, 0, 1_000_000_000, 'Planned catch-up');
  checkRange(currentRate, 0, 100, 'Current income tax rate');
  checkRange(retirementRate, 0, 100, 'Retirement income tax rate');
  checkRange(years, 1, 25, 'Years to retirement', true);
  checkRange(annualReturn, -100, 100, 'Annual return');
  checkRange(gainsRate, 0, 100, 'Tax rate on brokerage gains');
  if (!PAY_PERIODS.includes(payPeriods)) throw new RangeError('Select a pay frequency.');

  const catchUpLimit = age < 50 ? 0
    : age >= 60 && age <= 63 ? LIMITS.superCatchUp : LIMITS.standardCatchUp;
  const mandatoryRoth = catchUpLimit > 0 && employerWages > LIMITS.rothWageThreshold;
  const verdict = catchUpLimit === 0 ? 'CATCH-UP UNAVAILABLE'
    : mandatoryRoth ? 'MANDATORY ROTH' : 'CHOICE AVAILABLE';

  // This scenario treats the regular elective limit as the only catch-up trigger.
  const baseCents = Math.round(base * 100);
  const catchUpCents = Math.round(catchUp * 100);
  const plannedCents = baseCents + catchUpCents;
  const appliedBaseCents = Math.min(plannedCents, LIMITS.baseDeferral * 100);
  const appliedCatchUpCents = Math.min(plannedCents - appliedBaseCents, catchUpLimit * 100);
  const appliedBase = appliedBaseCents / 100;
  const appliedCatchUp = appliedCatchUpCents / 100;
  const maxEmployee = LIMITS.baseDeferral + catchUpLimit;
  const taxDifference = appliedCatchUp * currentRate / 100;
  const growth = (1 + annualReturn / 100) ** years;
  const rothValue = appliedCatchUp * growth;
  const pretaxPlanValue = rothValue * (1 - retirementRate / 100);
  const brokerageValue = taxDifference * growth;
  const brokerageTax = Math.max(0, brokerageValue - taxDifference) * gainsRate / 100;
  const netTaxSavingsValue = brokerageValue - brokerageTax;
  const pretaxTotalValue = pretaxPlanValue + netTaxSavingsValue;
  // Compare the values at the same cent precision shown in the results.
  const wealthDifference = (Math.round(rothValue * 100) - Math.round(pretaxTotalValue * 100)) / 100;
  const winner = appliedCatchUp === 0 ? 'No catch-up to compare'
    : wealthDifference > 0 ? 'Roth'
    : wealthDifference < 0 ? 'Pre-tax + invested savings' : 'Tie';

  return {
    verdict, mandatoryRoth, employerWages, catchUpLimit, maxEmployee,
    maxWithEmployer: LIMITS.annualAdditions + catchUpLimit,
    appliedBase, appliedCatchUp, appliedTotal: (appliedBaseCents + appliedCatchUpCents) / 100,
    reclassified: appliedBaseCents > baseCents || appliedCatchUpCents > catchUpCents,
    excess: Math.max(0, plannedCents - maxEmployee * 100) / 100,
    taxDifference, paycheckChange: taxDifference === 0 ? 0 : -taxDifference / payPeriods,
    rothValue, pretaxPlanValue, netTaxSavingsValue, pretaxTotalValue, wealthDifference, winner,
  };
}
