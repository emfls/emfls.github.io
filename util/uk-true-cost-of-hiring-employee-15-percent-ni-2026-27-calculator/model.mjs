export const PARAMETERS = Object.freeze({
  niRate: 0.15,
  secondaryThreshold: 5000,
  reliefThreshold: 50270,
  previousNIRate: 0.138,
  previousSecondaryThreshold: 9100,
  employmentAllowance: 10500,
  pensionTrigger: 10000,
  pensionLowerLimit: 6240,
  pensionUpperLimit: 50270,
  minimumEmployerPensionRate: 3,
  levyRate: 0.005,
  levyPaybillThreshold: 3000000,
  levyAllowance: 15000,
});

function requireRange(value, minimum, maximum, label) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum.toLocaleString('en-GB')} and ${maximum.toLocaleString('en-GB')}.`);
  }
}

function contribution(pay, threshold, rate) {
  return Math.max(0, pay - threshold) * rate;
}

/** Annual budgeting model for employees with identical pay and payroll settings. */
export function calculateHiringCost({
  grossSalary,
  headcount = 1,
  niCategory = 'standard',
  allowanceEligible = false,
  soleDirector = false,
  pensionParticipation = 'auto',
  autoEnrolmentAge = true,
  pensionBasis = 'qualifying',
  pensionRate = PARAMETERS.minimumEmployerPensionRate,
  includeLevy = false,
  useSalarySacrifice = false,
  salarySacrifice = 0,
}) {
  requireRange(grossSalary, 0, 100000000, 'Gross salary');
  requireRange(headcount, 1, 1000000, 'Team size');
  requireRange(pensionRate, PARAMETERS.minimumEmployerPensionRate, 100, 'Employer pension rate');
  if (!Number.isInteger(headcount)) throw new RangeError('Team size must be a whole number.');
  if (!['standard', 'under21', 'apprentice', 'veteran'].includes(niCategory)) {
    throw new RangeError('Choose a supported employer NI category.');
  }
  if (!['qualifying', 'full'].includes(pensionBasis) ||
      !['auto', 'enrolled', 'none'].includes(pensionParticipation)) {
    throw new RangeError('Choose a supported pension basis and enrolment status.');
  }

  const rates = PARAMETERS;
  const sacrificedPay = useSalarySacrifice ? salarySacrifice : 0;
  requireRange(sacrificedPay, 0, grossSalary, 'Annual salary sacrifice');
  const cashPay = grossSalary - sacrificedPay;
  const niThreshold = niCategory === 'standard' ? rates.secondaryThreshold : rates.reliefThreshold;
  const employerNI = contribution(cashPay, niThreshold, rates.niRate);
  const niBeforeSacrifice = contribution(grossSalary, niThreshold, rates.niRate);
  const totalTeamEmployerNI = employerNI * headcount;
  const allowanceLimit = allowanceEligible && !(headcount === 1 && soleDirector)
    ? rates.employmentAllowance : 0;
  const allowanceCredit = Math.min(totalTeamEmployerNI, allowanceLimit);
  const netTeamEmployerNI = totalTeamEmployerNI - allowanceCredit;
  const netTeamNIBeforeSacrifice = Math.max(0, niBeforeSacrifice * headcount - allowanceLimit);

  const automaticallyEnrolled = autoEnrolmentAge && niCategory !== 'under21' &&
    cashPay > rates.pensionTrigger;
  const pensionApplies = pensionParticipation === 'enrolled' ||
    (pensionParticipation === 'auto' && automaticallyEnrolled);
  const pensionablePay = pensionBasis === 'full' ? grossSalary :
    Math.max(0, Math.min(grossSalary, rates.pensionUpperLimit) - rates.pensionLowerLimit);
  const employerPension = pensionApplies ? pensionablePay * pensionRate / 100 : 0;

  const teamPaybill = cashPay * headcount;
  const teamLevy = includeLevy && teamPaybill > rates.levyPaybillThreshold
    ? teamPaybill * rates.levyRate - rates.levyAllowance : 0;
  const levyPerEmployee = teamLevy / headcount;
  const netEmployerNI = netTeamEmployerNI / headcount;
  const annualCost = grossSalary + employerPension + netEmployerNI + levyPerEmployee;
  const previousStandardNI = contribution(grossSalary, rates.previousSecondaryThreshold, rates.previousNIRate);
  const currentStandardNI = contribution(grossSalary, rates.secondaryThreshold, rates.niRate);

  return {
    cashPay,
    sacrificedPay,
    employerNI,
    grossNISaving: niBeforeSacrifice - employerNI,
    netNISaving: (netTeamNIBeforeSacrifice - netTeamEmployerNI) / headcount,
    pensionApplies,
    employerPension,
    teamPaybill,
    teamLevy,
    levyPerEmployee,
    totalTeamEmployerNI,
    allowanceCredit,
    netTeamEmployerNI,
    netEmployerNI,
    annualCost,
    monthlyCost: annualCost / 12,
    teamAnnualCost: annualCost * headcount,
    overheadPercent: grossSalary > 0 ? (employerPension + netEmployerNI + levyPerEmployee) / grossSalary * 100 : null,
    previousStandardNI,
    currentStandardNI,
    extraStandardNI: currentStandardNI - previousStandardNI,
  };
}
