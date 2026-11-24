export const THRESHOLDS = Object.freeze({
  single: Object.freeze({ niit: 200000, medicare: 200000 }),
  hoh: Object.freeze({ niit: 200000, medicare: 200000 }),
  mfj: Object.freeze({ niit: 250000, medicare: 250000 }),
  mfs: Object.freeze({ niit: 125000, medicare: 125000 }),
  qss: Object.freeze({ niit: 250000, medicare: 200000 }),
});

export const NIIT_RATE = 0.038;
export const MEDICARE_RATE = 0.009;

function cents(dollars, allowNegative = false) {
  if (!Number.isFinite(dollars) || Math.abs(dollars) > 1e9 || (!allowNegative && dollars < 0)) {
    throw new RangeError('Invalid dollar amount.');
  }
  return Math.round(dollars * 100);
}

function niitBaseCents(investmentCents, magiExcessCents) {
  return Math.max(0, Math.min(investmentCents, magiExcessCents));
}

export function calculateTaxes({
  filing, magi, w2Wages = 0, netSeEarnings = 0, interest = 0, dividends = 0,
  capitalGains = 0, passiveIncome = 0, expenses = 0,
}) {
  if (!Object.hasOwn(THRESHOLDS, filing)) throw new RangeError('Unknown filing status.');
  const thresholds = THRESHOLDS[filing];
  // Subtract in integer cents to preserve threshold boundaries.
  const investmentCents = cents(interest) + cents(dividends) + cents(capitalGains, true)
    + cents(passiveIncome, true) - cents(expenses);
  const magiExcessCents = cents(magi, true) - thresholds.niit * 100;
  const netInvestmentIncome = Math.max(0, investmentCents) / 100;
  const magiExcess = Math.max(0, magiExcessCents) / 100;
  const niitBase = niitBaseCents(investmentCents, magiExcessCents) / 100;
  // A Schedule SE loss cannot offset Medicare wages.
  const medicareBase = Math.max(0, cents(w2Wages) + Math.max(0, cents(netSeEarnings, true))
    - thresholds.medicare * 100) / 100;
  const niitTax = NIIT_RATE * niitBase;
  const addlMedicareTax = MEDICARE_RATE * medicareBase;
  return {
    thresholds, netInvestmentIncome, magiExcess, niitBase, medicareBase, niitTax,
    addlMedicareTax, totalTax: niitTax + addlMedicareTax,
  };
}

export function simulateNiit(inputs, { harvest = 0, muni = 0, pretax = 0 } = {}) {
  const baseline = calculateTaxes(inputs);
  const harvestApplied = Math.min(cents(harvest), Math.max(0, cents(inputs.capitalGains ?? 0, true)));
  const muniApplied = Math.min(cents(muni), cents(inputs.interest ?? 0));
  const pretaxReduction = cents(pretax);
  const originalMagi = cents(inputs.magi, true);
  const originalNii = Math.round(baseline.netInvestmentIncome * 100);
  const originalBase = Math.round(baseline.niitBase * 100);

  function project(loss, shift, deduction) {
    const magi = originalMagi - loss - shift - deduction;
    const base = niitBaseCents(originalNii - loss - shift, magi - baseline.thresholds.niit * 100);
    return {
      magi: magi / 100,
      niitTax: base / 100 * NIIT_RATE,
      niitSaved: (originalBase - base) / 100 * NIIT_RATE,
    };
  }

  return {
    harvest: project(harvestApplied, 0, 0),
    muni: project(0, muniApplied, 0),
    pretax: project(0, 0, pretaxReduction),
    combined: project(harvestApplied, muniApplied, pretaxReduction),
    harvestApplied: harvestApplied / 100,
    muniApplied: muniApplied / 100,
  };
}
