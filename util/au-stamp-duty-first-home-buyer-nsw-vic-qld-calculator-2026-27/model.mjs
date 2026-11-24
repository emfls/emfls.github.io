export const MAX_VALUE = 1_000_000_000;
const STATES = ['NSW', 'VIC', 'QLD'];
const SURCHARGE_RATES = { NSW: 9, VIC: 8, QLD: 8 };

// Rows contain the upper value, lower value, base duty (cents) and cents per A$100 block.
const NSW_RATES = [
  [18_000, 0, 0, 125],
  [38_000, 18_000, 22_500, 150],
  [103_000, 38_000, 52_500, 175],
  [387_000, 103_000, 166_200, 350],
  [1_290_000, 387_000, 1_160_200, 450],
  [3_870_000, 1_290_000, 5_223_700, 550],
  [Infinity, 3_870_000, 19_413_700, 700],
];
const QLD_GENERAL = [
  [5_000, 0, 0, 0],
  [75_000, 5_000, 0, 150],
  [540_000, 75_000, 105_000, 350],
  [1_000_000, 540_000, 1_732_500, 450],
  [Infinity, 1_000_000, 3_802_500, 575],
];
const QLD_HOME = [
  [350_000, 0, 0, 100],
  [540_000, 350_000, 350_000, 350],
  [1_000_000, 540_000, 1_015_000, 450],
  [Infinity, 1_000_000, 3_085_000, 575],
];

// Victoria applies basis points to the exact excess.
const VIC_GENERAL = [
  [25_000, 0, 0, 140],
  [130_000, 25_000, 35_000, 240],
  [960_000, 130_000, 287_000, 600],
  [2_000_000, 0, 0, 550],
  [Infinity, 2_000_000, 11_000_000, 650],
];
const VIC_PPR = [
  ...VIC_GENERAL.slice(0, 2),
  [440_000, 130_000, 287_000, 500],
  [550_000, 440_000, 1_837_000, 600],
];

function bandDuty(cents, bands, dutyOnExcess) {
  const [, lower, base, rate] = bands.find(([upper]) => cents <= upper * 100);
  return base + dutyOnExcess(cents - lower * 100, rate);
}

function blockDuty(cents, bands) {
  return bandDuty(cents, bands, (excess, rate) => Math.ceil(excess / 10_000) * rate);
}

function percentDuty(cents, bands) {
  return bandDuty(cents, bands, (excess, rate) => excess * rate / 10_000);
}

function nswDuty(cents, buyer, property) {
  const standard = Math.max(2_000, blockDuty(cents, NSW_RATES));
  if (buyer !== 'first') return { standard, transfer: standard };
  const [exempt, cutoff] = property === 'land' ? [35_000_000, 45_000_000] : [80_000_000, 100_000_000];
  if (cents <= exempt) return { standard, transfer: 0 };
  if (cents >= cutoff) return { standard, transfer: standard };

  // The discount tapers from the general duty at the exemption threshold to zero.
  // NSW retains the A$20 minimum on positive concessional assessments.
  const span = cutoff - exempt;
  const discountNumerator = blockDuty(exempt, NSW_RATES) * (cutoff - cents);
  const transfer = (standard * span - discountNumerator) / span;
  return { standard, transfer: Math.max(2_000, transfer) };
}

function vicDuty(cents, buyer) {
  const standard = percentDuty(cents, VIC_GENERAL);
  if (buyer === 'first' && cents <= 75_000_000) {
    const exemption = cents <= 60_000_000;
    const transfer = exemption ? 0 : standard * (cents - 60_000_000) / 15_000_000;
    return { standard, transfer, exemption };
  }
  const transfer = buyer === 'owner' && cents <= 55_000_000
    ? percentDuty(cents, VIC_PPR)
    : standard;
  return { standard, transfer };
}

function qldDuty(cents, buyer, property, foreign, july2026) {
  const standard = blockDuty(cents, QLD_GENERAL);
  if (buyer === 'investor' || (foreign && !july2026)) return { standard, transfer: standard };
  if (buyer === 'first' && property !== 'established') return { standard, transfer: 0 };
  if (property === 'land') return { standard, transfer: standard };

  const home = blockDuty(cents, QLD_HOME);
  if (buyer === 'owner' || cents >= 80_000_000) return { standard, transfer: home };
  if (cents <= 70_000_000) return { standard, transfer: 0 };
  const step = Math.floor((cents - 70_000_000) / 1_000_000);
  return { standard, transfer: home - (10 - step) * 173_500 };
}

/**
 * Estimate residential duty for one whole acquisition, in AUD.
 * A buyer category assumes eligibility for the applicable concession.
 * foreign means the full dutiable value is subject to the foreign rate before exemptions.
 */
export function calculateDuty({
  state, value, buyer = 'investor', property = 'established', foreign = false, july2026 = false,
} = {}) {
  const cents = Math.round(value * 100);
  if (typeof value !== 'number' || cents / 100 !== value || value < 0.01 || value > MAX_VALUE) {
    throw new RangeError('Enter a positive AUD value with at most two decimal places.');
  }
  if (!STATES.includes(state) || !['investor', 'owner', 'first'].includes(buyer)
    || !['established', 'new', 'land'].includes(property) || typeof foreign !== 'boolean'
    || typeof july2026 !== 'boolean') {
    throw new RangeError('Choose a supported state, buyer, property and contract period.');
  }

  const duty = state === 'NSW' ? nswDuty(cents, buyer, property)
    : state === 'VIC' ? vicDuty(cents, buyer)
    : qldDuty(cents, buyer, property, foreign, july2026);
  const standard = Math.round(duty.standard);
  const transfer = Math.round(duty.transfer);
  const surcharge = foreign && !duty.exemption ? Math.round(cents * SURCHARGE_RATES[state] / 100) : 0;
  return {
    state,
    value,
    standardDuty: standard / 100,
    savings: (standard - transfer) / 100,
    transferDuty: transfer / 100,
    surcharge: surcharge / 100,
    total: (transfer + surcharge) / 100,
  };
}

export function compareDuty(options) {
  return STATES.map(state => calculateDuty({ ...options, state }));
}
