export const states = Object.freeze({
  NSW: 'New South Wales',
  VIC: 'Victoria',
  QLD: 'Queensland',
});

const propertyTypes = ['established', 'new', 'land', 'build'];

const nswRates = [
  [18_000, 0, 0, 1.25],
  [38_000, 18_000, 225, 1.50],
  [103_000, 38_000, 525, 1.75],
  [387_000, 103_000, 1662, 3.50],
  [1_290_000, 387_000, 11_602, 4.50],
  [3_870_000, 1_290_000, 52_237, 5.50],
  [Infinity, 3_870_000, 194_137, 7],
];

const qldRates = [
  [5000, 0, 0, 0],
  [75_000, 5000, 0, 1.50],
  [540_000, 75_000, 1050, 3.50],
  [1_000_000, 540_000, 17_325, 4.50],
  [Infinity, 1_000_000, 38_025, 5.75],
];

const qldHomeRates = [
  [350_000, 0, 0, 1],
  [540_000, 350_000, 3500, 3.50],
  [1_000_000, 540_000, 10_150, 4.50],
  [Infinity, 1_000_000, 30_850, 5.75],
];

function roundMoney(value) {
  return Math.round(value * 100 + 1e-8) / 100;
}

function dutyPerHundred(value, rates) {
  const [, threshold, base, rate] = rates.find(([limit]) => value <= limit);
  return base + Math.ceil((value - threshold) / 100) * rate;
}

function validateValue(value) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(Math.round(value * 100))) {
    throw new RangeError('Enter a positive dollar amount.');
  }
  if (roundMoney(value) !== value) {
    throw new RangeError('Enter no more than two decimal places.');
  }
}

export function standardDuty(state, value) {
  validateValue(value);
  switch (state) {
    case 'NSW':
      return Math.max(20, dutyPerHundred(value, nswRates));
    case 'VIC':
      if (value <= 25_000) return roundMoney(value * 0.014);
      if (value <= 130_000) return roundMoney(350 + (value - 25_000) * 0.024);
      if (value <= 960_000) return roundMoney(2870 + (value - 130_000) * 0.06);
      if (value <= 2_000_000) return roundMoney(value * 0.055);
      return roundMoney(110_000 + (value - 2_000_000) * 0.065);
    case 'QLD':
      return dutyPerHundred(value, qldRates);
    default:
      throw new RangeError('Choose NSW, VIC or QLD.');
  }
}

function firstHomeDuty(state, value, property, standard) {
  const land = property === 'land' || property === 'build';
  if (state === 'NSW') {
    const lower = land ? 350_000 : 800_000;
    const upper = land ? 450_000 : 1_000_000;
    if (value <= lower) return 0;
    if (value >= upper) return standard;
    // NSW Duties Act s 78A tapers the duty at the exemption threshold.
    return standard - standardDuty('NSW', lower) * (upper - value) / (upper - lower);
  }
  if (state === 'VIC') {
    return standard * Math.max(0, Math.min(1, (value - 600_000) / 150_000));
  }
  if (property !== 'established' || value <= 700_000) return 0;
  const homeDuty = dutyPerHundred(value, qldHomeRates);
  const bands = Math.max(0, 80 - Math.floor(value / 10_000));
  return homeDuty - 1735 * bands;
}

function firstHomeGrant(state, property, grantValue) {
  if (property !== 'new' && property !== 'build') return 0;
  if (state === 'QLD') return grantValue < 750_000 ? 30_000 : 0;
  const limit = state === 'NSW' && property === 'new' ? 600_000 : 750_000;
  return grantValue <= limit ? 10_000 : 0;
}

export function compareFirstHome({
  value,
  property = 'established',
  grantValue,
  dutyEligible = true,
  grantEligible = true,
}) {
  validateValue(value);
  if (!propertyTypes.includes(property)) throw new RangeError('Choose a property type.');
  const grantApplies = grantEligible && (property === 'new' || property === 'build');
  if (grantApplies) {
    if (property === 'build') {
      validateValue(grantValue);
      if (grantValue < value) throw new RangeError('The build total must include the land value.');
    } else {
      grantValue ??= value;
      validateValue(grantValue);
    }
  }

  return Object.fromEntries(Object.keys(states).map((state) => {
    const standard = standardDuty(state, value);
    const payable = dutyEligible ? roundMoney(firstHomeDuty(state, value, property, standard)) : standard;
    const saved = roundMoney(standard - payable);
    const grant = grantApplies ? firstHomeGrant(state, property, grantValue) : 0;
    return [state, { standard, payable, saved, grant, total: roundMoney(saved + grant) }];
  }));
}
