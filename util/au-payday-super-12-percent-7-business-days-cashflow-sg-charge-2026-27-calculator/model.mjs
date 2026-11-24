export const PAYDAY_SUPER = Object.freeze({
  sgRate: 0.12,
  annualContributionBase: 270830,
  standardBusinessDays: 7,
  firstContributionBusinessDays: 20,
  quarterlyAverageFloatDays: 73,
  paydayReceiptLagDays: 10,
  quarterlyReceiptLagDays: 28,
  defaultGicRate: 11.51
});

const DAYS_PER_YEAR = 365;
const PAY_RUNS = { weekly: 52, fortnightly: 26, monthly: 12 };

function periodsFor(frequency) {
  if (!Object.hasOwn(PAY_RUNS, frequency)) throw new RangeError('Choose a supported pay cycle.');
  return PAY_RUNS[frequency];
}

function inRange(value, min, max, label, whole = false) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${whole ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
  }
}

// QE day is day 1 of the disclosure period under regulation 13D.
export function administrativeUpliftRate(disclosureDay, cleanHistory) {
  if (disclosureDay !== null) inRange(disclosureDay, 1, 3650, 'Disclosure day', true);
  let reduction = cleanHistory ? 20 : 0;
  if (disclosureDay !== null) {
    if (disclosureDay <= 30) reduction += 40;
    else if (disclosureDay <= 60) reduction += 35;
    else if (disclosureDay <= 120) reduction += 30;
    else reduction += 15;
  }
  return (60 - reduction) / 100;
}

export function calculateEmployer({
  annualPayroll, frequency, employees, financingRate, daysLate,
  gicRate = PAYDAY_SUPER.defaultGicRate, disclosureDay = null, cleanHistory = false
}) {
  inRange(annualPayroll, 0, 1e12, 'Annual qualifying payroll');
  inRange(employees, 1, 1e7, 'Employee count', true);
  inRange(financingRate, 0, 100, 'Working-capital rate');
  inRange(daysLate, 0, 90, 'Days late', true);
  inRange(gicRate, 0, 100, 'GIC rate');

  const periodsPerYear = periodsFor(frequency);
  const annualSg = annualPayroll * PAYDAY_SUPER.sgRate;
  const perPayRunSg = annualSg / periodsPerYear;
  const floatReduction = annualSg *
    (PAYDAY_SUPER.quarterlyAverageFloatDays - PAYDAY_SUPER.paydayReceiptLagDays) / DAYS_PER_YEAR;
  const unpaidSg = daysLate > 0 ? perPayRunSg : 0;
  const notionalEarnings = unpaidSg * Math.expm1(daysLate * Math.log1p(gicRate / 100 / DAYS_PER_YEAR));
  const upliftRate = administrativeUpliftRate(disclosureDay, cleanHistory);
  const uplift = (unpaidSg + notionalEarnings) * upliftRate;
  const extraCost = notionalEarnings + uplift;

  return {
    periodsPerYear, annualSg, perPayRunSg, averageSgPerEmployee: perPayRunSg / employees,
    floatReduction, annualFinancingCost: floatReduction * financingRate / 100,
    unpaidSg, notionalEarnings, upliftRate, uplift, extraCost, totalCharge: unpaidSg + extraCost
  };
}

function projectContributions(annualSg, periods, lagDays, years, logAnnualReturn) {
  const contribution = annualSg / periods;
  let earnings = 0;
  let received = 0;
  let pending = 0;

  for (let period = 1; period <= years * periods; period++) {
    const yearsInvested = (years * periods - period) / periods - lagDays / DAYS_PER_YEAR;
    if (yearsInvested < 0) {
      pending += contribution;
    } else {
      received += contribution;
      earnings += contribution * Math.expm1(yearsInvested * logAnnualReturn);
    }
  }
  return { balance: received + earnings, pending, earnings };
}

export function calculateEmployee({ annualEarnings, frequency, netReturn, years }) {
  inRange(annualEarnings, 0, 1e9, 'Annual qualifying earnings');
  inRange(netReturn, -99, 50, 'Expected net return');
  inRange(years, 0, 67, 'Years to retirement', true);

  const periodsPerYear = periodsFor(frequency);
  const annualSg = Math.min(annualEarnings, PAYDAY_SUPER.annualContributionBase) * PAYDAY_SUPER.sgRate;
  const logAnnualReturn = Math.log1p(netReturn / 100);
  const payday = projectContributions(annualSg, periodsPerYear, PAYDAY_SUPER.paydayReceiptLagDays, years, logAnnualReturn);
  const quarterly = projectContributions(annualSg, 4, PAYDAY_SUPER.quarterlyReceiptLagDays, years, logAnnualReturn);
  return { annualSg, periodsPerYear, payday, quarterly, gain: payday.earnings - quarterly.earnings };
}
