export const CONVERSION_YEAR = 2026;
export const MEDICARE_YEAR = CONVERSION_YEAR + 2;
export const UNLOCK_YEAR = CONVERSION_YEAR + 5;
const MAX_INPUT = 100_000_000;

const rates = [10, 12, 22, 24, 32, 35, 37];
const filingRules = {
  single: { standard: 16100, aged: 2050, phaseout: 75000, people: 1,
    brackets: [12400, 50400, 105700, 201775, 256225, 640600], cliffs: [109000, 137000, 171000, 205000, 499999] },
  joint: { standard: 32200, aged: 1650, phaseout: 150000, people: 2,
    brackets: [24800, 100800, 211400, 403550, 512450, 768700], cliffs: [218000, 274000, 342000, 410000, 749999] },
  head: { standard: 24150, aged: 2050, phaseout: 75000, people: 1,
    brackets: [17700, 67450, 105700, 201750, 256200, 640600], cliffs: [109000, 137000, 171000, 205000, 499999] },
};

// Monthly IRMAA in cents per enrollee under the official 2026 benchmark.
const partB = [0, 8120, 20290, 32460, 44630, 48700];
const partD = [0, 1450, 3750, 6040, 8330, 9100];

function annualSurcharge(tier, partBCount, partDCount) {
  return 12 * (partB[tier] * partBCount + partD[tier] * partDCount);
}

function progressiveTax(taxableCents, brackets) {
  let taxHundredthsOfCent = 0;
  let lowerCents = 0;
  for (const [index, rate] of rates.entries()) {
    const upperCents = (brackets[index] ?? Infinity) * 100;
    taxHundredthsOfCent += (Math.min(upperCents, taxableCents) - lowerCents) * rate;
    if (taxableCents <= upperCents) break;
    lowerCents = upperCents;
  }
  return taxHundredthsOfCent;
}

export function calculateConversion({
  status, agi, taxExemptInterest, seniorAddbacks, age, spouseAge, partBCount, partDCount, proposed, targetRate,
}) {
  const rules = Object.hasOwn(filingRules, status) ? filingRules[status] : null;
  if (!rules || ![12, 22, 24].includes(targetRate)) throw new RangeError('Select a supported status and tax bracket.');
  for (const [value, min, max] of [
    [agi, -MAX_INPUT, MAX_INPUT], [taxExemptInterest, 0, MAX_INPUT], [seniorAddbacks, 0, MAX_INPUT],
    [proposed, 0, 2 * MAX_INPUT], [partBCount, 0, rules.people], [partDCount, 0, rules.people],
  ]) {
    if (!Number.isInteger(value) || value < min || value > max) throw new RangeError('Check whole-dollar amounts and enrollee counts.');
  }
  for (const value of rules.people === 2 ? [age, spouseAge] : [age]) {
    if (!Number.isFinite(value) || value < 0 || value > 120) throw new RangeError('Enter ages between 0 and 120.');
  }

  const seniors = Number(age >= 65) + Number(rules.people === 2 && spouseAge >= 65);
  const standard = rules.standard + rules.aged * seniors;

  function taxPosition(conversion) {
    const excessMagi = Math.max(0, agi + conversion + seniorAddbacks - rules.phaseout);
    const seniorDeductionCents = seniors * Math.max(0, 600000 - 6 * excessMagi);
    const taxableCents = Math.max(0, (agi + conversion - standard) * 100 - seniorDeductionCents);
    return { seniorDeductionCents, taxableCents };
  }

  const baseline = taxPosition(0);
  const baselineTax = progressiveTax(baseline.taxableCents, rules.brackets);
  const baseMagi = agi + taxExemptInterest;
  const tierFor = (magi) => rules.cliffs.filter((ceiling) => magi > ceiling).length;
  const baseTier = tierFor(baseMagi);
  const baseSurcharge = annualSurcharge(baseTier, partBCount, partDCount);
  const cliffCeiling = rules.cliffs[baseTier] ?? null;
  const irmaaHeadroom = cliffCeiling === null ? null : cliffCeiling - baseMagi;
  const nextCliffCost = cliffCeiling === null ? null :
    (annualSurcharge(baseTier + 1, partBCount, partDCount) - baseSurcharge) / 100;

  function scenario(conversion) {
    const { seniorDeductionCents, taxableCents } = taxPosition(conversion);
    const magi = baseMagi + conversion;
    const tier = tierFor(magi);
    const taxCents = Math.round((progressiveTax(taxableCents, rules.brackets) - baselineTax) / 100);
    const irmaaCents = annualSurcharge(tier, partBCount, partDCount) - baseSurcharge;
    const totalCents = taxCents + irmaaCents;
    return {
      conversion, magi, tier, taxableIncome: taxableCents / 100, seniorDeduction: seniorDeductionCents / 100,
      addedTax: taxCents / 100, addedIrmaa: irmaaCents / 100, totalCost: totalCents / 100,
      allInRate: conversion === 0 ? null : totalCents / (100 * conversion),
    };
  }

  const room = [12, 22, 24].map((rate) => {
    const ceiling = rules.brackets[rates.indexOf(rate)];
    const ceilingCents = ceiling * 100;
    // Taxable income rises monotonically, including while the senior deduction phases out.
    let low = 0;
    let high = Math.max(0, ceiling + standard + 6000 * seniors - agi);
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (taxPosition(mid).taxableCents <= ceilingCents) low = mid;
      else high = mid - 1;
    }
    return { rate, ceiling, taxableRoom: Math.max(0, ceilingCents - baseline.taxableCents) / 100, conversionRoom: low };
  });
  const targetRoom = room.find(({ rate }) => rate === targetRate).conversionRoom;
  const safe = partBCount + partDCount === 0 ? targetRoom : Math.min(targetRoom, irmaaHeadroom ?? Infinity);

  return {
    standardDeduction: standard, baseline: scenario(0), proposed: scenario(proposed), optimized: scenario(safe),
    room, cliffCeiling, nextCliffCost, irmaaHeadroom, medicareYear: MEDICARE_YEAR, unlockYear: UNLOCK_YEAR,
    earlyWithdrawalWarning: age < 59.5,
  };
}
