// HMRC rates for 6 April 2026 through 5 April 2027, stored in basis points.
const limits = [3770000, 12514000];
const ordinaryRates = [2000, 4000, 4500];
const dividendRates = [1075, 3575, 3935];
const dividendAllowance = 50000;

function cents(amount, label) {
  const rounded = Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000 || rounded / 100 !== amount) {
    throw new RangeError(`${label} must be between £0 and £10,000,000 with up to two decimal places.`);
  }
  return rounded;
}

function bandAmounts(start, end) {
  const [basic, higher] = limits;
  return [
    Math.max(0, Math.min(end, basic) - start),
    Math.max(0, Math.min(end, higher) - Math.max(start, basic)),
    Math.max(0, end - Math.max(start, higher)),
  ];
}

function weighted(bands, rates) {
  return bands.reduce((total, width, index) => total + width * rates[index], 0);
}

export function calculate({ordinary, dividends}) {
  const nonDividendIncome = cents(ordinary, 'Non-dividend income');
  const dividendIncome = cents(dividends, 'Dividends');
  const adjustedNetIncome = nonDividendIncome + dividendIncome;
  const reduction = Math.floor(Math.max(0, adjustedNetIncome - 10000000) / 200) * 100;
  const allowance = Math.max(0, 1257000 - reduction);
  const taxable = Math.max(0, adjustedNetIncome - allowance);
  const leastOrdinary = Math.max(0, nonDividendIncome - allowance);
  const mostOrdinary = Math.min(nonDividendIncome, taxable);

  // ITA 2007 s25: minimize total tax. The slope only changes at band and nil-rate boundaries.
  const breakpoints = [...limits, ...limits.map((limit) => limit - dividendAllowance),
    taxable - dividendAllowance];
  let best;
  for (const ordinaryTaxable of [leastOrdinary, mostOrdinary, ...breakpoints]) {
    if (ordinaryTaxable < leastOrdinary || ordinaryTaxable > mostOrdinary) continue;
    const start = Math.min(ordinaryTaxable + dividendAllowance, taxable);
    const bands = bandAmounts(start, taxable);
    const ordinaryTax = weighted(bandAmounts(0, ordinaryTaxable), ordinaryRates);
    const dividendTax = weighted(bands, dividendRates);
    const totalTax = ordinaryTax + dividendTax;
    if (!best || totalTax < best.totalTax) {
      best = {ordinaryTaxable, ordinaryTax, dividendTax, totalTax, bands, allowanceUsed: start - ordinaryTaxable};
    }
  }

  const pounds = (weightedTax) => Math.round(weightedTax / 10000) / 100;
  const allowanceOnOrdinary = nonDividendIncome - best.ordinaryTaxable;
  const allowanceOnDividends = Math.min(allowance - allowanceOnOrdinary, dividendIncome);
  return {adjustedNetIncome: adjustedNetIncome / 100, allowance: allowance / 100,
    allowanceOnOrdinary: allowanceOnOrdinary / 100, allowanceOnDividends: allowanceOnDividends / 100,
    dividendAllowanceUsed: best.allowanceUsed / 100, bands: best.bands.map((amount) => amount / 100),
    dividendTax: pounds(best.dividendTax), ordinaryTax: pounds(best.ordinaryTax),
    totalTax: pounds(best.totalTax)};
}
