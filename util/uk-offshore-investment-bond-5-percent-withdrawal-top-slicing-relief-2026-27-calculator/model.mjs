const PA = 12570;
const TAPER_START = 100000;
const BASIC_LIMIT = 37700;
const ADDITIONAL_THRESHOLD = 125140;
const SAVINGS_STARTING_BAND = 5000;
const BASIC_RATE = 0.20;
const HIGHER_RATE = 0.40;
const ADDITIONAL_RATE = 0.45;
const HICBC_START = 60000;

function bandTax(start, end) {
  const basic = Math.max(0, Math.min(BASIC_LIMIT, end) - start);
  const higher = Math.max(0, Math.min(ADDITIONAL_THRESHOLD, end) - Math.max(BASIC_LIMIT, start));
  const additional = Math.max(0, end - Math.max(ADDITIONAL_THRESHOLD, start));
  return basic * BASIC_RATE + higher * HIGHER_RATE + additional * ADDITIONAL_RATE;
}

function taxOnStack(nonSavings, savings, gain) {
  const ani = nonSavings + savings + gain;
  const pa = Math.max(0, PA - Math.max(0, ani - TAPER_START) / 2);
  const taxableNonSavings = Math.max(0, nonSavings - pa);
  const paAfterNonSavings = Math.max(0, pa - nonSavings);
  const taxableSavings = Math.max(0, savings - paAfterNonSavings);
  const taxableGain = Math.max(0, gain - Math.max(0, paAfterNonSavings - savings));
  const base = taxableNonSavings + taxableSavings;
  const top = base + taxableGain;
  const psa = top > ADDITIONAL_THRESHOLD ? 0 : top > BASIC_LIMIT ? 500 : 1000;
  // The two savings nil-rate bands occupy space in the underlying tax bands.
  const nilRateEnd = taxableNonSavings + Math.max(0, SAVINGS_STARTING_BAND - taxableNonSavings) + psa;

  return {
    ani, pa, psa,
    otherTax: bandTax(0, taxableNonSavings) + bandTax(Math.max(taxableNonSavings, nilRateEnd), base),
    gainTax: bandTax(Math.max(base, nilRateEnd), top)
  };
}

function money(value, label, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum || value > 1e12) {
    throw new RangeError(`${label} must be between £${minimum} and £1,000,000,000,000.`);
  }
  return value;
}

function integer(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return value;
}

const roundMoney = value => Math.round(value * 100) / 100;

/** Estimates one excess event or whole-policy surrender for a single-premium offshore bond. */
export function calculateBond({
  event, premium, policyYears, allowanceUsed, withdrawal,
  surrenderValue, previousWithdrawals, previousGains, nonSavings, otherSavings,
  totalDays, foreignDays, foreignYears
}) {
  if (event !== 'withdrawal' && event !== 'surrender') {
    throw new RangeError('Choose a part withdrawal or full surrender.');
  }
  money(premium, 'Original premium', 0.01);
  money(allowanceUsed, 'Previous allowance used');
  money(nonSavings, 'Non-savings income');
  money(otherSavings, 'Other savings income');
  const partial = event === 'withdrawal';
  integer(policyYears, 'Policy years', partial ? 1 : 0, 150);
  integer(totalDays, 'Days in material interest period', 1, 55000);
  integer(foreignDays, 'Foreign days', 0, totalDays);
  integer(foreignYears, 'Whole non-UK resident years', 0, Math.min(policyYears, Math.floor(foreignDays / 365)));

  // Cap total accrual at 20 years before deducting previously consumed allowance.
  const accrued = premium * (Math.min(policyYears, 20) / 20);
  const availableAllowance = roundMoney(Math.max(0, accrued - allowanceUsed));
  let gain;
  let surrenderResult = null;
  let currentDeferred = null;
  if (partial) {
    money(withdrawal, 'Part withdrawals this policy year');
    currentDeferred = Math.min(withdrawal, availableAllowance);
    gain = roundMoney(withdrawal - currentDeferred);
  } else {
    money(surrenderValue, 'Full surrender value');
    money(previousWithdrawals, 'Previous withdrawals');
    money(previousGains, 'Previous chargeable gains');
    surrenderResult = roundMoney(surrenderValue + previousWithdrawals - premium - previousGains);
    gain = Math.max(0, surrenderResult);
  }

  const tar = gain * (foreignDays / totalDays);
  const taxableGain = gain - tar;
  const n = Math.max(1, policyYears - foreignYears);
  const slice = taxableGain / n;
  const full = taxOnStack(nonSavings, otherSavings, taxableGain);
  const annual = taxOnStack(nonSavings, otherSavings, slice);

  // HMRC IPTM3830/3840 and SA110. These notional amounts are used only
  // to compare liabilities for TSR. The offshore tax bill gets no credit.
  const fullLiability = Math.max(0, full.gainTax - taxableGain * BASIC_RATE);
  const annualLiability = Math.max(0, annual.gainTax - slice * BASIC_RATE);
  const relief = Math.max(0, fullLiability - annualLiability * n);
  const finalTax = full.gainTax - relief;
  const base = taxOnStack(nonSavings, otherSavings, 0);
  const otherTaxImpact = full.otherTax - base.otherTax;

  return {
    availableAllowance, currentDeferred, surrenderResult, gain, tar, taxableGain, n, slice,
    fullPA: full.pa, slicePA: annual.pa, fullPSA: full.psa, slicePSA: annual.psa,
    fullGainTax: full.gainTax, sliceTax: annual.gainTax, relief, finalTax,
    effectiveRate: taxableGain > 0 ? finalTax / taxableGain : 0,
    otherTaxImpact, additionalIncomeTax: finalTax + otherTaxImpact,
    ani: full.ani, baseAni: base.ani, hicbc: full.ani > HICBC_START, taper: full.ani > TAPER_START
  };
}
