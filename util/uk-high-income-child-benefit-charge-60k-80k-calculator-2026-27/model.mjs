export const PARAMETERS = Object.freeze({
  weeks: 52,
  eldestWeeklyPence: 2705,
  additionalWeeklyPence: 1790,
  taperStart: 60_000,
  taperEnd: 80_000,
  taperStep: 200,
  basicRatePct: 20,
  higherRatePct: 40,
  employeeNIRatePct: 2,
  maxIncome: 10_000_000,
  maxChildren: 100,
});

const { weeks, eldestWeeklyPence, additionalWeeklyPence, taperStart, taperEnd, taperStep,
  basicRatePct, higherRatePct, employeeNIRatePct, maxIncome, maxChildren } = PARAMETERS;

function toPence(amount) {
  const pence = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || amount > maxIncome || pence / 100 !== amount) {
    throw new RangeError('Enter amounts from £0 to £10,000,000 in pounds and pence.');
  }
  return pence;
}

function chargeFor(aniPence, benefitPence) {
  const clawbackPct = Math.max(0, Math.min(100,
    Math.floor((aniPence - taperStart * 100) / (taperStep * 100))));
  // Divide by 100 for the percentage and by 100 again to get whole pounds.
  const charge = Math.floor(benefitPence * clawbackPct / 10_000);
  return { clawbackPct, charge, kept: (benefitPence - charge * 100) / 100 };
}

export function calculate({ children, ani, partnerAni = 0, plannedGross = 0 }) {
  if (!Number.isInteger(children) || children < 1 || children > maxChildren) {
    throw new RangeError('Enter a whole number from 1 to 100 for eligible children.');
  }
  const ownPence = toPence(ani);
  const partnerPence = toPence(partnerAni);
  const plannedPence = toPence(plannedGross);

  const benefitPence = weeks * (eldestWeeklyPence + (children - 1) * additionalWeeklyPence);
  const annualBenefit = benefitPence / 100;
  const highestPence = Math.max(ownPence, partnerPence);
  const current = chargeFor(highestPence, benefitPence);
  const plannedHighestPence = Math.max(ownPence - plannedPence, partnerPence);
  const planned = chargeFor(plannedHighestPence, benefitPence);

  const ownTargetPence = Math.max(0, ownPence - taperStart * 100);
  const partnerTargetPence = Math.max(0, partnerPence - taperStart * 100);
  const grossTargetPence = ownTargetPence + partnerTargetPence;
  const taxReliefPence = Math.round(grossTargetPence * higherRatePct / 100);
  const taperRate = annualBenefit / (taperEnd - taperStart);

  return {
    annualBenefit,
    highestAni: highestPence / 100,
    current,
    planned: {
      ...planned,
      highestAni: plannedHighestPence / 100,
      chargeSaved: current.charge - planned.charge,
    },
    taperRate,
    effectiveTaperRate: (higherRatePct + employeeNIRatePct) / 100 + taperRate,
    rescue: {
      ownGrossTarget: ownTargetPence / 100,
      partnerGrossTarget: partnerTargetPence / 100,
      grossTarget: grossTargetPence / 100,
      upfrontCash: Math.ceil(grossTargetPence * (100 - basicRatePct) / 100) / 100,
      incomeTaxRelief: taxReliefPence / 100,
      chargeSaved: current.charge,
      netCost: (grossTargetPence - taxReliefPence - current.charge * 100) / 100,
      offsetShare: grossTargetPence ? (taxReliefPence + current.charge * 100) / grossTargetPence : null,
    },
  };
}
