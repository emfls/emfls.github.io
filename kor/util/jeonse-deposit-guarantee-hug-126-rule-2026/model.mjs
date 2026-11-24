const MAX_WON = 1_000_000_000_000;

// Annual rates in thousandths of a percent, ordered by debt ratio (≤70%, ≤80%, >80%).
const APARTMENT_RATES = [
  [97, 117, 137], [102, 124, 146], [107, 131, 154], [113, 138, 164]
];
const OTHER_RATES = [
  [111, 142, 172], [117, 151, 184], [124, 161, 197], [132, 172, 211]
];

export function parseManwon(raw) {
  const input = raw.trim();
  if (!/^(?:\d+(?:\.\d{0,4})?|\d{1,3}(?:,\d{3})+(?:\.\d{0,4})?|\.\d{1,4})$/.test(input)) {
    return null;
  }
  const [whole, fraction = ''] = input.replaceAll(',', '').split('.');
  const won = Number(whole) * 10_000 + Number(fraction.padEnd(4, '0'));
  return won <= MAX_WON ? won : null;
}

export function annualRateUnits(type, deposit, debtBand) {
  const table = type === 'apartment' ? APARTMENT_RATES : OTHER_RATES;
  const amountBand = [100_000_000, 200_000_000, 500_000_000, Infinity]
    .findIndex(limit => deposit <= limit);
  return table[amountBand][debtBand];
}

function isWon(value, minimum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= MAX_WON;
}

function roundWon(numerator, denominator) {
  return Number((numerator + denominator / 2n) / denominator);
}

export function calculate(input) {
  const { type, basis, region, price, deposit, senior, days, social, mobile, support, supportCap, conversion } = input;
  if (
    !['villa', 'officetel', 'apartment'].includes(type) ||
    !['published', 'market'].includes(basis) || (type === 'villa' && basis !== 'published') ||
    !['metro', 'other'].includes(region) ||
    !isWon(price, 1) || !isWon(deposit, 1) || !isWon(senior, 0) ||
    !Number.isInteger(days) || days < 1 || days > 3650 ||
    ![0, 40, 60].includes(social) || typeof mobile !== 'boolean' ||
    !['none', 'full', 'other'].includes(support) ||
    ![300_000, 400_000].includes(supportCap) ||
    !Number.isFinite(conversion) || conversion < 0 || conversion > 100
  ) return null;

  const housePrice = price * (basis === 'published' ? 140 : 100) / 100;
  // Store the collateral ceiling in hundredths of a won for exact boundary tests.
  const collateralCents = price * (basis === 'published' ? 126 : 90);
  const grossLimit = Math.floor(collateralCents / 100);
  const seniorLimit = Math.floor(collateralCents * 60 / 10_000);
  const regionLimit = region === 'metro' ? 700_000_000 : 500_000_000;
  const total = deposit + senior;
  const depositLimit = Math.max(0, Math.min(grossLimit - senior, regionLimit));
  const depositDelta = depositLimit - deposit;
  const collateralPass = total <= grossLimit;
  const seniorPass = senior <= seniorLimit;
  const regionPass = deposit <= regionLimit;
  const eligible = collateralPass && seniorPass && regionPass;

  const scaledTotal = total * 10_000;
  const debtBand = scaledTotal <= collateralCents * 70 ? 0
    : scaledTotal <= collateralCents * 80 ? 1 : 2;
  const rateUnits = annualRateUnits(type, deposit, debtBand);
  const surcharge = senior * 10_000 > collateralCents * 50;
  const baseNumerator = BigInt(deposit) * BigInt(rateUnits) * BigInt(days);
  const baseDenominator = 36_500_000n;
  const baseFee = eligible ? roundWon(baseNumerator, baseDenominator) : null;
  const estimatedFee = eligible ? roundWon(
    baseNumerator * BigInt(100 - social) * (mobile ? 97n : 100n) * (surcharge ? 110n : 100n),
    baseDenominator * 1_000_000n
  ) : null;
  const refund = eligible && support !== 'none' && deposit <= 300_000_000
    ? Math.min(supportCap, Math.floor(estimatedFee * (support === 'full' ? 100 : 90) / 100))
    : null;

  return {
    housePrice, grossLimit, seniorLimit, regionLimit, depositLimit, depositDelta,
    collateralPass, seniorPass, regionPass, eligible,
    seniorReduction: Math.max(0, senior - seniorLimit),
    debtRatio: scaledTotal / collateralCents,
    monthlyRent: depositDelta < 0 && seniorPass && depositLimit > 0 && conversion > 0
      ? Math.round(-depositDelta * conversion / 1200) : null,
    rateUnits, surcharge, baseFee, estimatedFee, refund,
    netCost: refund === null ? null : estimatedFee - refund
  };
}
