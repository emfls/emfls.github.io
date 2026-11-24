// Monetary inputs and outputs are integer USD cents. Rates are decimal ratios.
export const STANDARD_PART_B_CENTS = 20290;
const MAX_INPUT_CENTS = 100_000_000_000;
const TAX_RATES = [10, 12, 22, 24, 32, 35, 37];
const MONTHLY_IRMAA = [
  [0, 0], [8120, 1450], [20290, 3750], [32460, 6040], [44630, 8330], [48700, 9100],
];
const RULES = {
  single: {
    deduction: 16100,
    bracketCaps: [12400, 50400, 105700, 201775, 256225, 640600],
    tierCaps: [[0, 109000], [1, 137000], [2, 171000], [3, 205000], [4, 499999.99], [5, Infinity]],
    maxEnrollees: 1,
  },
  mfj: {
    deduction: 32200,
    bracketCaps: [24800, 100800, 211400, 403550, 512450, 768700],
    tierCaps: [[0, 218000], [1, 274000], [2, 342000], [3, 410000], [4, 749999.99], [5, Infinity]],
    maxEnrollees: 2,
  },
  mfs: {
    deduction: 16100,
    bracketCaps: [12400, 50400, 105700, 201775, 256225, 384350],
    tierCaps: [[0, 109000], [4, 390999.99], [5, Infinity]],
    maxEnrollees: 1,
  },
};

function filingRules(filing) {
  if (!Object.hasOwn(RULES, filing)) throw new RangeError('Choose a supported filing status.');
  return RULES[filing];
}

export function basicDeductionCents(filing) {
  return filingRules(filing).deduction * 100;
}

export function maximumEnrollees(filing) {
  return filingRules(filing).maxEnrollees;
}

export function parseDollars(value, { allowNegative = false } = {}) {
  const amount = value.trim();
  const valid = /^-?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?|\.\d{1,2})$/;
  if (!valid.test(amount)) throw new RangeError('Enter a dollar amount with up to two decimal places.');
  const cents = Math.round(Number(amount.replaceAll(',', '')) * 100);
  if (Math.abs(cents) > MAX_INPUT_CENTS || (!allowNegative && cents < 0)) {
    throw new RangeError('Enter an amount within the allowed range (up to $1 billion).');
  }
  return cents || 0;
}

function tierFor(magiCents, tierCaps) {
  return tierCaps.find(([, cap]) => magiCents <= Math.round(cap * 100));
}

export function irmaaTier(magiCents, filing) {
  return tierFor(magiCents, filingRules(filing).tierCaps)[0];
}

function bracketIndex(taxableCents, caps) {
  const index = caps.findIndex(cap => taxableCents <= cap * 100);
  return index === -1 ? TAX_RATES.length - 1 : index;
}

export function federalTaxCents(taxableCents, filing) {
  let lowerCents = 0;
  let taxHundredthsOfCent = 0;
  const caps = [...filingRules(filing).bracketCaps, Infinity];
  for (const [index, cap] of caps.entries()) {
    const upperCents = cap * 100;
    const incomeInBracket = Math.max(0, Math.min(taxableCents, upperCents) - lowerCents);
    taxHundredthsOfCent += incomeInBracket * TAX_RATES[index];
    if (taxableCents <= upperCents) break;
    lowerCents = upperCents;
  }
  return Math.round(taxHundredthsOfCent / 100);
}

export function calculateConversion({
  filing, agiCents, taxExemptInterestCents, deductionCents, conversionCents,
  partBEnrollees, partDEnrollees,
}) {
  const { bracketCaps, tierCaps, maxEnrollees } = filingRules(filing);
  const moneyInputs = [agiCents, taxExemptInterestCents, deductionCents, conversionCents];
  if (moneyInputs.some(value => !Number.isSafeInteger(value) || Math.abs(value) > MAX_INPUT_CENTS)
      || moneyInputs.slice(1).some(value => value < 0)) {
    throw new RangeError('Enter valid income, interest, deduction and conversion amounts.');
  }
  if ([partBEnrollees, partDEnrollees].some(count => !Number.isInteger(count)
      || count < 0 || count > maxEnrollees)) {
    throw new RangeError('Choose valid Medicare enrollment counts for this filing status.');
  }

  const magiBeforeCents = agiCents + taxExemptInterestCents;
  const magiAfterCents = magiBeforeCents + conversionCents;
  const [tierBefore, tierCap] = tierFor(magiBeforeCents, tierCaps);
  const tierAfter = irmaaTier(magiAfterCents, filing);
  const annualIrmaa = tier => {
    const [partB, partD] = MONTHLY_IRMAA[tier];
    return 12 * (partB * partBEnrollees + partD * partDEnrollees);
  };
  const irmaaBeforeCents = annualIrmaa(tierBefore);
  const irmaaAfterCents = annualIrmaa(tierAfter);
  const irmaaDeltaCents = irmaaAfterCents - irmaaBeforeCents;

  const incomeAfterDeductions = agiCents - deductionCents;
  const taxableBeforeCents = Math.max(0, incomeAfterDeductions);
  const taxableAfterCents = Math.max(0, incomeAfterDeductions + conversionCents);
  const bracketBefore = bracketIndex(taxableBeforeCents, bracketCaps);
  const bracketAfter = bracketIndex(taxableAfterCents, bracketCaps);
  const taxBeforeCents = federalTaxCents(taxableBeforeCents, filing);
  const taxAfterCents = federalTaxCents(taxableAfterCents, filing);
  const taxDeltaCents = taxAfterCents - taxBeforeCents;

  // Room is measured from the baseline. Null means there is no further modeled limit.
  const irmaaRoomCents = Number.isFinite(tierCap) && partBEnrollees + partDEnrollees > 0
    ? Math.round(tierCap * 100) - magiBeforeCents
    : null;
  const taxRoomCents = bracketBefore < bracketCaps.length
    ? bracketCaps[bracketBefore] * 100 - incomeAfterDeductions
    : null;
  const safeRoomCents = irmaaRoomCents === null || taxRoomCents === null
    ? irmaaRoomCents ?? taxRoomCents
    : Math.min(irmaaRoomCents, taxRoomCents);
  const totalCostCents = taxDeltaCents + irmaaDeltaCents;

  return {
    magiBeforeCents, magiAfterCents, tierBefore, tierAfter, irmaaBeforeCents, irmaaAfterCents,
    irmaaDeltaCents, taxableBeforeCents, taxableAfterCents,
    bracketRateBefore: TAX_RATES[bracketBefore], bracketRateAfter: TAX_RATES[bracketAfter],
    taxBeforeCents, taxAfterCents, taxDeltaCents, irmaaRoomCents, taxRoomCents, safeRoomCents,
    totalCostCents, effectiveRate: conversionCents > 0 ? totalCostCents / conversionCents : null,
  };
}
