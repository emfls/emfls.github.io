// Inputs and results are in pounds. Use integer pence for allowance allocation.
export const PRIOR_YEARS = Object.freeze(['2023/24', '2024/25', '2025/26']);
const STANDARD = 60000;
const MINIMUM_TAPERED = 10000;
const MPAA = 10000;
const MAX_AMOUNT = 1000000000;
const CHARGE_RATES = [20, 40, 45, 60];

function toPence(amount, label, min = 0, max = MAX_AMOUNT) {
  const pence = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < min || amount > max || pence / 100 !== amount) {
    throw new RangeError(`${label} must be between £${min.toLocaleString('en-GB')} and £${max.toLocaleString('en-GB')}, to the nearest penny.`);
  }
  return pence;
}

export function annualAllowance(thresholdIncome, adjustedIncome) {
  const threshold = toPence(thresholdIncome, 'Threshold income', -MAX_AMOUNT);
  const adjusted = toPence(adjustedIncome, 'Adjusted income', -MAX_AMOUNT);
  if (threshold <= 20000000 || adjusted <= 26000000) return STANDARD;

  const taperReduction = Math.floor((adjusted - 26000000) / 200);
  return Math.max(MINIMUM_TAPERED, STANDARD - taperReduction);
}

export function calculatePension({
  earnings, thresholdIncome, adjustedIncome, personal, employer, prior, mpaaTriggered, taxRate,
}) {
  const currentYearAA = annualAllowance(thresholdIncome, adjustedIncome);
  const earningsCap = toPence(earnings, 'Relevant UK earnings');
  const personalPence = toPence(personal, 'Gross personal contributions');
  const employerPence = toPence(employer, 'Employer contributions');
  if (typeof mpaaTriggered !== 'boolean') throw new TypeError('Specify whether MPAA was triggered.');
  if (!CHARGE_RATES.includes(taxRate)) throw new RangeError('Select a charge scenario rate.');
  if (!Array.isArray(prior) || prior.length !== PRIOR_YEARS.length) {
    throw new RangeError('Enter one carry-forward record per prior tax year.');
  }

  const dcAllowance = mpaaTriggered ? MPAA : currentYearAA;
  const totalInput = personalPence + employerPence;
  let excess = Math.max(0, totalInput - dcAllowance * 100);
  let carryForwardAvailable = 0;
  let carryForwardUsed = 0;
  const carryForward = PRIOR_YEARS.map((year, index) => {
    const row = prior[index];
    if (typeof row?.member !== 'boolean') throw new TypeError(`Specify scheme membership for ${year}.`);
    const available = row.member && !mpaaTriggered
      ? toPence(row.unused, `Unused allowance for ${year}`, 0, STANDARD)
      : 0;
    const used = Math.min(excess, available);
    excess -= used;
    carryForwardAvailable += available;
    carryForwardUsed += used;
    return { year, available: available / 100, used: used / 100, remaining: (available - used) / 100 };
  });

  const totalAllowance = dcAllowance * 100 + carryForwardAvailable;
  const personalRoom = totalAllowance - employerPence;
  const maximumTaxRelievedTotal = personalRoom < 0
    ? null
    : (employerPence + Math.min(earningsCap, personalRoom)) / 100;

  return {
    currentYearAA,
    dcAllowance,
    carryForward,
    carryForwardAvailable: carryForwardAvailable / 100,
    carryForwardUsed: carryForwardUsed / 100,
    totalAllowance: totalAllowance / 100,
    totalInput: totalInput / 100,
    maximumTaxRelievedTotal,
    unusedAllowance: Math.max(0, totalAllowance - totalInput) / 100,
    excess: excess / 100,
    estimatedCharge: Math.round(excess * taxRate / 100) / 100,
    personalOverEarnings: Math.max(0, personalPence - earningsCap) / 100,
  };
}
