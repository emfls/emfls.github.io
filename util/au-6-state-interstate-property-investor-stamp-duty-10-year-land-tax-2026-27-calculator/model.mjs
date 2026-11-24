export const jurisdictions = Object.freeze({
  NSW: 'NSW · Sydney',
  VIC: 'Victoria · Melbourne',
  QLD: 'Queensland · Brisbane',
  WA: 'Western Australia · Perth',
  SA: 'South Australia · Adelaide',
  ACT: 'ACT · Canberra',
});

const vicDuty = [[0, 0, 1.4], [25000, 350, 2.4], [130000, 2870, 6]];
const entities = ['individual', 'company', 'trust_company'];
const cents = value => Math.round(value * 100) / 100;

// Each row gives a lower bound, the published base and a rate per $100.
function applyBands(value, bands, { inclusive = false, roundUp = false } = {}) {
  const band = bands.findLast(([lower]) => inclusive ? value >= lower : value > lower);
  if (!band) return 0;
  const [lower, base, rate] = band;
  const units = (value - lower) / 100;
  return base + rate * (roundUp ? Math.ceil(units) : units);
}

const dutyBands = {
  NSW: [[0, 0, 1.25], [18000, 225, 1.5], [38000, 525, 1.75], [103000, 1662, 3.5],
    [387000, 11602, 4.5], [1290000, 52237, 5.5], [3870000, 194137, 7]],
  QLD: [[5000, 0, 1.5], [75000, 1050, 3.5], [540000, 17325, 4.5], [1000000, 38025, 5.75]],
  WA: [[0, 0, 1.9], [120000, 2280, 2.85], [150000, 3135, 3.8], [360000, 11115, 4.75],
    [725000, 28453, 5.15]],
  SA: [[0, 0, 1], [12000, 120, 2], [30000, 480, 3], [50000, 1080, 3.5], [100000, 2830, 4],
    [200000, 6830, 4.25], [250000, 8955, 4.75], [300000, 11330, 5], [500000, 21330, 5.5]],
  ACT: [[0, 0, 1.2], [200000, 2400, 2.2], [300000, 4600, 3.4], [500000, 11400, 4.32],
    [750000, 22200, 5.9], [1000000, 36950, 6.4]],
};

export function stampDuty(state, price) {
  if (!Object.hasOwn(jurisdictions, state) || !Number.isFinite(price) || price <= 0) {
    throw new RangeError('Use a supported jurisdiction and a positive dutiable value.');
  }
  if (state === 'VIC') {
    const amount = price > 2000000
      ? 110000 + (price - 2000000) * 0.065
      : price > 960000 ? price * 0.055 : applyBands(price, vicDuty);
    // Stabilise floating-point ties before rounding exact half-dollars down.
    return Math.ceil(Math.round(amount * 1000000) / 1000000 - 0.5);
  }
  if (state === 'ACT' && price > 1455000) return cents(price * 0.0454);
  const amount = applyBands(price, dutyBands[state], { roundUp: true });
  return cents(state === 'NSW' ? Math.max(20, amount) : amount);
}

const vicGeneral = [[50000, 500, 0], [100000, 975, 0], [300000, 1350, 0.3], [600000, 2250, 0.6],
  [1000000, 4650, 0.9], [1800000, 11850, 1.65], [3000000, 31650, 2.65]];
const vicTrust = [[25000, 82, 0.375], [50000, 676, 0.375], [100000, 1338, 0.375],
  [250000, 1901, 0.675], [600000, 4263, 0.975], [1000000, 8163, 1.275],
  [1800000, 18363, 1.1072], [3000000, 31650, 2.65]];
const vicGeneralAfter2033 = [[300000, 375, 0.2], [600000, 975, 0.5], [1000000, 2975, 0.8],
  [1800000, 9375, 1.55], [3000000, 27975, 2.55]];
const vicTrustAfter2033 = [[25000, 82, 0.375], [250000, 926, 0.575], [600000, 2938, 0.875],
  [1000000, 6438, 1.175], [1800000, 15838, 1.0114], [3000000, 27975, 2.55]];
const qldGeneral = [[600000, 500, 1], [1000000, 4500, 1.65], [3000000, 37500, 1.25],
  [5000000, 62500, 1.75], [10000000, 150000, 2.25]];
const qldEntity = [[350000, 1450, 1.7], [2250000, 33750, 1.5], [5000000, 75000, 2.25],
  [10000000, 187500, 2.75]];
