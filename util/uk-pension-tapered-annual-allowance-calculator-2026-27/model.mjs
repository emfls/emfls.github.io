const STANDARD_AA = 60_000;
const MINIMUM_AA = 10_000;
const THRESHOLD_LIMIT = 20_000_000;
const ADJUSTED_LIMIT = 26_000_000;
const PREVIOUS_YEARS = ['2023/24', '2024/25', '2025/26'];
const TAX_RATES = { restOfUK: 45, scotland: 48 };

function toPence(value, label, max = 1_000_000_000) {
  const scaled = value * 100;
  const pence = Math.round(scaled);
  if (!Number.isFinite(value) || value < 0 || value > max || value !== pence / 100) {
    throw new RangeError(`${label} must be between £0 and £${max.toLocaleString('en-GB')}, with up to two decimal places.`);
  }
  return pence;
}

function availableByYear(history) {
  if (!Array.isArray(history)) throw new RangeError('Enter prior years as a list.');
  const available = new Map();
  for (const row of history) {
    const { year, member, annualAllowance, pensionInput, alreadyUsed = 0 } = row;
    if (!PREVIOUS_YEARS.includes(year) || available.has(year) || typeof member !== 'boolean') {
      throw new RangeError('Enter each supported prior tax year once and specify scheme membership.');
    }
    const unused = member ? Math.max(0,
      toPence(annualAllowance, `${year} annual allowance`, STANDARD_AA)
      - toPence(pensionInput, `${year} pension input`)
      - toPence(alreadyUsed, `${year} allowance already used`)) : 0;
    available.set(year, unused);
  }
  return PREVIOUS_YEARS.map(year => ({ year, available: available.get(year) ?? 0 }));
}

function assess(currentYearAA, pensionInput, priorYears, rate) {
  let excess = Math.max(0, pensionInput - currentYearAA * 100);
  let availableCarryForward = 0;
  let carryForwardUsed = 0;
  const carryForward = priorYears.map(({ year, available }) => {
    const used = Math.min(excess, available);
    excess -= used;
    availableCarryForward += available;
    carryForwardUsed += used;
    return { year, available: available / 100, used: used / 100, remaining: (available - used) / 100 };
  });
  const maximumPensionInput = currentYearAA * 100 + availableCarryForward;
  const chargePence = Math.round(excess * rate / 100);
  return {
    currentYearAA,
    pensionInput: pensionInput / 100,
    carryForward,
    availableCarryForward: availableCarryForward / 100,
    carryForwardUsed: carryForwardUsed / 100,
    maximumPensionInput: maximumPensionInput / 100,
    remainingHeadroom: Math.max(0, maximumPensionInput - pensionInput) / 100,
    excess: excess / 100,
    taxCharge: chargePence / 100,
    schemePaysAlert: chargePence > 200_000,
  };
}

/** Inputs and outputs are in pounds. All intermediate monetary arithmetic uses pence. */
export function calculatePensionAllowance({
  netIncome,
  personalReliefAtSourceGrossContrib,
  postJuly2015SalarySacrifice,
  employerPensionContributions,
  netPayEmployeeContributions,
  earnedIncome,
  region,
  history = [],
}) {
  if (!Object.hasOwn(TAX_RATES, region)) throw new RangeError('Select a UK tax region.');
  const rate = TAX_RATES[region];
  const net = toPence(netIncome, 'Net income');
  const reliefAtSource = toPence(personalReliefAtSourceGrossContrib, 'Gross relief-at-source contributions');
  const sacrifice = toPence(postJuly2015SalarySacrifice, 'Relevant salary sacrifice');
  const employer = toPence(employerPensionContributions, 'Employer pension contributions');
  const netPay = toPence(netPayEmployeeContributions, 'Net pay employee contributions');
  const earnings = toPence(earnedIncome, 'Relevant UK earnings');
  if (sacrifice > employer) throw new RangeError('Include salary-sacrifice pension contributions in the employer total.');

  const thresholdIncome = net - reliefAtSource + sacrifice;
  const adjustedIncome = net + employer + netPay;
  const taperApplies = thresholdIncome > THRESHOLD_LIMIT && adjustedIncome > ADJUSTED_LIMIT;
  const taperReduction = taperApplies ? Math.floor((adjustedIncome - ADJUSTED_LIMIT) / 200) : 0;
  const currentYearAA = Math.max(MINIMUM_AA, STANDARD_AA - taperReduction);
  const pensionInput = employer + netPay + reliefAtSource;
  const priorYears = availableByYear(history);

  // The £3,600 basic amount can be accessed via relief at source. Net pay uses earnings.
  const personalReliefLimit = Math.max(360_000, earnings);
  const personalReliefExcess = Math.max(0, netPay - earnings, netPay + reliefAtSource - personalReliefLimit);
  const personalReliefRemaining = personalReliefExcess ? 0 : personalReliefLimit - netPay - reliefAtSource;

  let thresholdScenario = null;
  if (currentYearAA < STANDARD_AA) {
    const extraGross = thresholdIncome - THRESHOLD_LIMIT;
    thresholdScenario = {
      ...assess(STANDARD_AA, pensionInput + extraGross, priorYears, rate),
      grossContribution: extraGross / 100,
      netPayment: Math.round(extraGross * 4 / 5) / 100,
      withinReliefLimit: extraGross <= personalReliefRemaining,
    };
  }

  return {
    ...assess(currentYearAA, pensionInput, priorYears, rate),
    thresholdIncome: thresholdIncome / 100,
    adjustedIncome: adjustedIncome / 100,
    taperApplies,
    taperReduction,
    rate,
    personalReliefLimit: personalReliefLimit / 100,
    personalReliefExcess: personalReliefExcess / 100,
    personalReliefRemaining: personalReliefRemaining / 100,
    thresholdScenario,
  };
}
