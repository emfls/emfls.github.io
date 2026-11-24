export const STATES = Object.freeze(['NSW', 'VIC', 'QLD']);
export const PROPERTY_TYPES = Object.freeze(['established', 'new_home', 'vacant_land']);
export const MAX_VALUE = 100_000_000;

// Each row contains the inclusive upper limit, lower limit, base, and dollars per $100.
const NSW_RATES = [
  [18_000, 0, 0, 1.25],
  [38_000, 18_000, 225, 1.5],
  [103_000, 38_000, 525, 1.75],
  [387_000, 103_000, 1662, 3.5],
  [1_290_000, 387_000, 11602, 4.5],
  [3_870_000, 1_290_000, 52237, 5.5],
  [Infinity, 3_870_000, 194137, 7],
];
const VIC_RATES = [
  [25_000, 0, 0, 1.4],
  [130_000, 25_000, 350, 2.4],
  [960_000, 130_000, 2870, 6],
  [2_000_000, 0, 0, 5.5],
  [Infinity, 2_000_000, 110000, 6.5],
];
const QLD_GENERAL_RATES = [
  [5_000, 0, 0, 0],
  [75_000, 5_000, 0, 1.5],
  [540_000, 75_000, 1050, 3.5],
  [1_000_000, 540_000, 17325, 4.5],
  [Infinity, 1_000_000, 38025, 5.75],
];
const QLD_HOME_RATES = [
  [350_000, 0, 0, 1],
  [540_000, 350_000, 3500, 3.5],
  [1_000_000, 540_000, 10150, 4.5],
  [Infinity, 1_000_000, 30850, 5.75],
];

function bracketDuty(value, rates) {
  const [, lower, base, rate] = rates.find(([upper]) => value <= upper);
  return base + rate * Math.ceil((value - lower) / 100);
}

function nswDuty(value) {
  return Math.max(20, bracketDuty(value, NSW_RATES));
}

function nswFirstHomeDuty(value, standard, land) {
  const [exemption, ceiling] = land ? [350_000, 450_000] : [800_000, 1_000_000];
  if (value <= exemption) return 0;
  if (value >= ceiling) return standard;
  // Duties Act 1997 s 78A tapers the discount from duty at the exemption threshold.
  return standard - nswDuty(exemption) * (ceiling - value) / (ceiling - exemption);
}

function vicDuty(value) {
  const [, lower, base, rate] = VIC_RATES.find(([upper]) => value <= upper);
  // Section 28 rounds to a whole dollar, with exact half-dollars rounded down.
  const rateUnits = Math.round(rate * 10);
  const dutyUnits = (Math.round(value * 100) - lower * 100) * rateUnits;
  return base + Math.floor((dutyUnits + 49_999) / 100_000);
}

function vicFirstHomeDuty(value, standard) {
  const share = Math.min(1, Math.max(0, (value - 600_000) / 150_000));
  return standard * share;
}

function qldFirstHomeDuty(value, propertyType) {
  if (propertyType !== 'established' || value <= 700_000) return 0;
  // The additional first-home discount falls by $1,735 at each $10,000 boundary.
  const remainingBands = Math.max(0, 80 - Math.floor(value / 10_000));
  return bracketDuty(value, QLD_HOME_RATES) - remainingBands * 1735;
}

function potentialGrant(state, propertyType, value, completedValue) {
  if (propertyType === 'established') return 0;
  const isLand = propertyType === 'vacant_land';
  const grantValue = isLand ? completedValue : value;
  if (grantValue === null) return 0;
  if (state === 'QLD') return grantValue < 750_000 ? 30_000 : 0;
  const cap = state === 'NSW' && !isLand ? 600_000 : 750_000;
  return grantValue <= cap ? 10_000 : 0;
}

function validValue(value) {
  return Number.isFinite(value) && value > 0 && value <= MAX_VALUE
    && Math.round(value * 100) / 100 === value;
}

// Return amounts in integer cents so savings and totals reconcile with the display.
export function calculateDuty({ state, propertyType, value, completedValue = null }) {
  if (!STATES.includes(state) || !PROPERTY_TYPES.includes(propertyType)) {
    throw new RangeError('Choose a supported state and property type.');
  }
  if (!validValue(value)) throw new RangeError('Enter a valid dutiable value.');
  const land = propertyType === 'vacant_land';
  if (land && completedValue !== null && (!validValue(completedValue) || completedValue < value)) {
    throw new RangeError('Enter a completed home value at least as high as the land value.');
  }

  let standard;
  let payable;
  switch (state) {
    case 'NSW':
      standard = nswDuty(value);
      payable = nswFirstHomeDuty(value, standard, land);
      break;
    case 'VIC':
      standard = vicDuty(value);
      payable = vicFirstHomeDuty(value, standard);
      break;
    case 'QLD':
      standard = bracketDuty(value, QLD_GENERAL_RATES);
      payable = qldFirstHomeDuty(value, propertyType);
      break;
  }
  const standardDuty = Math.round(standard * 100);
  const dutyPayable = Math.round(payable * 100);
  const dutySaved = standardDuty - dutyPayable;
  const grant = potentialGrant(state, propertyType, value, completedValue) * 100;
  return { standardDuty, dutyPayable, dutySaved, grant, totalBoost: dutySaved + grant };
}
