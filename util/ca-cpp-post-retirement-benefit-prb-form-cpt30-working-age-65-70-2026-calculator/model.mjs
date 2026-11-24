export const CPP_2026 = Object.freeze({
  ybe: 3500,
  ympe: 74600,
  yampe: 85000,
  baseRate: 0.0495,
  firstEnhancedRate: 0.01,
  secondEnhancedRate: 0.04,
  federalCreditRate: 0.14,
  gisReduction: 0.50,
  publishedMonthlyPrb: 54.69,
  // Earnings ceilings for 2023–2027, for a benefit starting in 2027.
  pensionableEarningsAverage: (66600 + 68500 + 71300 + 74600 + 76700) / 5,
});

const EMPLOYEE = 'employee_single_side';
const SELF_EMPLOYED = 'self_employed_double_side';

function employmentSides(type) {
  if (type === EMPLOYEE) return 1;
  if (type === SELF_EMPLOYED) return 2;
  throw new RangeError('Choose employee or self-employed.');
}

function inRange(value, min, max, label, whole = false) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${whole ? 'a whole number ' : ''}from ${min} to ${max}.`);
  }
}

function earningsByTier(earnings) {
  inRange(earnings, 0, Number.MAX_SAFE_INTEGER, 'Annual pensionable earnings');
  return {
    first: Math.max(0, Math.min(earnings, CPP_2026.ympe) - CPP_2026.ybe),
    second: Math.max(0, Math.min(earnings, CPP_2026.yampe) - CPP_2026.ympe),
  };
}

const cents = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function annualContributions(earnings, employmentType, taxPercent) {
  inRange(taxPercent, 0, 60, 'Marginal tax rate');
  const { first, second } = earningsByTier(earnings);
  const sides = employmentSides(employmentType);
  const base = first * CPP_2026.baseRate;
  const tier1 = cents(sides * first * (CPP_2026.baseRate + CPP_2026.firstEnhancedRate));
  const tier2 = cents(sides * second * CPP_2026.secondEnhancedRate);
  const gross = cents(tier1 + tier2);
  const creditable = cents(base);
  // One base share is creditable. The other base share and all enhancements are deductible.
  const deductible = cents(gross - creditable);
  const credit = taxPercent > 0 ? creditable * CPP_2026.federalCreditRate : 0;
  const net = cents(gross - deductible * taxPercent / 100 - credit);
  return { tier1, tier2, gross, creditable, deductible, net };
}

export function ageFactor(ageMonths) {
  inRange(ageMonths, 720, Number.MAX_SAFE_INTEGER, 'Payment age in months', true);
  const monthsFrom65 = Math.min(ageMonths, 840) - 780;
  return 1 + monthsFrom65 * (monthsFrom65 < 0 ? 0.006 : 0.007);
}

export function monthlyPrb(earnings, paymentAgeMonths) {
  const { first, second } = earningsByTier(earnings);
  const factor = ageFactor(paymentAgeMonths);
  // Tier 1 uses a contribution-proportional planning estimate. CPP2 uses
  // the separate earnings band and the 0.00833 factor in CPP Act s. 59.1.
  const firstShare = first / (CPP_2026.ympe - CPP_2026.ybe);
  const secondShare = second / CPP_2026.ympe;
  const annualScale = CPP_2026.pensionableEarningsAverage * 0.00833;
  return (firstShare + secondShare) * annualScale * factor / 12;
}

export function projectPrb({ age, employmentType, earnings, workYears, taxPercent, returnPercent, lifeAge, gis }) {
  inRange(age, 60, 70, 'Age', true);
  inRange(workYears, 1, 5, 'Working years', true);
  inRange(returnPercent, -20, 20, 'Real investment return');
  inRange(lifeAge, 75, 100, 'Life expectancy age', true);
  if (typeof gis !== 'boolean') throw new RangeError('Choose a GIS scenario.');

  const stopped = age >= 70;
  const status = stopped ? 'STOPPED_70_PLUS' : age < 65 ? 'MANDATORY_60_64' : 'OPTIONAL_CPT30_ELIGIBLE';
  const annual = annualContributions(earnings, employmentType, taxPercent);
  const contribution = stopped ? annualContributions(0, employmentType, taxPercent) : annual;
  const years = [];
  for (let offset = 0; offset < Math.min(workYears, 70 - age); offset++) {
    const workAge = age + offset;
    const prbStartAge = workAge + 1;
    const monthlyGrossPrb = monthlyPrb(earnings, prbStartAge * 12);
    years.push({ workAge, prbStartAge, optional: workAge >= 65, monthlyGrossPrb });
  }

  const optionalYears = years.filter(year => year.optional).length;
  const monthlyGrowth = (1 + returnPercent / 100) ** (1 / 12);
  const lastWorkMonth = years.length * 12;
  let simpleBalance = 0;
  let pvAdvantage = 0;
  let simpleBreakEvenAge = null;
  let pvBreakEvenAge = null;
  let lifetimeNetPrb = 0;
  let lifetimeNetPrbAllYears = 0;
  let investmentValue = 0;
  let prbFutureValue = 0;
  let grossPrbPerMonth = 0;
  let optionalPrbPerMonth = 0;
  const hasChoice = optionalYears > 0 && contribution.net > 0;

  for (let month = 1; month <= (lifeAge - age) * 12; month++) {
    const workYear = Math.floor((month - 1) / 12);
    const currentYear = years[workYear];
    if ((month - 1) % 12 === 0 && workYear > 0) {
      const newBenefit = years[workYear - 1];
      if (newBenefit) {
        grossPrbPerMonth += newBenefit.monthlyGrossPrb;
        if (newBenefit.optional) optionalPrbPerMonth += newBenefit.monthlyGrossPrb;
      }
    }

    const gisLoss = gis && age + (month - 1) / 12 >= 65 ? CPP_2026.gisReduction : 0;
    const netShare = 1 - taxPercent / 100 - gisLoss;
    const optionalPrb = optionalPrbPerMonth * netShare;
    const savedContribution = currentYear?.optional ? contribution.net / 12 : 0;
    const difference = optionalPrb - savedContribution;

    lifetimeNetPrbAllYears += grossPrbPerMonth * netShare;
    lifetimeNetPrb += optionalPrb;
    investmentValue = investmentValue * monthlyGrowth + savedContribution;
    prbFutureValue = prbFutureValue * monthlyGrowth + optionalPrb;
    simpleBalance += difference;
    pvAdvantage += difference / monthlyGrowth ** month;

    if (hasChoice && month >= lastWorkMonth && optionalPrb > 0) {
      if (simpleBreakEvenAge === null && simpleBalance >= -1e-8) simpleBreakEvenAge = age + month / 12;
      if (pvBreakEvenAge === null && pvAdvantage >= -1e-8) pvBreakEvenAge = age + month / 12;
    }
  }

  let recommendation = 'KEEP_CONTRIBUTING_FOR_PRB';
  if (stopped) recommendation = 'NO_CONTRIBUTIONS_AT_70';
  else if (contribution.gross === 0) recommendation = 'NO_CONTRIBUTION_AT_THIS_INCOME';
  else if (hasChoice && pvAdvantage < -0.005) {
    recommendation = employmentType === SELF_EMPLOYED ? 'FILE_SCHEDULE_8_OPT_OUT' : 'FILE_FORM_CPT30_OPT_OUT';
  }

  return {
    status, contribution, years, optionalYears, recommendation, simpleBreakEvenAge, pvBreakEvenAge,
    lifetimeNetPrb, lifetimeNetPrbAllYears, investmentValue, prbFutureValue, pvAdvantage,
  };
}
