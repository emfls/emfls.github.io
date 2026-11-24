export const MAX_AMOUNT = 1_000_000_000;
export const MANITOBA_ELECTRONIC_FEE = 137;

// Integer cents and basis points keep thresholds and half-cent rounding deterministic.
const MANITOBA_BRACKETS = [
  { from: 0, to: 30_000, basisPoints: 0 },
  { from: 30_000, to: 90_000, basisPoints: 50 },
  { from: 90_000, to: 150_000, basisPoints: 100 },
  { from: 150_000, to: 200_000, basisPoints: 150 },
  { from: 200_000, to: Infinity, basisPoints: 200 },
];

function toCents(amount) {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
    throw new RangeError('Enter a nonnegative CAD amount up to $1,000,000,000.');
  }
  const cents = Math.round(amount * 100);
  if (cents / 100 !== amount) throw new RangeError('Use at most two decimal places.');
  return cents;
}

function rateInCents(cents, basisPoints) {
  return Math.round(cents * basisPoints / 10_000);
}

export function manitobaTax(propertyValue) {
  const value = toCents(propertyValue);
  let total = 0;
  const tiers = MANITOBA_BRACKETS.map(({ from, to, basisPoints }) => {
    const portion = Math.max(0, Math.min(to * 100, value) - from * 100);
    // Full brackets yield whole dollars, so only the marginal bracket can round.
    const tax = Math.round(portion * basisPoints / 1_000_000);
    total += tax;
    return { from, to, rate: basisPoints / 100, portion: portion / 100, tax };
  });
  return { tiers, total };
}

export function saskatchewanTitleFee(propertyValue, reduced = false) {
  const value = toCents(propertyValue);
  if (value <= 50_000) return 0;
  if (value <= (reduced ? 2_500_000 : 630_000)) return 25;
  return rateInCents(value, reduced ? 10 : 40) / 100;
}

// One title, under the ISC fee schedule effective April 15, 2026.
export function saskatchewanMortgageFee(mortgage) {
  const amount = toCents(mortgage);
  if (amount === 0) return 0;
  if (amount < 25_000_000) return 200;
  if (amount <= 50_000_000) return 275;
  if (amount <= 75_000_000) return 525;
  if (amount <= 100_000_000) return 775;
  return 1000;
}

export function albertaRegistrationFee(amount) {
  return 50 + 5 * Math.ceil(toCents(amount) / 500_000);
}

function provinceCosts(transferTax, titleFee, mortgageFee) {
  const total = (toCents(transferTax) + toCents(titleFee) + toCents(mortgageFee)) / 100;
  return { transferTax, titleFee, mortgageFee, total };
}

export function comparePrairies({
  propertyValue, mortgage = 0, manitobaTitleFee = MANITOBA_ELECTRONIC_FEE, reduced = false,
}) {
  const { tiers, total: tax } = manitobaTax(propertyValue);
  const saskMortgage = saskatchewanMortgageFee(mortgage);
  const manitoba = provinceCosts(tax, manitobaTitleFee, mortgage > 0 ? MANITOBA_ELECTRONIC_FEE : 0);
  const saskatchewan = provinceCosts(0, saskatchewanTitleFee(propertyValue, reduced), saskMortgage);
  const alberta = provinceCosts(0, albertaRegistrationFee(propertyValue), mortgage > 0 ? albertaRegistrationFee(mortgage) : 0);
  const manitobaTotal = Math.round(manitoba.total * 100);
  return {
    tiers, manitoba, saskatchewan, alberta,
    saskatchewanSavings: (manitobaTotal - Math.round(saskatchewan.total * 100)) / 100,
    albertaSavings: (manitobaTotal - Math.round(alberta.total * 100)) / 100,
  };
}
