export const FULL_WEEKLY_PENSION = 241.30;
export const WEEKS_PER_YEAR = 52;

export function deferralUplift(eligibleWeeks) {
  if (!Number.isInteger(eligibleWeeks) || eligibleWeeks < 0) {
    throw new RangeError('Enter a non-negative whole number of eligible weeks.');
  }
  return eligibleWeeks < 9 ? 0 : eligibleWeeks / 900;
}

export function calculateDeferral({
  pensionAge, qualifyingNiYears, deferralYears, workingTaxRate, retirementTaxRate, isaRealReturn
}) {
  if (![66, 67].includes(pensionAge)) throw new RangeError('Choose pension age 66 or 67.');
  if (!Number.isInteger(qualifyingNiYears) || qualifyingNiYears < 10 || qualifyingNiYears > 35) {
    throw new RangeError('Enter 10 to 35 whole National Insurance qualifying years.');
  }
  if (!Number.isInteger(deferralYears) || deferralYears < 1 || deferralYears > 5) {
    throw new RangeError('Enter a deferral of 1 to 5 whole years.');
  }
  if (![0, 20, 40, 45].includes(workingTaxRate) || ![0, 20, 40].includes(retirementTaxRate)) {
    throw new RangeError('Choose one of the listed tax rates for each period.');
  }
  if (!Number.isFinite(isaRealReturn) || isaRealReturn < 0 || isaRealReturn > 6) {
    throw new RangeError('Enter an ISA real return between 0% and 6%.');
  }

  const baseWeekly = FULL_WEEKLY_PENSION * (qualifyingNiYears / 35);
  const baseAnnual = baseWeekly * WEEKS_PER_YEAR;
  const deferralWeeks = deferralYears * WEEKS_PER_YEAR;
  const deferralBoostPct = deferralUplift(deferralWeeks);
  const extraWeekly = baseWeekly * deferralBoostPct;
  const extraAnnual = extraWeekly * WEEKS_PER_YEAR;
  const boostedWeekly = baseWeekly + extraWeekly;
  const boostedAnnual = baseAnnual + extraAnnual;
  const startClaimAge = pensionAge + deferralYears;
  const foregoneGross = baseAnnual * deferralYears;
  const workingNetWeekly = baseWeekly * (1 - workingTaxRate / 100);
  const extraNetWeekly = extraWeekly * (1 - retirementTaxRate / 100);
  const foregoneNet = workingNetWeekly * deferralWeeks;
  const extraNetAnnual = extraNetWeekly * WEEKS_PER_YEAR;
  const preTaxBreakEvenAge = startClaimAge + foregoneGross / extraAnnual;
  const afterTaxBreakEvenAge = startClaimAge + foregoneNet / extraNetAnnual;

  const weeklyLogGrowth = Math.log1p(isaRealReturn / 100) / WEEKS_PER_YEAR;
  const weeklyGrowth = Math.expm1(weeklyLogGrowth);
  const annuityFactor = (weeks) =>
    weeklyGrowth === 0 ? weeks : Math.expm1(weeklyLogGrowth * weeks) / weeklyGrowth;
  const isaHeadStart = workingNetWeekly * annuityFactor(deferralWeeks);
  // Equal base payments after retirement cancel when both strategies use the same return.
  const growthToExtra = isaHeadStart * weeklyGrowth / extraNetWeekly;
  let isaBreakEvenAge = afterTaxBreakEvenAge;
  if (weeklyGrowth > 0) {
    // If the head start earns at least the weekly extra, the gap can never close.
    isaBreakEvenAge = growthToExtra >= 1 ? null
      : startClaimAge - Math.log1p(-growthToExtra) / weeklyLogGrowth / WEEKS_PER_YEAR;
  }

  const gains = (age) => {
    const yearsSinceClaim = age - startClaimAge;
    const weeksSinceClaim = yearsSinceClaim * WEEKS_PER_YEAR;
    return {
      preTax: (age - preTaxBreakEvenAge) * extraAnnual,
      afterTax: (age - afterTaxBreakEvenAge) * extraNetAnnual,
      isa: weeklyGrowth === 0 ? (age - afterTaxBreakEvenAge) * extraNetAnnual
        : extraNetWeekly * annuityFactor(weeksSinceClaim)
          - isaHeadStart * Math.exp(weeklyLogGrowth * weeksSinceClaim)
    };
  };

  return {
    baseWeekly, baseAnnual, boostedWeekly, boostedAnnual, deferralWeeks, deferralBoostPct,
    extraWeekly, extraAnnual, extraNetAnnual, startClaimAge, foregoneGross, foregoneNet,
    preTaxBreakEvenAge, afterTaxBreakEvenAge, isaBreakEvenAge, gainsAt85: gains(85), gainsAt90: gains(90)
  };
}
