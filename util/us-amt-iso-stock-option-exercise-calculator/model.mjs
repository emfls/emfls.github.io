const MAX_CENTS = 100_000_000_000;
const round = (numerator, denominator) => Math.floor((numerator + denominator / 2) / denominator);

export function parseCents(value) {
  const match = typeof value === 'string' && /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError('Enter a nonnegative amount with up to two decimal places and no commas.');
  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  checkCents(cents);
  return cents;
}

function checkCents(...amounts) {
  if (amounts.some(amount => !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_CENTS)) {
    throw new RangeError('Amounts must be between zero and one billion.');
  }
}

// Rev. Proc. 2025-32, sections 4.01 and 4.14. Bracket limits are in dollars.
const RATES = [10, 12, 22, 24, 32, 35, 37];
const BRACKETS = {
  single: [12400, 50400, 105700, 201775, 256225, 640600],
  hoh: [17700, 67450, 105700, 201750, 256200, 640600],
  mfj: [24800, 100800, 211400, 403550, 512450, 768700],
  mfs: [12400, 50400, 105700, 201775, 256225, 384350],
};
export const STANDARD_DEDUCTION = Object.freeze({single: 1610000, hoh: 2415000, mfj: 3220000, mfs: 1610000});

export function federalTax(gross, status) {
  if (!Object.hasOwn(BRACKETS, status) || !Number.isSafeInteger(gross) || gross < 0 || gross > 8 * MAX_CENTS) {
    throw new RangeError('Check income and filing status.');
  }
  const taxable = Math.max(0, gross - STANDARD_DEDUCTION[status]);
  let lower = 0;
  let tax = 0;
  for (const [index, rate] of RATES.entries()) {
    const upper = index < 6 ? BRACKETS[status][index] * 100 : taxable;
    tax += Math.max(0, Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return round(tax, 100);
}

// Rev. Proc. 2025-32 section 4.10. Amounts below are in cents.
const AMT = {
  single: [9010000, 50000000, 24450000],
  hoh: [9010000, 50000000, 24450000],
  mfj: [14020000, 100000000, 24450000],
  mfs: [7010000, 50000000, 12225000],
};

export function amtTax(unadjustedAmti, status) {
  if (!Object.hasOwn(AMT, status) || !Number.isSafeInteger(unadjustedAmti) || unadjustedAmti < 0 || unadjustedAmti > 3 * MAX_CENTS) {
    throw new RangeError('Check AMT income and filing status.');
  }
  const [fullExemption, phaseStart, rateThreshold] = AMT[status];
  // Keep half-cents through the 50% exemption phaseout and the separate-filer add-on.
  const separateAddOn = status === 'mfs'
    ? Math.min(2 * fullExemption, Math.max(0, unadjustedAmti - 64020000)) : 0;
  const amtiTwice = 2 * unadjustedAmti + separateAddOn;
  const exemptionTwice = Math.max(0, 2 * fullExemption - Math.max(0, unadjustedAmti - phaseStart));
  const baseTwice = Math.max(0, amtiTwice - exemptionTwice);
  const basic = Math.min(baseTwice, 2 * rateThreshold);
  const tmt = round(basic * 26 + (baseTwice - basic) * 28, 200);
  return {amti: round(amtiTwice, 2), exemption: round(exemptionTwice, 2), tmt};
}

export function calculateISO({income, status, fmv, strike, shares, availableShares, otherAddbacks = 0}) {
  checkCents(income, fmv, strike, otherAddbacks);
  if (!Number.isInteger(availableShares) || availableShares < 0 || availableShares > 100000000 ||
      !Number.isInteger(shares) || shares < 0 || shares > availableShares) {
    throw new RangeError('Enter whole shares. Proposed exercise must be within the available grant (up to 100 million).');
  }
  const spread = Math.max(0, fmv - strike);
  checkCents(spread * availableShares);
  const regular = federalTax(income, status);
  const baseAmti = income + otherAddbacks;
  const baseline = amtTax(baseAmti, status).tmt;
  const amtWithoutExercise = Math.max(0, baseline - regular);
  const owedAt = count => Math.max(0, amtTax(baseAmti + spread * count, status).tmt - regular);
  let crossover = null;
  if (amtWithoutExercise === 0) {
    let low = 0;
    let high = availableShares;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (owedAt(middle) === 0) low = middle;
      else high = middle - 1;
    }
    crossover = low;
  }
  const bargain = spread * shares;
  const {amti, exemption, tmt} = amtTax(baseAmti + bargain, status);
  const amt = Math.max(0, tmt - regular);
  const incrementalAmt = amt - amtWithoutExercise;
  return {
    bargain, amti, exemption, tmt, regular, amt, amtWithoutExercise, incrementalAmt,
    crossover, nextShareAmt: crossover !== null && crossover < availableShares ? owedAt(crossover + 1) : null,
    potentialMtc: incrementalAmt,
  };
}

export function minimumTaxCredit({creditAvailable, futureRegularTax, futureTmt}) {
  checkCents(creditAvailable, futureRegularTax, futureTmt);
  const usable = Math.min(creditAvailable, Math.max(0, futureRegularTax - futureTmt));
  return {usable, carryforward: creditAvailable - usable};
}
