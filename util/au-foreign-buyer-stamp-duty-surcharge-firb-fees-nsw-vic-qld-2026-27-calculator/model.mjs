export const MAX_AMOUNT = 1_000_000_000;

export const SURCHARGE_RATES = Object.freeze({
  NSW: 9, VIC: 8, QLD: 8, WA: 7, SA: 7, TAS: 8, ACT: 0, NT: 0,
});

export const COMPARISON_STATES = Object.freeze(['NSW', 'VIC', 'QLD', 'WA', 'SA']);

// Lower bound in dollars, published base in dollars, cents per $100 or part.
const UNIT_BRACKETS = {
  NSW: [
    [0, 0, 125], [18_000, 225, 150], [38_000, 525, 175],
    [103_000, 1_662, 350], [387_000, 11_602, 450],
    [1_290_000, 52_237, 550], [3_870_000, 194_137, 700],
  ],
  QLD: [
    [0, 0, 0], [5_000, 0, 150], [75_000, 1_050, 350],
    [540_000, 17_325, 450], [1_000_000, 38_025, 575],
  ],
  WA: [
    [0, 0, 190], [120_000, 2_280, 285], [150_000, 3_135, 380],
    [360_000, 11_115, 475], [725_000, 28_453, 515],
  ],
  SA: [
    [0, 0, 100], [12_000, 120, 200], [30_000, 480, 300],
    [50_000, 1_080, 350], [100_000, 2_830, 400], [200_000, 6_830, 425],
    [250_000, 8_955, 475], [300_000, 11_330, 500], [500_000, 21_330, 550],
  ],
};

function amountInCents(amount) {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT || amount !== cents / 100) {
    throw new RangeError('Enter an amount from A$0.01 to A$1 billion, with up to two decimal places.');
  }
  return cents;
}

function standardDutyCents(state, valueCents) {
  if (state === 'VIC') {
    if (valueCents <= 2_500_000) return Math.round(valueCents * 14 / 1000);
    if (valueCents <= 13_000_000) return 35_000 + Math.round((valueCents - 2_500_000) * 24 / 1000);
    if (valueCents <= 96_000_000) return 287_000 + Math.round((valueCents - 13_000_000) * 6 / 100);
    if (valueCents <= 200_000_000) return Math.round(valueCents * 55 / 1000);
    return 11_000_000 + Math.round((valueCents - 200_000_000) * 65 / 1000);
  }

  // The WA general duty schedule uses dutiable value rounded down to whole dollars.
  const value = state === 'WA' ? Math.floor(valueCents / 100) * 100 : valueCents;
  const [lower, base, rate] = UNIT_BRACKETS[state].findLast(([threshold]) =>
    threshold === 0 || value > threshold * 100);
  const duty = base * 100 + Math.ceil((value - lower * 100) / 10_000) * rate;
  return state === 'NSW' ? Math.max(2_000, duty) : duty;
}

export function standardDuty(state, dutiableValue) {
  if (!COMPARISON_STATES.includes(state)) throw new RangeError('Unsupported state for standard duty.');
  return standardDutyCents(state, amountInCents(dutiableValue)) / 100;
}

export function firbFee(price, established = false) {
  const cents = amountInCents(price);
  if (typeof established !== 'boolean') throw new TypeError('Established dwelling must be true or false.');

  const millionTier = Math.ceil(cents / 100_000_000);
  // ATO tables 1 and 2, 1 July 2026 to 30 June 2027.
  let fee;
  if (cents < 7_500_000) fee = 4_600;
  else if (millionTier === 1) fee = 15_600;
  else if (millionTier <= 40) fee = (millionTier - 1) * 31_300;
  else fee = 1_245_500;
  return established ? fee * 3 : fee;
}

export function compareCosts({ price, marketValue = price, established = false }) {
  const priceCents = amountInCents(price);
  const valueCents = Math.max(priceCents, amountInCents(marketValue));
  const fee = firbFee(price, established);

  return COMPARISON_STATES.map(state => {
    const standardCents = standardDutyCents(state, valueCents);
    const surchargeRate = SURCHARGE_RATES[state];
    const surchargeCents = Math.round(valueCents * surchargeRate / 100);
    const extraCents = surchargeCents + fee * 100;
    const totalCents = standardCents + extraCents;

    return {
      state,
      dutiableValue: valueCents / 100,
      standardDuty: standardCents / 100,
      surchargeRate,
      surcharge: surchargeCents / 100,
      firbFee: fee,
      total: totalCents / 100,
      burdenPercent: totalCents / priceCents * 100,
      extraCost: extraCents / 100,
      acquisitionCost: (priceCents + totalCents) / 100,
    };
  });
}
