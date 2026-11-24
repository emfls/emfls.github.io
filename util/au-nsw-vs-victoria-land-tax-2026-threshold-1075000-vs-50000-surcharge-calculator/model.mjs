const NSW_GENERAL_THRESHOLD = 1_075_000;
const NSW_PREMIUM_THRESHOLD = 6_571_000;
const MAX_VALUE = 1_000_000_000;

// Each Victoria bracket gives the inclusive floor, base tax and marginal rate in parts per million.
const VIC_GENERAL = [
  [50_000, 500, 0],
  [100_000, 975, 0],
  [300_000, 1_350, 3_000],
  [600_000, 2_250, 6_000],
  [1_000_000, 4_650, 9_000],
  [1_800_000, 11_850, 16_500],
  [3_000_000, 31_650, 26_500],
];

const VIC_TRUST = [
  [25_000, 82, 3_750],
  [50_000, 676, 3_750],
  [100_000, 1_338, 3_750],
  [250_000, 1_901, 6_750],
  [600_000, 4_263, 9_750],
  [1_000_000, 8_163, 12_750],
  [1_800_000, 18_363, 11_072],
  [3_000_000, 31_650, 26_500],
];

export function isValidTaxValue(value) {
  return Number.isFinite(value) && value >= 0 && value <= MAX_VALUE &&
    Math.round(value * 100) / 100 === value;
}

function toCents(value) {
  if (!isValidTaxValue(value)) {
    throw new RangeError('Enter a value from A$0 to A$1 billion with up to two decimal places.');
  }
  return Math.round(value * 100);
}

function isTrust(ownership) {
  if (ownership !== 'general' && ownership !== 'trust') throw new RangeError('Invalid ownership category.');
  return ownership === 'trust';
}

function nswTax(value, trust) {
  const premiumCents = NSW_PREMIUM_THRESHOLD * 100;
  if (value > premiumCents) {
    const base = trust ? 105_136 : 88_036;
    return base * 100 + Math.round((value - premiumCents) * 20_000 / 1_000_000);
  }
  if (trust) return Math.round(value * 16_000 / 1_000_000);
  const excess = value - NSW_GENERAL_THRESHOLD * 100;
  return excess > 0 ? 10_000 + Math.round(excess * 16_000 / 1_000_000) : 0;
}

function victoriaTax(value, trust, absentee) {
  const brackets = trust ? VIC_TRUST : VIC_GENERAL;
  const bracket = brackets.findLast(([floor]) => value >= floor * 100);
  if (!bracket) return 0;
  const [floor, base, rate] = bracket;
  const marginalTax = (value - floor * 100) * rate;
  const absenteeTax = absentee ? value * 40_000 : 0;
  return base * 100 + Math.round((marginalTax + absenteeTax) / 1_000_000);
}

function vacancyTax(civ, years) {
  if (!Number.isSafeInteger(years) || years < 0) throw new RangeError('Invalid VRLT liability year.');
  return Math.round(civ * Math.min(years, 3) / 100);
}

export function nswLandTax(value, ownership = 'general') {
  return nswTax(toCents(value), isTrust(ownership)) / 100;
}

export function victoriaLandTax(value, ownership = 'general', absentee = false) {
  return victoriaTax(toCents(value), isTrust(ownership), absentee) / 100;
}

export function vacancyLandTax(civ, years) {
  return vacancyTax(toCents(civ), years) / 100;
}

export function calculateLandTax({
  nswValue, vicValue, nswResidentialValue = nswValue,
  nswOwnership = 'general', vicOwnership = 'general',
  nswForeign = false, vicAbsentee = false, vicCiv = 0, vacantYears = 0,
}) {
  const nswCents = toCents(nswValue);
  const vicCents = toCents(vicValue);
  const foreignCharge = Math.round(toCents(nswResidentialValue) * 5 / 100);
  const vacancy = vacancyTax(toCents(vicCiv), vacantYears);
  const nswBase = nswTax(nswCents, isTrust(nswOwnership));
  const vicTrust = isTrust(vicOwnership);
  const vicBase = victoriaTax(vicCents, vicTrust, false);
  const vicWithAbsentee = victoriaTax(vicCents, vicTrust, vicAbsentee);
  const nswSurcharge = nswForeign ? foreignCharge : 0;
  const nswTotal = nswBase + nswSurcharge;
  const vicTotal = vicWithAbsentee + vacancy;
  const difference = vicTotal - nswTotal;

  const scenarios = [
    { label: 'Individual / general company', trust: false, surcharge: false },
    { label: 'Trust schedule', trust: true, surcharge: false },
    { label: 'Foreign / absentee general owner', trust: false, surcharge: true },
    { label: 'Trust with foreign / absentee surcharge', trust: true, surcharge: true },
  ].map(({ label, trust, surcharge }) => ({
    label,
    nsw: (nswTax(nswCents, trust) + (surcharge ? foreignCharge : 0)) / 100,
    vic: (victoriaTax(vicCents, trust, surcharge) + vacancy) / 100,
  }));

  return {
    nsw: {
      landTax: nswBase / 100,
      surcharge: nswSurcharge / 100,
      total: nswTotal / 100,
      effectiveRate: nswCents ? nswTotal * 100 / nswCents : null,
    },
    vic: {
      landTax: vicBase / 100,
      surcharge: (vicWithAbsentee - vicBase) / 100,
      vacancy: vacancy / 100,
      total: vicTotal / 100,
      effectiveRate: vicCents ? vicTotal * 100 / vicCents : null,
    },
    annualDifference: difference / 100,
    tenYearDifference: difference * 10 / 100,
    scenarios,
  };
}
