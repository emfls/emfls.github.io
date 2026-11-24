export const PARAMETERS = Object.freeze({
  weeksPerYear: 52,
  fullWeeklyRate: 241.30,
  nextFullWeeklyRate: 250.70,
  minimumYears: 10,
  fullQualifyingYears: 35,
  maximumGapYears: 6,
  weeklyNiRates: Object.freeze({ class3: 18.40, class2: 3.65 })
});

function validateRange(label, value, min, max, whole = true) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${whole ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
  }
}

function pensionYears(qualifyingYears) {
  return qualifyingYears >= PARAMETERS.minimumYears ? qualifyingYears : 0;
}

export function calculateTopUp({
  currentYears, futureYears, gapYears, missingWeeks, niClass, retirementTaxRate, retirementYears
}) {
  const { weeksPerYear, fullWeeklyRate, fullQualifyingYears, maximumGapYears, weeklyNiRates } = PARAMETERS;
  validateRange('Current qualifying years', currentYears, 0, fullQualifyingYears);
  validateRange('Future qualifying years', futureYears, 0, fullQualifyingYears);
  validateRange('Gap years to buy', gapYears, 0, maximumGapYears);
  validateRange('Missing weeks per gap year', missingWeeks, 1, weeksPerYear);
  validateRange('Years drawing pension', retirementYears, 0, 100, false);
  if (!Object.hasOwn(weeklyNiRates, niClass)) {
    throw new RangeError('Choose Class 3 or Class 2 National Insurance.');
  }
  if (![0, 0.2, 0.4].includes(retirementTaxRate)) {
    throw new RangeError('Choose a retirement tax rate of 0%, 20% or 40%.');
  }

  const baselineYears = Math.min(fullQualifyingYears, currentYears + futureYears);
  const withTopUpYears = Math.min(fullQualifyingYears, baselineYears + gapYears);
  const baselinePensionYears = pensionYears(baselineYears);
  const withTopUpPensionYears = pensionYears(withTopUpYears);
  const annualPensionPerYear = fullWeeklyRate * weeksPerYear / fullQualifyingYears;
  const grossAnnualBoost = (withTopUpPensionYears - baselinePensionYears) * annualPensionPerYear;
  const afterTaxAnnualBoost = grossAnnualBoost * (1 - retirementTaxRate);
  const weeklyNiPence = Math.round(weeklyNiRates[niClass] * 100);
  const totalTopUpCost = gapYears * missingWeeks * weeklyNiPence / 100;
  const lifetimeNetGain = afterTaxAnnualBoost * retirementYears - totalTopUpCost;

  return {
    baselineYears,
    withTopUpYears,
    crossesMinimum: baselinePensionYears === 0 && withTopUpPensionYears > 0,
    baselineAnnualPension: baselinePensionYears * annualPensionPerYear,
    withTopUpAnnualPension: withTopUpPensionYears * annualPensionPerYear,
    grossAnnualBoost,
    afterTaxAnnualBoost,
    totalTopUpCost,
    paybackYears: afterTaxAnnualBoost > 0 ? totalTopUpCost / afterTaxAnnualBoost : null,
    lifetimeNetGain,
    lifetimeRoi: totalTopUpCost > 0 ? lifetimeNetGain / totalTopUpCost : null
  };
}
