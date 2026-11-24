export const LIMITS_2026 = Object.freeze({
  elective: 24_500,
  annualAdditions: 72_000,
  rothWageThreshold: 150_000,
  catchUp: Object.freeze({ 'under-50': 0, '50-plus': 8_000, '60-63': 11_250 })
});

function range(value, min, max, name) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}.`);
  }
  return value;
}

function cents(value, label, max = 1_000_000_000) {
  const scaled = range(value, 0, max, label) * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 0.0001) {
    throw new RangeError(`${label} must be entered to the nearest cent.`);
  }
  return rounded;
}

export function calculateContributions({
  ageBracket, compensation, baseElectiveDeferral, otherElectiveDeferrals = 0,
  employerContributions, priorFicaWages, catchUpElection, planSupportsMega, payPeriods
}) {
  if (!Object.hasOwn(LIMITS_2026.catchUp, ageBracket)) throw new RangeError('Choose a valid age bracket.');
  if (!['roth', 'pretax', 'none'].includes(catchUpElection)) throw new RangeError('Choose a catch-up election.');
  if (typeof planSupportsMega !== 'boolean') throw new RangeError('Choose whether your plan supports the strategy.');
  if (![24, 26].includes(payPeriods)) throw new RangeError('Choose 24 or 26 pay periods.');

  const pay = cents(compensation, '2026 compensation');
  const plannedBase = cents(baseElectiveDeferral, 'Planned base deferral', LIMITS_2026.elective);
  const otherBase = cents(otherElectiveDeferrals, 'Regular deferrals at other employers');
  const employer = cents(employerContributions, 'Employer contributions and forfeitures');
  const wages = cents(priorFicaWages, '2025 FICA wages');
  const electiveLimit = LIMITS_2026.elective * 100;
  const base = Math.min(pay, plannedBase, Math.max(0, electiveLimit - otherBase));
  const annualAdditionsLimit = Math.min(pay, LIMITS_2026.annualAdditions * 100);
  const annualAdditions = base + employer;
  const excessAnnualAdditions = Math.max(0, annualAdditions - annualAdditionsLimit);
  const excessOtherDeferrals = Math.max(0, otherBase - electiveLimit);
  const megaAfterTaxRoom = Math.max(0, annualAdditionsLimit - annualAdditions);
  const catchUpLimit = LIMITS_2026.catchUp[ageBracket] * 100;
  const rothRequired = catchUpLimit > 0 && wages > LIMITS_2026.rothWageThreshold * 100;
  const catchUpStatus = catchUpLimit === 0 ? 'age-ineligible'
    : catchUpElection === 'none' ? 'no-catch-up'
    : !rothRequired ? 'roth-optional'
    : catchUpElection === 'roth' ? 'roth-required'
    : 'roth-election-needed';

  const hasExcess = excessAnnualAdditions > 0 || excessOtherDeferrals > 0;
  const canIncludeCatchUp = !hasExcess && base + otherBase === electiveLimit
    && catchUpElection !== 'none' && catchUpStatus !== 'roth-election-needed';
  const catchUp = canIncludeCatchUp ? Math.min(catchUpLimit, pay - base) : 0;
  const usableAfterTaxRoom = planSupportsMega && !hasExcess
    ? Math.min(megaAfterTaxRoom, pay - base - catchUp) : 0;

  return {
    annualAdditionsLimit: annualAdditionsLimit / 100,
    baseElectiveDeferral: base / 100,
    baseDeferralReduction: (plannedBase - base) / 100,
    excessAnnualAdditions: excessAnnualAdditions / 100,
    excessOtherDeferrals: excessOtherDeferrals / 100,
    megaAfterTaxRoom: megaAfterTaxRoom / 100,
    usableAfterTaxRoom: usableAfterTaxRoom / 100,
    catchUpLimit: catchUpLimit / 100,
    catchUp: catchUp / 100,
    rothRequired,
    catchUpStatus,
    totalPlanContributions: hasExcess ? null : (annualAdditions + usableAfterTaxRoom + catchUp) / 100,
    perPaycheck: Math.floor(usableAfterTaxRoom / payPeriods) / 100
  };
}

export function projectGrowth({
  principal, expectedReturn, marginalTaxRate, capitalGainsRate, horizonYears, delayDays
}) {
  range(principal, 0, LIMITS_2026.annualAdditions, 'Starting contribution');
  const growth = 1 + range(expectedReturn, -99, 100, 'Expected return') / 100;
  const ordinaryTax = range(marginalTaxRate, 0, 100, 'Marginal tax rate') / 100;
  const gainsTax = range(capitalGainsRate, 0, 100, 'Capital gains rate') / 100;
  const years = range(horizonYears, 1, 60, 'Horizon');
  const delayYears = range(delayDays, 0, years * 365, 'Conversion delay in days') / 365;
  const conversionBalance = principal * growth ** delayYears;
  const taxableConversionEarnings = Math.max(0, conversionBalance - principal);
  const conversionTax = taxableConversionEarnings * ordinaryTax;
  const beforeTax = principal * growth ** years;
  const brokerageNet = beforeTax - Math.max(0, beforeTax - principal) * gainsTax;
  const conversionTaxDrag = conversionTax * growth ** (years - delayYears);
  const rothNet = beforeTax - conversionTaxDrag;

  return {
    taxableConversionEarnings,
    conversionTax,
    conversionTaxDrag,
    brokerageNet,
    rothNet,
    advantage: Math.max(0, beforeTax - principal) * gainsTax - conversionTaxDrag
  };
}
