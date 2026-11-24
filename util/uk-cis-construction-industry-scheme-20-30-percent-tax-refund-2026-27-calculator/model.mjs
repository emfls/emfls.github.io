const cisRates = new Map([
  ['registered_20pct', 20],
  ['unregistered_30pct', 30],
  ['gross_0pct', 0],
]);

// Cumulative taxable income limits after deducting the actual Personal Allowance.
const incomeTaxBands = new Map([
  ['rest_of_uk', [[37700, 20], [125140, 40], [Infinity, 45]]],
  ['scotland', [[3967, 19], [16956, 20], [31092, 21], [62430, 42], [125140, 45], [Infinity, 48]]],
]);

function toPence(value) {
  const pence = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000 || value !== pence / 100) {
    throw new RangeError('Enter amounts from £0 to £1 billion with no more than two decimal places.');
  }
  return pence;
}

function bandTax(taxablePence, bands) {
  let previousLimit = 0;
  let weightedPence = 0;
  for (const [upperLimit, rate] of bands) {
    const limit = upperLimit * 100;
    weightedPence += Math.max(0, Math.min(taxablePence, limit) - previousLimit) * rate;
    if (taxablePence <= limit) break;
    previousLimit = limit;
  }
  return Math.round(weightedPence / 100);
}

/** Estimate UK sole-trader CIS withholding and 2026/27 Income Tax and Class 4 NI. */
export function calculateCis({
  status = 'registered_20pct',
  region = 'rest_of_uk',
  turnover = 0,
  directCosts = 0,
  otherExpenses = 0,
  otherIncome = 0,
  priorYears = 1,
} = {}) {
  const rate = cisRates.get(status);
  const bands = incomeTaxBands.get(region);
  if (rate === undefined || !bands) throw new RangeError('Choose a CIS status and a tax region.');
  if (!Number.isInteger(priorYears) || priorYears < 1 || priorYears > 4) {
    throw new RangeError('Enter a whole number of prior years from 1 to 4.');
  }

  const turnoverPence = toPence(turnover);
  const directPence = toPence(directCosts);
  const profit = turnoverPence - directPence - toPence(otherExpenses);
  const cisLabourBase = Math.max(0, turnoverPence - directPence);
  const cisDeducted = Math.round(cisLabourBase * rate / 100);
  const totalIncome = Math.max(0, profit) + toPence(otherIncome);
  const personalAllowance = Math.max(0, 1257000 - Math.max(0, totalIncome - 10000000) / 2);
  const incomeTax = bandTax(Math.max(0, totalIncome - personalAllowance), bands);
  const class4 = bandTax(Math.max(0, profit - 1257000), [[37700, 6], [Infinity, 2]]);
  const liability = incomeTax + class4;
  const refund = Math.max(0, cisDeducted - liability);
  const balanceDue = Math.max(0, liability - cisDeducted);

  return {
    rate: rate / 100,
    cisLabourBase: cisLabourBase / 100,
    cisDeducted: cisDeducted / 100,
    monthlyCis: Math.round(cisDeducted / 12) / 100,
    profit: profit / 100,
    personalAllowance: Math.round(personalAllowance) / 100,
    incomeTax: incomeTax / 100,
    class4: class4 / 100,
    liability: liability / 100,
    refund: refund / 100,
    balanceDue: balanceDue / 100,
    registrationSaving: (Math.round(cisLabourBase * 30 / 100) - Math.round(cisLabourBase * 20 / 100)) / 100,
    backdateEstimate: refund * priorYears / 100,
    voluntaryClass2Weekly: profit < 710500 ? 3.65 : 0,
  };
}
