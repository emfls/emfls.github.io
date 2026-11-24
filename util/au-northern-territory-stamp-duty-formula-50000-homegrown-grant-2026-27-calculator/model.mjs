const GRANT_START = '2024-10-01';
const GRANT_END = '2027-09-30';
const CLIFF_VALUES = [3000000, 5000000];

function money(value) {
  return Math.round((value + Number.EPSILON * Math.abs(value)) * 100) / 100;
}

function validateAmount(value, name) {
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) {
    throw new RangeError(`Enter a valid ${name} in Australian dollars.`);
  }
}

export function ntStampDuty(value) {
  validateAmount(value, 'dutiable value');
  if (value >= 5000000) return money(value * 0.0595);
  if (value >= 3000000) return money(value * 0.0575);
  if (value > 525000) return money(value * 0.0495);
  const v = value / 1000;
  return money(0.06571441 * v * v + 15 * v);
}

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function territoryGrant({ buyer, home, date, residence }) {
  if (!['first', 'previous', 'none'].includes(buyer) ||
      !['new', 'build', 'established'].includes(home) ||
      typeof residence !== 'boolean') {
    throw new RangeError('Select a buyer, property and residency scenario.');
  }
  if (!validDate(date)) throw new RangeError('Enter a valid contract or foundation start date.');
  if (buyer === 'none') return { amount: 0, reason: 'noGrant' };
  if (home === 'established') return { amount: 0, reason: 'established' };
  if (date < GRANT_START || date > GRANT_END) return { amount: 0, reason: 'outsideWindow' };
  if (!residence) return { amount: 0, reason: 'residency' };
  return buyer === 'first'
    ? { amount: 50000, reason: 'homegrown' }
    : { amount: 30000, reason: 'freshstart' };
}

// Each bracket is [inclusive ceiling, excess threshold, base duty, dollars per $100].
// Read the published base amounts directly: several schedules round them at bracket changes.
const BENCHMARK_RATES = {
  NSW: [
    [18000, 0, 0, 1.25], [38000, 18000, 225, 1.50], [103000, 38000, 525, 1.75],
    [387000, 103000, 1662, 3.50], [1290000, 387000, 11602, 4.50],
    [3870000, 1290000, 52237, 5.50], [Infinity, 3870000, 194137, 7],
  ],
  QLD: [
    [5000, 0, 0, 0], [75000, 5000, 0, 1.50], [540000, 75000, 1050, 3.50],
    [1000000, 540000, 17325, 4.50], [Infinity, 1000000, 38025, 5.75],
  ],
  ACT: [
    [200000, 0, 0, 1.20], [300000, 200000, 2400, 2.20], [500000, 300000, 4600, 3.40],
    [750000, 500000, 11400, 4.32], [1000000, 750000, 22200, 5.90],
    [1455000, 1000000, 36950, 6.40],
  ],
  SA: [
    [12000, 0, 0, 1], [30000, 12000, 120, 2], [50000, 30000, 480, 3],
    [100000, 50000, 1080, 3.50], [200000, 100000, 2830, 4],
    [250000, 200000, 6830, 4.25], [300000, 250000, 8955, 4.75],
    [500000, 300000, 11330, 5], [Infinity, 500000, 21330, 5.50],
  ],
  WA: [
    [120000, 0, 0, 1.90], [150000, 120000, 2280, 2.85],
    [360000, 150000, 3135, 3.80], [725000, 360000, 11115, 4.75],
    [Infinity, 725000, 28453, 5.15],
  ],
  TAS: [
    [3000, 0, 50, 0], [25000, 3000, 50, 1.75], [75000, 25000, 435, 2.25],
    [200000, 75000, 1560, 3.50], [375000, 200000, 5935, 4],
    [725000, 375000, 12935, 4.25], [Infinity, 725000, 27810, 4.50],
  ],
};

function bracketDuty(value, brackets) {
  const [, threshold, base, rate] = brackets.find(([ceiling]) => value <= ceiling);
  return base + Math.ceil((value - threshold) / 100) * rate;
}

function victoriaDuty(value) {
  if (value <= 25000) return value * 0.014;
  if (value <= 130000) return 350 + (value - 25000) * 0.024;
  if (value <= 960000) return 2870 + (value - 130000) * 0.06;
  if (value <= 2000000) return value * 0.055;
  return 110000 + (value - 2000000) * 0.065;
}

export function compareDuty(value) {
  validateAmount(value, 'dutiable value');
  if (value === 0) return { NT: 0, NSW: 0, VIC: 0, QLD: 0, ACT: 0, SA: 0, WA: 0, TAS: 0 };
  return {
    NT: ntStampDuty(value),
    NSW: money(Math.max(20, bracketDuty(value, BENCHMARK_RATES.NSW))),
    VIC: money(victoriaDuty(value)),
    QLD: money(bracketDuty(value, BENCHMARK_RATES.QLD)),
    ACT: money(value > 1455000 ? value * 0.0454 : bracketDuty(value, BENCHMARK_RATES.ACT)),
    SA: money(bracketDuty(value, BENCHMARK_RATES.SA)),
    WA: money(bracketDuty(value, BENCHMARK_RATES.WA)),
    TAS: money(bracketDuty(value, BENCHMARK_RATES.TAS)),
  };
}

export function calculate({ purchasePrice, marketValue = purchasePrice, ...grantInputs }) {
  validateAmount(purchasePrice, 'purchase price');
  validateAmount(marketValue, 'market value');
  if (purchasePrice === 0) throw new RangeError('Enter a purchase price above A$0.');
  const dutiableValue = Math.max(purchasePrice, marketValue);
  const benchmark = compareDuty(dutiableValue);
  const duty = benchmark.NT;
  const grant = territoryGrant(grantInputs);
  return {
    dutiableValue,
    duty,
    effectiveRate: duty / dutiableValue,
    grant,
    netUpfrontBenefit: money(grant.amount - duty),
    benchmark,
    cliffs: CLIFF_VALUES.map(threshold => ({
      threshold,
      reached: dutiableValue >= threshold,
      jump: ntStampDuty(threshold) - ntStampDuty(threshold - 0.01),
    })),
  };
}
