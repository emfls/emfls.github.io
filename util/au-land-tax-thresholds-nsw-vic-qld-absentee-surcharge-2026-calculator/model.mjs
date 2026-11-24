// Each band lists its starting land value (AUD), base tax (AUD) and marginal rate (%).
const NSW_THRESHOLD = 1_075_000;
const NSW_PREMIUM = 6_571_000;
const NSW_GENERAL = [
  [NSW_THRESHOLD, 100, 1.6],
  [NSW_PREMIUM, 88_036, 2],
];
const NSW_TRUST = [
  [0, 0, 1.6],
  [NSW_PREMIUM, 105_136, 2],
];
const VIC_GENERAL = [
  [50_000, 500, 0],
  [100_000, 975, 0],
  [300_000, 1_350, 0.3],
  [600_000, 2_250, 0.6],
  [1_000_000, 4_650, 0.9],
  [1_800_000, 11_850, 1.65],
  [3_000_000, 31_650, 2.65],
];
const VIC_TRUST = [
  [25_000, 82, 0.375],
  [50_000, 676, 0.375],
  [100_000, 1_338, 0.375],
  [250_000, 1_901, 0.675],
  [600_000, 4_263, 0.975],
  [1_000_000, 8_163, 1.275],
  [1_800_000, 18_363, 1.1072],
  [3_000_000, 31_650, 2.65],
];
const QLD_INDIVIDUAL = [
  [600_000, 500, 1],
  [1_000_000, 4_500, 1.65],
  [3_000_000, 37_500, 1.25],
  [5_000_000, 62_500, 1.75],
  [10_000_000, 150_000, 2.25],
];
const QLD_THRESHOLD = 350_000;
const QLD_LOWER_ENTITY_BANDS = [
  [QLD_THRESHOLD, 1_450, 1.7],
  [2_250_000, 33_750, 1.5],
];
const QLD_ENTITY = [
  ...QLD_LOWER_ENTITY_BANDS,
  [5_000_000, 75_000, 2.25],
  [10_000_000, 187_500, 2.75],
];
const QLD_ABSENTEE = [
  ...QLD_LOWER_ENTITY_BANDS,
  [5_000_000, 75_000, 2],
  [10_000_000, 175_000, 2.5],
];

const STATES = ['NSW', 'VIC', 'QLD'];
const OWNERS = ['individual', 'company', 'trust'];
export const MAX_AMOUNT = Number.MAX_SAFE_INTEGER / 100;

function checkAmount(value, label, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum || value > MAX_AMOUNT) {
    throw new RangeError(`Enter a valid ${label} in Australian dollars.`);
  }
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON * Math.abs(value)) * 100) / 100;
}

function bandTax(bands, landValue) {
  const band = bands.findLast(([start]) => landValue >= start);
  if (!band) return 0;
  const [start, base, rate] = band;
  return base + (landValue - start) * rate / 100;
}

export function calculateLandTax({ state, owner, landValue, surcharged = false }) {
  checkAmount(landValue, 'taxable land value');
  if (!STATES.includes(state) || !OWNERS.includes(owner) || typeof surcharged !== 'boolean') {
    throw new RangeError('Select a supported state, owner type and surcharge status.');
  }

  let baseTax = 0;
  let surcharge = 0;
  let baseRateChange = 0;
  switch (state) {
    case 'NSW':
      if (owner === 'trust') {
        baseTax = bandTax(NSW_TRUST, landValue);
      } else if (landValue > NSW_THRESHOLD) {
        baseTax = bandTax(NSW_GENERAL, landValue);
      }
      if (surcharged) surcharge = landValue * 0.05;
      break;
    case 'VIC': {
      const bands = owner === 'trust' ? VIC_TRUST : VIC_GENERAL;
      baseTax = bandTax(bands, landValue);
      if (surcharged && landValue >= bands[0][0]) surcharge = landValue * 0.04;
      break;
    }
    case 'QLD':
      if (owner === 'individual') {
        baseTax = bandTax(surcharged ? QLD_ABSENTEE : QLD_INDIVIDUAL, landValue);
        if (surcharged) baseRateChange = roundMoney(baseTax) - roundMoney(bandTax(QLD_INDIVIDUAL, landValue));
      } else {
        baseTax = bandTax(QLD_ENTITY, landValue);
      }
      if (surcharged) surcharge = Math.max(0, landValue - QLD_THRESHOLD) * 0.03;
      break;
  }

  baseTax = roundMoney(baseTax);
  surcharge = roundMoney(surcharge);
  return {
    baseTax,
    surcharge,
    totalTax: roundMoney(baseTax + surcharge),
    statusImpact: roundMoney(surcharge + baseRateChange),
  };
}

export function compareLandTax({
  landValue, owner, surcharged = false, propertyValue = null, annualRent = 0, annualExpenses = 0,
}) {
  if (propertyValue !== null) checkAmount(propertyValue, 'property market value', 0.01);
  checkAmount(annualRent, 'annual rent');
  checkAmount(annualExpenses, 'annual operating expenses');
  const netIncomeBeforeTax = annualRent - annualExpenses;

  return STATES.map(state => {
    const options = { state, landValue, surcharged };
    const selected = calculateLandTax({ ...options, owner });
    const individual = owner === 'individual' ? selected : calculateLandTax({ ...options, owner: 'individual' });
    const trust = owner === 'trust' ? selected : calculateLandTax({ ...options, owner: 'trust' });
    return {
      state,
      ...selected,
      trustDifference: roundMoney(trust.totalTax - individual.totalTax),
      netYieldBeforeTax: propertyValue === null ? null : netIncomeBeforeTax * 100 / propertyValue,
      netYieldAfterTax: propertyValue === null ? null : (netIncomeBeforeTax - selected.totalTax) * 100 / propertyValue,
      yieldDrag: propertyValue === null ? null : selected.totalTax * 100 / propertyValue,
    };
  });
}
