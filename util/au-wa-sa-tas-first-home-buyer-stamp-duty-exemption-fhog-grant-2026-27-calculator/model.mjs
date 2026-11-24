// Each row is [upper bound in dollars, base duty in cents, cents per $100 or part].
const schedules = {
  WA: [
    [120_000, 0, 190],
    [150_000, 228_000, 285],
    [360_000, 313_500, 380],
    [725_000, 1_111_500, 475],
    [Infinity, 2_845_300, 515],
  ],
  SA: [
    [12_000, 0, 100],
    [30_000, 12_000, 200],
    [50_000, 48_000, 300],
    [100_000, 108_000, 350],
    [200_000, 283_000, 400],
    [250_000, 683_000, 425],
    [300_000, 895_500, 475],
    [500_000, 1_133_000, 500],
    [Infinity, 2_133_000, 550],
  ],
  TAS: [
    [3_000, 5_000, 0],
    [25_000, 5_000, 175],
    [75_000, 43_500, 225],
    [200_000, 156_000, 350],
    [375_000, 593_500, 400],
    [725_000, 1_293_500, 425],
    [Infinity, 2_781_000, 450],
  ],
};

export const STATES = Object.freeze(Object.keys(schedules));
const propertyTypes = ['new', 'off-plan', 'established', 'land', 'land-build'];

function toCents(value, label) {
  const cents = Math.round(value * 100);
  if (typeof value !== 'number' || !Number.isSafeInteger(cents) || cents <= 0 || cents / 100 !== value) {
    throw new RangeError(`${label} must be a positive AUD amount with up to two decimal places.`);
  }
  return cents;
}

function dutyAtRate(value, threshold, rate) {
  return Math.ceil((value - threshold * 100) / 10_000) * rate;
}

function generalDuty(state, value) {
  const tiers = schedules[state];
  const tier = tiers.findIndex(([upper]) => value <= upper * 100);
  const [, base, rate] = tiers[tier];
  const lower = tier === 0 ? 0 : tiers[tier - 1][0];
  return base + dutyAtRate(value, lower, rate);
}

export function standardDuty(state, value) {
  if (!STATES.includes(state)) throw new RangeError('Select WA, SA or TAS.');
  return generalDuty(state, toCents(value, 'Dutiable value')) / 100;
}

export function compareFirstHome({ value, propertyType, waRegion = 'south', completedValue, eligible = true }) {
  if (!propertyTypes.includes(propertyType)) throw new RangeError('Select a valid property type.');
  if (!['south', 'north'].includes(waRegion)) throw new RangeError('Select a WA grant region.');
  if (typeof eligible !== 'boolean') throw new TypeError('Eligibility must be true or false.');

  const dutiableValue = toCents(value, 'Dutiable value');
  const separateBuild = propertyType === 'land-build';
  const isLand = propertyType === 'land' || separateBuild;
  const isNewHome = propertyType === 'new' || propertyType === 'off-plan' || separateBuild;
  const grantValue = separateBuild ? toCents(completedValue, 'Total land and build value') : dutiableValue;
  if (grantValue < dutiableValue) throw new RangeError('Total land and build value must be at least the land value.');

  return STATES.map((state) => {
    const standard = generalDuty(state, dutiableValue);
    let duty = standard;
    let grant = 0;

    if (eligible && state === 'WA') {
      const [exemption, cap, rate] = isLand ? [450_000, 550_000, 2014] : [600_000, 800_000, 1615];
      if (dutiableValue <= exemption * 100) duty = 0;
      else if (dutiableValue <= cap * 100) duty = dutyAtRate(dutiableValue, exemption, rate);

      const grantCap = waRegion === 'north' ? 1_000_000 : 800_000;
      if (isNewHome && grantValue <= grantCap * 100) grant = 1_000_000;
    } else if (eligible && state === 'SA' && propertyType !== 'established') {
      duty = 0;
      if (isNewHome) grant = 1_500_000;
    } else if (eligible && state === 'TAS' && isNewHome) {
      grant = 2_000_000;
    }

    const saved = standard - duty;
    return {
      state,
      standardDuty: standard / 100,
      dutyPayable: duty / 100,
      dutySaved: saved / 100,
      grant: grant / 100,
      totalSupport: (saved + grant) / 100,
    };
  });
}
