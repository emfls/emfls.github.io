// Annual comparisons use 52 weeks and keep full precision until display.
export const RATES = Object.freeze({
  fullWeekly: 241.30,
  proposedWeekly: 250.70,
  weeks: 52,
  class3Annual: 956.80,
  class2Annual: 189.80,
  personalAllowance: 12570,
  minimumYears: 10,
  fullYears: 35,
});

export function weeklyPension(years) {
  if (!Number.isInteger(years) || years < 0) {
    throw new RangeError('Qualifying years must be a non-negative whole number.');
  }
  const eligibleYears = years < RATES.minimumYears ? 0 : Math.min(years, RATES.fullYears);
  return RATES.fullWeekly * (eligibleYears / RATES.fullYears);
}

function breakEven(cost, firstYearIncome, growthFactor) {
  if (cost === 0 || firstYearIncome === 0) return null;

  let years = 0;
  let remaining = cost;
  let income = firstYearIncome;
  // Credit a fraction of the final year at that year's pension rate.
  while (remaining > income) {
    remaining -= income;
    income *= growthFactor;
    years++;
  }
  return years + remaining / income;
}

export function calculateTopUp({
  currentYears, futureYears, buyYears, contributionClass, taxRate,
  pensionAge, retirementYears, growthRate,
}) {
  for (const [value, min, max, label] of [
    [currentYears, 0, 60, 'Current qualifying years'],
    [futureYears, 0, 60, 'Future qualifying years'],
    [buyYears, 0, 6, 'Years to buy'],
    [retirementYears, 1, 60, 'Years in retirement'],
  ]) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new RangeError(`${label} must be a whole number from ${min} to ${max}.`);
    }
  }

  if (!['2', '3'].includes(contributionClass)) throw new RangeError('Choose Class 2 or Class 3.');
  if (![0, 20, 40].includes(taxRate)) throw new RangeError('Choose a retirement tax rate of 0%, 20% or 40%.');
  if (![66, 67, 68].includes(pensionAge)) throw new RangeError('Choose a State Pension age of 66, 67 or 68.');
  if (!Number.isFinite(growthRate) || growthRate < 0 || growthRate > 20) {
    throw new RangeError('Enter annual pension growth from 0% to 20%.');
  }

  const baselineYears = currentYears + futureYears;
  const projectedYears = baselineYears + buyYears;
  const currentWeekly = weeklyPension(currentYears);
  const withoutTopUpWeekly = weeklyPension(baselineYears);
  const projectedWeekly = weeklyPension(projectedYears);
  const annualCost = contributionClass === '2' ? RATES.class2Annual : RATES.class3Annual;
  const totalCost = Math.round(annualCost * 100) * buyYears / 100;
  const extraAnnualGross = (projectedWeekly - withoutTopUpWeekly) * RATES.weeks;
  const extraAnnualNet = extraAnnualGross * (1 - taxRate / 100);
  const growthFactor = 1 + growthRate / 100;
  let totalNetIncome = 0;
  let annualIncome = extraAnnualNet;
  for (let year = 0; year < retirementYears; year++) {
    totalNetIncome += annualIncome;
    annualIncome *= growthFactor;
  }

  const netProfit = totalNetIncome - totalCost;
  const netBreakEvenYears = breakEven(totalCost, extraAnnualNet, growthFactor);
  return {
    currentWeekly,
    currentAnnual: currentWeekly * RATES.weeks,
    withoutTopUpWeekly,
    withoutTopUpAnnual: withoutTopUpWeekly * RATES.weeks,
    projectedWeekly,
    projectedAnnual: projectedWeekly * RATES.weeks,
    totalCost,
    extraAnnualGross,
    extraAnnualNet,
    grossBreakEvenYears: breakEven(totalCost, extraAnnualGross, growthFactor),
    netBreakEvenYears,
    breakEvenAge: netBreakEvenYears === null ? null : pensionAge + netBreakEvenYears,
    netProfit,
    roiPercent: totalCost === 0 ? null : netProfit / totalCost * 100,
    excessYears: Math.max(0, buyYears - Math.max(0, RATES.fullYears - baselineYears)),
    crossesMinimum: baselineYears < RATES.minimumYears && projectedYears >= RATES.minimumYears,
  };
}