const waGeneral = [[300000, 300, 0], [420000, 300, 0.25], [1000000, 1750, 0.9],
  [1800000, 8950, 1.8], [5000000, 66550, 2], [11000000, 186550, 2.67]];
const saGeneral = [[936000, 0, 0.5], [1504000, 2840, 1], [2188000, 9680, 2], [3504000, 36000, 2.4]];
const saTrust = [[25000, 125, 0.5], [936000, 4680, 1], [1504000, 10360, 1.5],
  [2188000, 20620, 2.4], [3504000, 52204, 2.4]];
const actVariable = [[0, 0, 0.54], [150000, 810, 0.64], [275000, 1610, 1.24],
  [1000000, 10600, 1.25], [2000000, 23100, 1.26]];

export function annualLandTax(state, value, entity = 'individual', { vicYear = 2027, actUnitShare = 1 } = {}) {
  if (!Number.isFinite(value) || value < 0 || !entities.includes(entity) ||
      !Number.isInteger(vicYear) || !Number.isFinite(actUnitShare) || actUnitShare <= 0 || actUnitShare > 1) {
    throw new RangeError('Check the land value, ownership type and assessment inputs.');
  }
  value = cents(value);
  const trust = entity === 'trust_company';
  switch (state) {
    case 'NSW':
      return cents(applyBands(value, trust
        ? [[0, 0, 1.6], [6571000, 105136, 2]]
        : [[1075000, 100, 1.6], [6571000, 88036, 2]]));
    case 'VIC': {
      const bands = vicYear <= 2033
        ? (trust ? vicTrust : vicGeneral)
        : (trust ? vicTrustAfter2033 : vicGeneralAfter2033);
      return cents(applyBands(value, bands, { inclusive: true }));
    }
    case 'QLD':
      return cents(applyBands(value, entity === 'individual' ? qldGeneral : qldEntity, { inclusive: true }));
    case 'WA':
      return cents(applyBands(value, waGeneral) + Math.max(0, value - 300000) * 0.0014);
    case 'SA': {
      const amount = applyBands(value, trust ? saTrust : saGeneral, { roundUp: true });
      return amount < 20 ? 0 : cents(amount);
    }
    case 'ACT':
      return cents(1778 + applyBands(value, actVariable) * actUnitShare);
    default:
      throw new RangeError('Choose a supported jurisdiction.');
  }
}

// Earlier valuations are set to the year-one value when no history was supplied.
function assessmentValue(initialValue, growth, year, state) {
  const window = state === 'ACT' ? 5 : ['NSW', 'QLD'].includes(state) ? 3 : 1;
  const current = initialValue * growth ** year;
  let sum = 0;
  for (let lag = 0; lag < window; lag++) sum += initialValue * growth ** Math.max(0, year - lag);
  const average = sum / window;
  return state === 'QLD' ? Math.min(current, average) : average;
}

export function compareProperties({ price, landRatio, existingLand, entity, annualGrowth, years, actUnitShare = 1 }) {
  if (!Number.isFinite(price) || price < 1 || price > 100000000 ||
      !Number.isFinite(landRatio) || landRatio < 0.01 || landRatio > 100 ||
      !Number.isFinite(existingLand) || existingLand < 0 || existingLand > 100000000 ||
      !entities.includes(entity) || !Number.isFinite(annualGrowth) || annualGrowth < -50 || annualGrowth > 50 ||
      !Number.isInteger(years) || years < 1 || years > 30 ||
      !Number.isFinite(actUnitShare) || actUnitShare < 0.0001 || actUnitShare > 1) {
    throw new RangeError('Enter values within the ranges shown.');
  }

  const initialLand = cents(price * landRatio / 100);
  const growth = 1 + annualGrowth / 100;
  const rows = Object.keys(jurisdictions).map(state => {
    const duty = stampDuty(state, price);
    const annual = Array.from({ length: years }, (_, year) => {
      const acquired = assessmentValue(initialLand, growth, year, state);
      const options = { vicYear: 2027 + year, actUnitShare };
      if (state === 'ACT') return annualLandTax(state, acquired / actUnitShare, entity, options);

      const held = assessmentValue(existingLand, growth, year, state);
      return cents(annualLandTax(state, acquired + held, entity, options) - annualLandTax(state, held, entity, options));
    });
    const cumulative = cents(annual.reduce((total, tax) => total + tax, 0));
    const total = cents(duty + cumulative);
    return { state, duty, annual, yearOne: annual[0], cumulative, total, percent: total / price * 100 };
  });
  rows.sort((a, b) => a.total - b.total);
  return { initialLand, rows, delta: cents(rows.at(-1).total - rows[0].total) };
}
