const rates = [10, 12, 22, 24, 32, 35, 37];

export const AMT_2026 = Object.freeze(Object.fromEntries([
  ['single', 16100, 90100, 500000, 244500, [12400, 50400, 105700, 201775, 256225, 640600]],
  ['hoh', 24150, 90100, 500000, 244500, [17700, 67450, 105700, 201750, 256200, 640600]],
  ['mfj', 32200, 140200, 1000000, 244500, [24800, 100800, 211400, 403550, 512450, 768700]],
  ['mfs', 16100, 70100, 500000, 122250, [12400, 50400, 105700, 201775, 256225, 384350]],
].map(([status, standardDeduction, exemption, phaseOutStart, amtCutoff, brackets]) => [
  status,
  Object.freeze({
    standardDeduction, exemption, phaseOutStart, amtCutoff,
    phaseOutEnd: phaseOutStart + 2 * exemption,
    brackets: Object.freeze(brackets),
  }),
])));

function cents(value, label, max = 1_000_000_000) {
  if (!Number.isFinite(value) || value < 0 || value > max || Number(value.toFixed(2)) !== value) {
    throw new RangeError(`Enter ${label} from $0 to $${max.toLocaleString('en-US')} with up to two decimal places.`);
  }
  return Math.round(value * 100);
}

// Use integer units of 1/200 cent so the 50% exemption and both tax rates
// compose exactly. Input limits keep every intermediate a safe integer.
const taxDollars = units => units / 20_000;

function ordinaryTaxUnits(taxableCents, brackets) {
  let tax = 0;
  let lower = 0;
  for (const [index, rate] of rates.entries()) {
    const upper = Math.min(taxableCents, (brackets[index] ?? Infinity) * 100);
    tax += (upper - lower) * rate * 2;
    if (upper === taxableCents) break;
    lower = upper;
  }
  return tax;
}

function amtAt(preAdjustmentCents, status, rules) {
  // Form 6251 line 4 adds an MFS adjustment after the exemption reaches zero.
  // Express AMTI and the exemption in half cents to preserve the exact 50%.
  const mfsAdjustment = status === 'mfs'
    ? Math.min(rules.exemption * 200, Math.max(0, preAdjustmentCents - rules.phaseOutEnd * 100))
    : 0;
  const amti = preAdjustmentCents * 2 + mfsAdjustment;
  const exemption = Math.max(0, rules.exemption * 200 - Math.max(0, preAdjustmentCents - rules.phaseOutStart * 100));
  const taxable = Math.max(0, amti - exemption);
  const at26 = Math.min(taxable, rules.amtCutoff * 200);
  return { amti, exemption, taxable, mfsAdjustment, tax: at26 * 26 + (taxable - at26) * 28 };
}

function maxSpreadCents(baseCents, regularTax, status, rules) {
  if (amtAt(baseCents, status, rules).tax > regularTax) return null;

  // At full phase-out, all AMTI is taxed at 26% or more. This upper bound
  // exceeds regular tax even without the MFS add-on.
  let low = 0;
  let high = Math.max(rules.phaseOutEnd * 100, Math.floor(regularTax / 52) + 1) - baseCents;
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (amtAt(baseCents + mid, status, rules).tax <= regularTax) low = mid;
    else high = mid;
  }
  return low;
}

/**
 * 2026 ordinary-income exercise-and-hold estimate. All monetary inputs and
 * outputs are in dollars. Itemized amounts are allowed Schedule A figures.
 * null maxIsoSpread means baseline AMT, and null maxIsoShares with a valid
 * spread budget means zero per-share spread (no AMT-based share limit).
 */
export function calculateIsoAmt({
  status, ordinaryAgi, deduction = 'standard', itemizedDeductions = 0, salt = 0,
  strikePrice, fmvPrice, sharesExercised,
}) {
  if (!Object.hasOwn(AMT_2026, status)) throw new RangeError('Select a filing status.');
  if (deduction !== 'standard' && deduction !== 'itemized') throw new RangeError('Select a deduction method.');
  if (!Number.isInteger(sharesExercised) || sharesExercised < 0 || sharesExercised > 1_000_000) {
    throw new RangeError('Enter a whole number of shares from 0 to 1,000,000.');
  }

  const rules = AMT_2026[status];
  const agi = cents(ordinaryAgi, 'ordinary AGI');
  const strike = cents(strikePrice, 'exercise price', 100_000);
  const fmv = cents(fmvPrice, 'fair market value', 100_000);
  const itemized = deduction === 'itemized';
  const deductionCents = itemized ? cents(itemizedDeductions, 'allowed itemized deductions') : rules.standardDeduction * 100;
  const addBack = itemized ? cents(salt, 'deducted Schedule A taxes') : deductionCents;
  // Line 7 precedes the section 68 reduction, so it can exceed the final
  // Schedule A total. Bound the difference by the maximum possible reduction.
  const incomeAboveTopBracket = Math.max(0, agi - rules.brackets.at(-1) * 100);
  const maxSection68Reduction = Math.ceil(Math.min(deductionCents * 2 / 35, incomeAboveTopBracket * 2 / 37));
  if (itemized && addBack > deductionCents + maxSection68Reduction) {
    throw new RangeError('Check your Schedule A tax amount and itemized deduction total.');
  }

  const taxable = Math.max(0, agi - deductionCents);
  const regular = ordinaryTaxUnits(taxable, rules.brackets);
  // Form 6251 begins with AGI less deductions, which can be negative.
  const baseCents = agi - deductionCents + addBack;
  const perShare = Math.max(0, fmv - strike);
  const spread = perShare * sharesExercised;
  const baseline = amtAt(baseCents, status, rules);
  const exercise = amtAt(baseCents + spread, status, rules);
  const baselineAmt = Math.max(0, baseline.tax - regular);
  const amtOwed = Math.max(0, exercise.tax - regular);
  const maxSpread = maxSpreadCents(baseCents, regular, status, rules);

  return {
    deductionAmount: deductionCents / 100,
    deductionAddBack: addBack / 100,
    regularTaxableIncome: taxable / 100,
    regularTax: taxDollars(regular),
    isoSpreadPerShare: perShare / 100,
    isoSpread: spread / 100,
    amti: exercise.amti / 200,
    mfsAdjustment: exercise.mfsAdjustment / 200,
    exemption: exercise.exemption / 200,
    amtTaxableIncome: exercise.taxable / 200,
    tentativeMinimumTax: taxDollars(exercise.tax),
    baselineAmt: taxDollars(baselineAmt),
    amtOwed: taxDollars(amtOwed),
    // With ISO as the sole deferral item, exclusion-only AMT is baseline AMT.
    estimatedNewMinimumTaxCredit: taxDollars(amtOwed - baselineAmt),
    exerciseCost: strike * sharesExercised / 100,
    maxIsoSpread: maxSpread === null ? null : maxSpread / 100,
    maxIsoShares: maxSpread === null ? 0 : perShare === 0 ? null : Math.floor(maxSpread / perShare),
  };
}
