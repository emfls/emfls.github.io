// Dutiable values and duty amounts are calculated in integer cents.
export const CLIFF_VALUE = 1_455_000;

// Rows are [upper value in dollars, lower value in dollars, base duty in dollars,
// cents of duty per $100 or part thereof above the lower value].
const ownerRates = [
  [260_000, 0, 0, 28],
  [300_000, 260_000, 728, 220],
  [500_000, 300_000, 1_608, 340],
  [750_000, 500_000, 8_408, 432],
  [1_000_000, 750_000, 19_208, 590],
  [CLIFF_VALUE, 1_000_000, 33_958, 640]
];

const investorRates = [
  [200_000, 0, 0, 120],
  [300_000, 200_000, 2_400, 220],
  [500_000, 300_000, 4_600, 340],
  [750_000, 500_000, 11_400, 432],
  [1_000_000, 750_000, 22_200, 590],
  [CLIFF_VALUE, 1_000_000, 36_950, 640]
];

const nswRates = [
  [18_000, 0, 0, 125],
  [38_000, 18_000, 225, 150],
  [103_000, 38_000, 525, 175],
  [387_000, 103_000, 1_662, 350],
  [1_290_000, 387_000, 11_602, 450],
  [3_870_000, 1_290_000, 52_237, 550],
  [Infinity, 3_870_000, 194_137, 700]
];

function steppedDuty(value, rates) {
  const [, lower, base, centsPerHundred] = rates.find(([upper]) => value <= upper * 100);
  return base * 100 + Math.ceil((value - lower * 100) / 10_000) * centsPerHundred;
}

function proportionalDuty(value, basisPoints) {
  return Number((BigInt(value) * BigInt(basisPoints) + 5_000n) / 10_000n);
}

function victoriaDuty(value, owner) {
  if (value <= 25_000_00) return proportionalDuty(value, 140);
  if (value <= 130_000_00) return 350_00 + proportionalDuty(value - 25_000_00, 240);
  if (owner && value <= 440_000_00) return 2_870_00 + proportionalDuty(value - 130_000_00, 500);
  if (owner && value <= 550_000_00) return 18_370_00 + proportionalDuty(value - 440_000_00, 600);
  if (value <= 960_000_00) return 2_870_00 + proportionalDuty(value - 130_000_00, 600);
  if (value <= 2_000_000_00) return proportionalDuty(value, 550);
  return 110_000_00 + proportionalDuty(value - 2_000_000_00, 650);
}

export function calculateDuty(value, {
  use = 'owner',
  claimHbcs = false,
  adultsBuyingPersonally = false,
  meetsOwnershipTest = false
} = {}) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError('Enter a dutiable value greater than A$0.');
  }
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || cents / 100 !== value) {
    throw new RangeError('Enter a supported dollar amount with up to two decimal places.');
  }
  if (use !== 'owner' && use !== 'investor') {
    throw new RangeError('Select an owner-occupier or investor purchase.');
  }

  const aboveCliff = cents > CLIFF_VALUE * 100;
  const flatDuty = aboveCliff ? proportionalDuty(cents, 454) : null;
  const ownerDuty = flatDuty ?? steppedDuty(cents, ownerRates);
  const investorDuty = flatDuty ?? steppedDuty(cents, investorRates);
  const owner = use === 'owner';
  const hbcsApplied = owner && claimHbcs === true && adultsBuyingPersonally === true && meetsOwnershipTest === true;
  const payable = hbcsApplied ? 0 : (owner ? ownerDuty : investorDuty);

  return {
    payable: payable / 100,
    effectiveRate: payable / cents * 100,
    hbcsApplied,
    hbcsSavings: hbcsApplied ? ownerDuty / 100 : 0,
    ownerInvestorGap: (investorDuty - ownerDuty) / 100,
    ownerDuty: ownerDuty / 100,
    investorDuty: investorDuty / 100,
    aboveCliff,
    nsw: Math.max(2_000, steppedDuty(cents, nswRates)) / 100,
    vic: victoriaDuty(cents, owner) / 100
  };
}
