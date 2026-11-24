export const LIMITS = Object.freeze({
  annualBenefit: 290_000,
  compensation: 360_000,
  annualAdditions: 72_000,
  electiveDeferral: 24_500,
  catchUp: 8_000,
  enhancedCatchUp: 11_250,
  rothWageThreshold: 150_000,
  profitSharingRate: 0.06,
  illustrativeBalanceCeiling: 3_600_000,
  interestRate: 0.05,
  projectionYears: 10,
});

const ageSchedule = [
  [35, 85_000], [40, 110_000], [45, 145_000], [50, 190_000],
  [55, 250_000], [60, 325_000], [62, 345_000], [65, 365_000],
];

export function benchmarkForAge(age) {
  if (!Number.isFinite(age) || age < 35 || age > 65) {
    throw new RangeError('Enter an age from 35 through 65.');
  }
  const upperIndex = ageSchedule.findIndex(([upperAge]) => age <= upperAge);
  if (upperIndex === 0) return ageSchedule[0][1];

  const [lowerAge, lowerAmount] = ageSchedule[upperIndex - 1];
  const [upperAge, upperAmount] = ageSchedule[upperIndex];
  return lowerAmount + (upperAmount - lowerAmount) * (age - lowerAge) / (upperAge - lowerAge);
}

function checkRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter ${label} from ${min.toLocaleString('en-US')} through ${max.toLocaleString('en-US')}.`);
  }
}

export function estimatePlan({
  age, retirementAge, compensation, priorWages, openingBalance, federalRate, stateRate,
}) {
  const benchmark = benchmarkForAge(age);
  checkRange(retirementAge, 62, 65, 'a retirement age');
  if (retirementAge < age) throw new RangeError('Retirement age must be at least your current age.');
  checkRange(compensation, 0, 1e9, '2026 eligible compensation');
  checkRange(priorWages, 0, 1e9, '2025 employer wages');
  checkRange(openingBalance, 0, 1e9, 'an opening cash balance');
  checkRange(federalRate, 0, 100, 'a federal tax rate');
  checkRange(stateRate, 0, 100, 'a state tax rate');
  if (federalRate + stateRate > 100) throw new RangeError('Combined tax rates must be 100% or less.');

  const coveredCompensation = Math.min(compensation, LIMITS.compensation);
  const compensationRatio = coveredCompensation / LIMITS.compensation;
  const annualAdditionsLimit = Math.min(LIMITS.annualAdditions, coveredCompensation);
  const deferral = Math.min(LIMITS.electiveDeferral, annualAdditionsLimit);
  const profitSharing = Math.min(
    coveredCompensation * LIMITS.profitSharingRate,
    annualAdditionsLimit - deferral,
  );
  const catchUpLimit = age >= 60 && age < 64
    ? LIMITS.enhancedCatchUp
    : age >= 50 ? LIMITS.catchUp : 0;
  const catchUp = Math.min(catchUpLimit, coveredCompensation - deferral);
  const rothCatchUp = priorWages > LIMITS.rothWageThreshold ? catchUp : 0;

  const yearsToRetirement = retirementAge - age;
  const creditYears = Math.max(1, Math.ceil(yearsToRetirement));
  const growth = 1 + LIMITS.interestRate;
  const projection = [];
  let projectedBalance = openingBalance;
  for (let year = 1; year <= LIMITS.projectionYears; year++) {
    projectedBalance *= growth;
    let payCredit = 0;
    if (year <= creditYears) {
      const remainingYears = Math.max(0, yearsToRetirement - year);
      const balanceCeiling = LIMITS.illustrativeBalanceCeiling / growth ** remainingYears;
      const fundingRoom = Math.max(0, balanceCeiling - projectedBalance);
      const yearBenchmark = year === 1 ? benchmark : benchmarkForAge(age + year - 1);
      payCredit = Math.min(yearBenchmark * compensationRatio, fundingRoom);
      projectedBalance += payCredit;
    }
    projection.push({ year, payCredit, balance: projectedBalance });
  }

  const cashBalance = projection[0].payCredit;
  const stacked401k = deferral + catchUp + profitSharing;
  const pretax401k = stacked401k - rothCatchUp;
  const totalShelter = cashBalance + pretax401k;
  return {
    coveredCompensation,
    cashBalance,
    deferral,
    catchUp,
    rothCatchUp,
    profitSharing,
    stacked401k,
    totalShelter,
    extraShelter: cashBalance + profitSharing,
    taxSavings: totalShelter * ((federalRate + stateRate) / 100),
    projectedBalance,
    projection,
  };
}
