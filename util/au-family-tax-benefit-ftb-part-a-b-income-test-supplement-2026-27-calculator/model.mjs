// DSS Family Assistance Guide 3.1.1.20, 3.1.4.40, 3.1.8.20 and 3.1.9.
export const FTB_RATES = Object.freeze({
  daysPerYear: 365,
  daysPerFortnight: 14,
  aUnder13: 6139.30,
  a13To19: 7989.85,
  aBase: 1971,
  aSupplement: 970.90,
  aSupplementLimit: 80000,
  aLowerLimit: 69131,
  aHigherLimit: 123078,
  aLowerTaper: 0.20,
  aHigherTaper: 0.30,
  bUnder5: 5223.15,
  b5To18: 3646.35,
  bSupplement: 478.15,
  bPrimaryLimit: 124327,
  bSecondaryLimit: 7154,
  bSecondaryTaper: 0.20,
  extraAti: 1000,
});

const r = FTB_RATES;
const money = amount => Math.round(amount * 100) / 100;
const positive = amount => Math.max(0, amount);
// A cent of ATI tapered at 20% or 30% produces two or three tenths of a cent.
const toTenthsOfCent = dollars => Math.round(dollars * 1000);
const toDollars = tenths => Math.round(tenths / 10) / 100;
const taper = (excess, rate) => Math.round(positive(excess) * rate);

function ati(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1e9 || value !== money(value)) {
    throw new RangeError('Enter ATI from $0 to $1 billion with up to two decimal places.');
  }
  return value;
}

function fortnight(annualTenths) {
  if (annualTenths <= 0) return 0;
  const dailyCents = Math.max(1, Math.round(annualTenths / (10 * r.daysPerYear)));
  return dailyCents * r.daysPerFortnight / 100;
}

function payments(input) {
  const { primaryAti, secondaryAti, childrenUnder13, children13To19, youngest, supplements } = input;
  const couple = input.household === 'couple';
  const familyAti = toTenthsOfCent(primaryAti) + toTenthsOfCent(secondaryAti);
  const childCount = childrenUnder13 + children13To19;
  const maximumA = childrenUnder13 * toTenthsOfCent(r.aUnder13) + children13To19 * toTenthsOfCent(r.a13To19);
  const baseA = childCount * toTenthsOfCent(r.aBase);
  const higherLimit = toTenthsOfCent(r.aHigherLimit);
  const lowerExcess = Math.min(familyAti, higherLimit) - toTenthsOfCent(r.aLowerLimit);
  const higherReduction = taper(familyAti - higherLimit, r.aHigherTaper);
  const method1 = maximumA - taper(lowerExcess, r.aLowerTaper) - higherReduction;
  const method2 = baseA - higherReduction;
  const annualA = positive(Math.max(method1, method2));
  const supplementA = supplements && familyAti <= toTenthsOfCent(r.aSupplementLimit)
    ? childCount * toTenthsOfCent(r.aSupplement)
    : 0;

  const eligibleB = childCount > 0 && youngest !== '19' && (!couple || youngest !== '13_18');
  const maximumB = toTenthsOfCent(youngest === '0_4' ? r.bUnder5 : r.b5To18);
  const secondaryExcess = toTenthsOfCent(secondaryAti) - toTenthsOfCent(r.bSecondaryLimit);
  const reductionB = couple ? taper(secondaryExcess, r.bSecondaryTaper) : 0;
  const passesPrimary = primaryAti <= r.bPrimaryLimit;
  const annualB = eligibleB && passesPrimary ? positive(maximumB - reductionB) : 0;
  // The secondary taper applies to the full reconciled rate, including the supplement.
  const reconciledB = eligibleB && passesPrimary
    ? positive(maximumB + (supplements ? toTenthsOfCent(r.bSupplement) : 0) - reductionB)
    : 0;

  const partA = { annual: toDollars(annualA), fortnight: fortnight(annualA), supplement: toDollars(supplementA) };
  const partB = {
    annual: toDollars(annualB),
    fortnight: fortnight(annualB),
    supplement: toDollars(reconciledB - annualB),
    cliffLoss: toDollars(reconciledB),
  };
  const totalAnnual = money(partA.annual + partA.supplement + partB.annual + partB.supplement);
  return { familyAti: toDollars(familyAti), partA, partB, totalAnnual };
}

function prioritize(input) {
  return {
    ...input,
    primaryAti: Math.max(input.primaryAti, input.secondaryAti),
    secondaryAti: Math.min(input.primaryAti, input.secondaryAti),
  };
}

export function calculateFTB(input) {
  const { household, childrenUnder13, children13To19, youngest, supplements } = input;
  if (!['couple', 'single_parent'].includes(household)) {
    throw new RangeError('Choose a household type.');
  }
  const couple = household === 'couple';
  const incomes = prioritize({
    ...input,
    primaryAti: ati(input.primaryAti),
    secondaryAti: couple ? ati(input.secondaryAti) : 0,
  });
  if (![childrenUnder13, children13To19].every(count => Number.isInteger(count) && count >= 0 && count <= 99)) {
    throw new RangeError('Enter a whole number from 0 to 99 for each group of children.');
  }
  if (!['0_4', '5_12', '13_18', '19'].includes(youngest)
    || (childrenUnder13 > 0 && !['0_4', '5_12'].includes(youngest))
    || (childrenUnder13 === 0 && children13To19 > 0 && !['13_18', '19'].includes(youngest))) {
    throw new RangeError('Choose a youngest child age that matches the children entered.');
  }
  if (typeof supplements !== 'boolean') {
    throw new RangeError('Choose whether to include eligible supplements.');
  }

  const current = payments(incomes);
  function impact(earner) {
    const next = payments(prioritize({ ...incomes, [earner]: money(incomes[earner] + r.extraAti) }));
    const lossA = money(current.partA.annual + current.partA.supplement - next.partA.annual - next.partA.supplement);
    const lossB = money(current.partB.cliffLoss - next.partB.cliffLoss);
    const loss = money(lossA + lossB);
    return { lossA, lossB, loss, rate: Math.round(loss / r.extraAti * 100000) / 1000 };
  }

  return {
    ...current,
    primaryAti: incomes.primaryAti,
    secondaryAti: incomes.secondaryAti,
    distances: {
      lowerA: money(r.aLowerLimit - current.familyAti),
      higherA: money(r.aHigherLimit - current.familyAti),
      supplementA: money(r.aSupplementLimit - current.familyAti),
      cliffB: money(r.bPrimaryLimit - incomes.primaryAti),
    },
    impact: { primary: impact('primaryAti'), secondary: couple ? impact('secondaryAti') : null },
  };
}
