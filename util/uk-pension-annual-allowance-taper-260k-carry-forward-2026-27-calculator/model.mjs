export const PRIOR_YEARS = Object.freeze(['2023/24', '2024/25', '2025/26']);
export const STANDARD_ALLOWANCE = 60_000;
export const THRESHOLD_LIMIT = 200_000;
export const ADJUSTED_LIMIT = 260_000;
export const MINIMUM_ALLOWANCE = 10_000;
export const MPAA = 10_000;
export const CHARGE_RATE = 45;
export const MAX_AMOUNT = 1_000_000_000;
const BASIC_RELIEF_AT_SOURCE = 3_600;
const PENCE = 100;

function toPence(amount, label, minimum = 0, maximum = MAX_AMOUNT) {
  const pence = Math.round(amount * PENCE);
  if (!Number.isFinite(amount) || amount < minimum || amount > maximum ||
      Math.abs(amount * PENCE - pence) > 0.0001) {
    throw new RangeError(`${label} must be a valid amount with up to two decimal places.`);
  }
  return pence;
}

function allowanceInPence(threshold, adjusted) {
  if (threshold <= THRESHOLD_LIMIT * PENCE || adjusted <= ADJUSTED_LIMIT * PENCE) {
    return STANDARD_ALLOWANCE * PENCE;
  }
  const reduction = Math.floor((adjusted - ADJUSTED_LIMIT * PENCE) / (2 * PENCE));
  return Math.max(MINIMUM_ALLOWANCE, STANDARD_ALLOWANCE - reduction) * PENCE;
}

export function taperedAllowance(thresholdIncome, adjustedIncome) {
  return allowanceInPence(
    toPence(thresholdIncome, 'Threshold income', -MAX_AMOUNT * 4, MAX_AMOUNT * 4),
    toPence(adjustedIncome, 'Adjusted income', -MAX_AMOUNT * 4, MAX_AMOUNT * 4)
  ) / PENCE;
}

function allocate(total, currentAllowance, available) {
  const currentUsed = Math.min(total, currentAllowance);
  let excess = total - currentUsed;
  const carryForward = available.map((balance, index) => {
    const used = Math.min(balance, excess);
    excess -= used;
    return {
      year: PRIOR_YEARS[index],
      available: balance / PENCE,
      used: used / PENCE,
      remaining: (balance - used) / PENCE
    };
  });
  return { currentUsed, carryForward, excess };
}

export function calculatePension({
  incomeBeforeNetPay, relevantEarnings, reliefAtSource, netPay, employer, salarySacrifice,
  definedBenefit = 0, mpaa = false, beforeAccess = 0, prior
}) {
  if (!Array.isArray(prior) || prior.length !== PRIOR_YEARS.length ||
      prior.some((year, index) => year?.year !== PRIOR_YEARS[index] ||
        typeof year.member !== 'boolean') || typeof mpaa !== 'boolean') {
    throw new RangeError('Supply membership and allowance details for all three prior years.');
  }

  const income = toPence(incomeBeforeNetPay, 'Income before net-pay contributions', -MAX_AMOUNT);
  const earnings = toPence(relevantEarnings, 'Relevant UK earnings');
  const ras = toPence(reliefAtSource, 'Gross relief-at-source contributions');
  const payroll = toPence(netPay, 'Net-pay contributions');
  const employerDc = toPence(employer, 'Employer defined-contribution payments');
  const sacrifice = toPence(salarySacrifice, 'Relevant salary sacrifice');
  const db = toPence(definedBenefit, 'Defined-benefit pension input');
  const preAccess = mpaa ? toPence(beforeAccess, 'Pre-access defined-contribution savings') : 0;
  const personal = ras + payroll;
  const dc = personal + employerDc;
  const total = dc + db;
  if (preAccess > dc) {
    throw new RangeError('Pre-access savings cannot exceed total defined-contribution savings.');
  }

  const available = prior.map(({ member, allowance, used }, index) => {
    if (!member) return 0;
    const limit = toPence(allowance, `${PRIOR_YEARS[index]} allowance`, 0, STANDARD_ALLOWANCE);
    return Math.max(0, limit - toPence(used, `${PRIOR_YEARS[index]} allowance used`));
  });
  const carryTotal = available.reduce((sum, balance) => sum + balance, 0);

  // HMRC adds back net pay to adjusted income and counts salary sacrifice through employer input.
  const threshold = income - personal + sacrifice;
  const adjusted = income + employerDc + db;
  const annual = allowanceInPence(threshold, adjusted);
  const standard = allocate(total, annual, available);
  const mpaaLimit = MPAA * PENCE;
  const mpaaExcess = mpaa ? Math.max(0, dc - preAccess - mpaaLimit) : 0;
  let allocation = standard;
  if (mpaaExcess > 0) {
    const alternative = allocate(preAccess + db, annual - mpaaLimit, available);
    if (alternative.excess + mpaaExcess > standard.excess) {
      allocation = {
        ...alternative,
        currentUsed: alternative.currentUsed + mpaaLimit,
        excess: alternative.excess + mpaaExcess
      };
    }
  }

  const personalCap = Math.max(earnings, BASIC_RELIEF_AT_SOURCE * PENCE);
  const payrollExcess = Math.max(0, payroll - earnings);
  // Hold net pay and employer/DB inputs fixed. Vary gross relief at source, which can switch off taper.
  const fixed = payroll + employerDc + db;
  const contributionCeiling = mpaa ? preAccess + mpaaLimit - payroll - employerDc : Infinity;
  const standardRas = Math.min(personalCap - payroll, contributionCeiling,
    STANDARD_ALLOWANCE * PENCE + carryTotal - fixed);
  const candidateAllowance = allowanceInPence(income - payroll - standardRas + sacrifice, adjusted);
  const maximumRas = Math.min(standardRas, candidateAllowance + carryTotal - fixed);
  const feasible = !payrollExcess && maximumRas >= Math.max(0, preAccess - payroll - employerDc);

  return {
    thresholdIncome: threshold / PENCE,
    adjustedIncome: adjusted / PENCE,
    annualAllowance: annual / PENCE,
    currentUsed: allocation.currentUsed / PENCE,
    carryForward: allocation.carryForward,
    carryForwardAvailable: carryTotal / PENCE,
    expiringAllowance: allocation.carryForward[0].remaining,
    totalPensionInput: total / PENCE,
    personalReliefCap: personalCap / PENCE,
    personalReliefExcess: (payrollExcess + Math.max(0, ras - (personalCap - payroll + payrollExcess))) / PENCE,
    maximumTaxRelievedContribution: feasible ? (maximumRas + payroll + employerDc) / PENCE : null,
    maximumPersonalContribution: feasible ? (maximumRas + payroll) / PENCE : null,
    annualAllowanceExcess: allocation.excess / PENCE,
    estimatedCharge: Math.round(allocation.excess * CHARGE_RATE / 100) / PENCE,
    mpaaExcess: mpaaExcess / PENCE
  };
}
