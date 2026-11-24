/**
 * Tool 511: Australia Workers' Comp PIAWE Weekly Payments Calculator (2026–27 NSW SIRA & VIC WorkSafe)
 * NSW Workers Compensation Act 1987 s34–s37 & VIC Workplace Injury Rehabilitation and Compensation Act 2013
 */

export const JURISDICTIONS_2026_27 = {
  NSW: {
    name: 'New South Wales (SIRA)',
    statutoryMaxWeeklyCap: 2662.10, // SIRA indexed cap 1 Apr 2026 – 31 Mar 2027
    firstPeriodRate: 0.95, // Weeks 1-13: 95%
    secondPeriodRateNoWork: 0.80, // Weeks 14-130: 80%
    secondPeriodRateWithWork: 0.95, // Weeks 14-130 if working >= 15 hrs/wk: 95%
    secondPeriodRateLowWork: 0.80, // Weeks 14-130 if working < 15 hrs/wk: 80%
    minHoursForBoost: 15,
    minEarningsForBoost: 210,
    wpiThreshold: 21 // 21%+ WPI to continue past 130 weeks
  },
  VIC: {
    name: 'Victoria (WorkSafe)',
    statutoryMaxWeeklyCap: 2740.00, // ~2x VIC AWE indexation
    firstPeriodRate: 0.95, // Weeks 1-13: 95%
    secondPeriodRateNoWork: 0.80, // Weeks 14-130: 80%
    secondPeriodRateWithWork: 0.80, // 80% minus actual earnings (or formula)
    secondPeriodRateLowWork: 0.80,
    minHoursForBoost: 15,
    minEarningsForBoost: 210,
    wpiThreshold: 21 // Serious injury / 21%+ WPI
  }
};

export function calculateWorkersComp(params) {
  const {
    jurisdiction = 'NSW',
    baseWeeklyEarnings = 1800,
    regularOvertime = 0,
    regularShiftAllowances = 0,
    workCapacity = 'none', // 'none' (total incapacity) or 'partial' (partial return to work)
    currentWeeklyHours = 0,
    currentWeeklyEarnings = 0,
    wholePersonImpairment = 10 // WPI %
  } = params;

  const config = JURISDICTIONS_2026_27[jurisdiction] || JURISDICTIONS_2026_27.NSW;
  const base = Math.max(0, parseFloat(baseWeeklyEarnings) || 0);
  const ot = Math.max(0, parseFloat(regularOvertime) || 0);
  const shift = Math.max(0, parseFloat(regularShiftAllowances) || 0);

  // Pre-Injury Average Weekly Earnings (PIAWE)
  const calculatedPiawe = base + ot + shift;
  const currentEarnings = Math.max(0, parseFloat(currentWeeklyEarnings) || 0);
  const currentHours = Math.max(0, parseFloat(currentWeeklyHours) || 0);
  const maxCap = config.statutoryMaxWeeklyCap;

  // Period 1: Weeks 1 to 13 (First Entitlement Period)
  let p1WeeklyComp = 0;
  if (workCapacity === 'none' || currentHours === 0) {
    p1WeeklyComp = Math.min(calculatedPiawe * config.firstPeriodRate, maxCap);
  } else {
    // Partial return to work: 95% PIAWE minus actual earnings
    const grossEntitlement = Math.min(calculatedPiawe * config.firstPeriodRate, maxCap);
    p1WeeklyComp = Math.max(0, grossEntitlement - currentEarnings);
  }
  const p1TotalWeeks = 13;
  const p1TotalPayment = p1WeeklyComp * p1TotalWeeks;

  // Period 2: Weeks 14 to 130 (Second Entitlement Period - 117 weeks)
  let p2Rate = config.secondPeriodRateNoWork;
  let hasReturnToWorkBoost = false;

  if (workCapacity === 'partial' && currentHours >= config.minHoursForBoost && currentEarnings >= config.minEarningsForBoost && jurisdiction === 'NSW') {
    p2Rate = config.secondPeriodRateWithWork; // 95% in NSW!
    hasReturnToWorkBoost = true;
  }

  let p2WeeklyComp = 0;
  if (workCapacity === 'none' || currentHours === 0) {
    p2WeeklyComp = Math.min(calculatedPiawe * config.secondPeriodRateNoWork, maxCap);
  } else {
    // Partial return to work
    const grossCap = Math.min(calculatedPiawe * p2Rate, maxCap);
    p2WeeklyComp = Math.max(0, grossCap - currentEarnings);
  }
  const p2TotalWeeks = 117;
  const p2TotalPayment = p2WeeklyComp * p2TotalWeeks;

  // Combined 130-Week Entitlement
  const combined130WeekPayment = p1TotalPayment + p2TotalPayment;

  // Post 130-Week (Third Entitlement Period) Qualification
  const wpi = Math.max(0, parseFloat(wholePersonImpairment) || 0);
  const meetsWpiThreshold = wpi >= config.wpiThreshold;

  let post130Message = '';
  if (meetsWpiThreshold) {
    post130Message = `Qualified: Debtor/Worker has ${wpi}% WPI, meeting the ${config.wpiThreshold}%+ statutory threshold for high needs. Payments continue beyond 130 weeks.`;
  } else {
    post130Message = `Subject to Cessation: Worker has ${wpi}% WPI (<${config.wpiThreshold}% threshold). Weekly payments strictly cease at 130 weeks unless returning to work >=15 hrs/wk and certified permanently incapable of further work.`;
  }

  return {
    jurisdiction,
    jurisdictionName: config.name,
    statutoryMaxWeeklyCap: maxCap,
    calculatedPiawe,
    earningsComponents: { base, overtime: ot, shiftAllowances: shift },
    workCapacity,
    currentHours,
    currentEarnings,
    period1: {
      weeks: 13,
      appliedRate: config.firstPeriodRate,
      weeklyPayment: Math.round(p1WeeklyComp * 100) / 100,
      totalPayment: Math.round(p1TotalPayment * 100) / 100,
      totalIncomeWeekly: Math.round((p1WeeklyComp + currentEarnings) * 100) / 100
    },
    period2: {
      weeks: 117,
      appliedRate: p2Rate,
      hasReturnToWorkBoost,
      weeklyPayment: Math.round(p2WeeklyComp * 100) / 100,
      totalPayment: Math.round(p2TotalPayment * 100) / 100,
      totalIncomeWeekly: Math.round((p2WeeklyComp + currentEarnings) * 100) / 100
    },
    total130WeeksPayment: Math.round(combined130WeekPayment * 100) / 100,
    wholePersonImpairment: wpi,
    meetsWpiThreshold,
    post130Message
  };
}
