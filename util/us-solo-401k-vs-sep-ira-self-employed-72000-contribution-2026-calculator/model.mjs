const catchUpByAge = Object.freeze({
  under_50: 0,
  '50_to_59_or_64plus': 8000,
  '60_to_63': 11250,
});

export const LIMITS = Object.freeze({
  annualAdditions: 72000,
  electiveDeferral: 24500,
  compensation: 360000,
  socialSecurityWageBase: 184500,
  catchUpByAge,
});

export function calculateComparison({ entity, income, ageBand, otherDeferral, marginalRate }) {
  const scheduleC = entity === 'schedule_c';
  if (!scheduleC && entity !== 'scorp_w2') throw new RangeError('Choose a valid business type.');
  if (!Object.hasOwn(catchUpByAge, ageBand)) throw new RangeError('Choose a valid age band.');
  if (!Number.isFinite(income) || (!scheduleC && income < 0)) {
    throw new RangeError(scheduleC ? 'Enter a valid Schedule C profit or loss.' : 'Enter wages of $0 or more.');
  }
  if (!Number.isFinite(otherDeferral) || otherDeferral < 0) {
    throw new RangeError('Enter day-job deferrals of $0 or more.');
  }
  if (!Number.isFinite(marginalRate) || marginalRate < 0 || marginalRate > 100) {
    throw new RangeError('Enter a marginal tax rate between 0% and 100%.');
  }

  const seTaxable = scheduleC ? Math.max(0, income) * 0.9235 : 0;
  const ssTax = Math.min(seTaxable, LIMITS.socialSecurityWageBase) * 0.124;
  const medTax = seTaxable * 0.029;
  const halfSeTax = (ssTax + medTax) / 2;
  const compensation = Math.max(0, income - halfSeTax);
  const employerCompensation = Math.min(compensation, LIMITS.compensation);
  const employerLimit = employerCompensation * (scheduleC ? 0.20 : 0.25);

  const regularRoom = Math.max(0, LIMITS.electiveDeferral - otherDeferral);
  const catchUpRoom = Math.max(0, catchUpByAge[ageBand] - Math.max(0, otherDeferral - LIMITS.electiveDeferral));
  const soloRegular = Math.min(regularRoom, compensation);
  const soloCatchUp = Math.min(catchUpRoom, compensation - soloRegular);
  const soloEmployer = Math.min(
    employerLimit,
    LIMITS.annualAdditions - soloRegular,
    compensation - soloRegular - soloCatchUp,
  );
  const soloTotal = soloRegular + soloCatchUp + soloEmployer;
  const sepTotal = Math.min(LIMITS.annualAdditions, employerLimit);

  // Pub. 560's self-employed deduction worksheet also caps the employer
  // deduction at half the adjusted earnings left after regular deferrals.
  const deductibleEmployer = scheduleC
    ? Math.min(soloEmployer, (compensation - soloRegular) / 2)
    : soloEmployer;
  const soloDeductible = soloRegular + soloCatchUp + deductibleEmployer;
  const taxRate = marginalRate / 100;

  return {
    compensation,
    halfSeTax,
    soloRegular,
    soloCatchUp,
    soloEmployer,
    soloTotal,
    soloDeductible,
    sepTotal,
    extraContribution: soloTotal - sepTotal,
    extraTaxSavings: (soloDeductible - sepTotal) * taxRate,
    catchUpTaxSavings: soloCatchUp * taxRate,
    otherDeferralsExceedLimit: otherDeferral > LIMITS.electiveDeferral + catchUpByAge[ageBand],
  };
}
