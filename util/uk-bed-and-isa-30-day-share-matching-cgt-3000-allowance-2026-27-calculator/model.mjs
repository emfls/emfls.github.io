export const LIMITS = Object.freeze({ isa: 20000, cgt: 3000, dividend: 500 });
export const DIVIDEND_RATES = Object.freeze({
  current: Object.freeze([10.75, 35.75, 39.35]),
  prior: Object.freeze([8.75, 33.75, 39.35]),
});
const MONTHS = 120;
const MAX_MONEY = 1000000000;

function checked(value, label, min, max) {
  if (!Number.isFinite(value) || value < min || value > max || Number(value.toFixed(2)) !== value) {
    throw new RangeError(`${label} must be between ${min} and ${max}, with up to two decimal places.`);
  }
  return value;
}

function pence(value, label, max = MAX_MONEY, min = 0) {
  return Math.round(checked(value, label, min, max) * 100);
}

function maxAffordable(high, allowed) {
  let low = 0;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (allowed(mid)) low = mid;
    else high = mid - 1;
  }
  return low;
}

function capitalGainsTax(taxable, basicBand) {
  const basic = Math.min(taxable, basicBand);
  return basic * 0.18 + (taxable - basic) * 0.24;
}

function project(trade, settings) {
  const { sale, allocatedBasis, invested, cash } = trade;
  const { allowance, exitExemption, basicBand, appreciation, yieldRate, dividendRate } = settings;
  const priceFactor = (1 + appreciation) ** (1 / 12);
  let gia = sale;
  let basis = allocatedBasis;
  let isa = invested;
  let untaxedGia = sale;
  let annualDividends = 0;
  let dividendTaxPaid = 0;
  let breakEvenMonths = null;
  let exitTax = 0;
  let advantage = 0;
  for (let month = 0; month <= MONTHS; month += 1) {
    if (month > 0) {
      if ((month - 1) % 12 === 0) annualDividends = 0;
      const dividend = gia * yieldRate / 12;
      const previouslyTaxable = Math.max(0, annualDividends - allowance);
      annualDividends += dividend;
      const tax = (Math.max(0, annualDividends - allowance) - previouslyTaxable) * dividendRate;
      dividendTaxPaid += tax;
      const reinvested = dividend - tax;
      gia = gia * priceFactor + reinvested;
      basis += reinvested;
      isa = isa * priceFactor + isa * yieldRate / 12;
      untaxedGia = untaxedGia * priceFactor + untaxedGia * yieldRate / 12;
    }
    exitTax = capitalGainsTax(Math.max(0, gia - basis - exitExemption), basicBand);
    advantage = (isa + cash) - (gia - exitTax);
    if (breakEvenMonths === null && advantage >= -1e-8) breakEvenMonths = month;
  }
  return {
    breakEvenMonths: sale > 0 ? breakEvenMonths : null,
    dividendTaxPaid: dividendTaxPaid / 100,
    dividendDrag: (untaxedGia - gia) / 100,
    exitTax: exitTax / 100,
    giaWealth: (gia - exitTax) / 100,
    isaWealth: (isa + cash) / 100,
    advantage: advantage / 100,
  };
}

export function calculateBedAndIsa(inputs) {
  const holding = pence(inputs.holding, 'Holding value', MAX_MONEY, 0.01);
  const cost = pence(inputs.cost, 'Pooled cost');
  const room = pence(inputs.room, 'Remaining ISA allowance', LIMITS.isa);
  const aea = pence(inputs.aea, 'Remaining CGT exemption', LIMITS.cgt);
  const sellFee = pence(inputs.sellFee, 'Sell fee');
  const buyFee = pence(inputs.buyFee, 'Buy fee');
  const basicBand = pence(inputs.basicBand, 'Unused basic-rate band', 37700);
  const exitExemption = pence(inputs.exitExemption, 'Exit CGT exemption', LIMITS.cgt);
  const allowance = pence(inputs.dividendAllowance, 'Remaining dividend allowance', LIMITS.dividend);
  const spreadBasisPoints = Math.round(checked(inputs.spread, 'Bid–ask spread', 0, 25) * 100);
  const appreciation = checked(inputs.appreciation, 'Annual price change', -99, 100) / 100;
  const yieldRate = checked(inputs.yieldRate, 'Annual dividend yield', 0, 100) / 100;
  const dividendRate = checked(inputs.dividendRate, 'Dividend tax rate', 0, 100) / 100;
  if (typeof inputs.sdrt !== 'boolean') throw new TypeError('Select an SDRT treatment.');

  // Cross-multiply the pooled gain to compare the exemption before any rounding.
  const denominator = BigInt(holding);
  const gainNumerator = sale => BigInt(sale) * BigInt(holding - cost) - BigInt(sellFee) * denominator;
  const exemptionNumerator = BigInt(aea) * denominator;
  const gainAt = sale => Number(gainNumerator(sale)) / holding;
  const basicBandNumerator = BigInt(basicBand) * denominator;
  const taxDenominator = 100n * denominator;
  function taxAt(sale) {
    const taxable = gainNumerator(sale) - exemptionNumerator;
    if (taxable <= 0n) return 0;
    const basic = taxable < basicBandNumerator ? taxable : basicBandNumerator;
    const taxNumerator = 18n * basic + 24n * (taxable - basic);
    return Number((taxNumerator + taxDenominator / 2n) / taxDenominator);
  }
  const subscriptionAt = sale => Math.max(0, sale - sellFee - taxAt(sale));
  const fullSale = room > 0 ? maxAffordable(holding, sale => subscriptionAt(sale) <= room) : 0;
  const zeroSale = maxAffordable(Math.min(fullSale, room + sellFee),
    sale => gainNumerator(sale) <= exemptionNumerator);

  function scenario(sale) {
    const entryTax = sale > 0 ? taxAt(sale) : 0;
    const subscription = sale > 0 ? subscriptionAt(sale) : 0;
    const considerationAt = bidValue => bidValue + Math.round(bidValue * spreadBasisPoints / 10000);
    const dutyAt = consideration => inputs.sdrt ? Math.round(consideration / 200) : 0;
    const invested = maxAffordable(Math.max(0, subscription - buyFee), bidValue => {
      const consideration = considerationAt(bidValue);
      return consideration + dutyAt(consideration) + buyFee <= subscription;
    });
    const executedSale = invested > 0 ? sale : 0;
    const consideration = considerationAt(invested);
    const sdrt = dutyAt(consideration);
    const spreadCost = consideration - invested;
    const cash = executedSale ? subscription - consideration - sdrt - buyFee : 0;
    const allocatedBasis = (executedSale / holding) * cost;
    return {
      sale: executedSale / 100,
      subscription: executedSale ? subscription / 100 : 0,
      allocatedBasis: allocatedBasis / 100,
      gain: executedSale ? gainAt(sale) / 100 : 0,
      entryTax: executedSale ? entryTax / 100 : 0,
      invested: invested / 100,
      sdrt: sdrt / 100,
      spreadCost: spreadCost / 100,
      fees: executedSale ? (sellFee + buyFee) / 100 : 0,
      friction: executedSale ? (sellFee + buyFee + sdrt + spreadCost) / 100 : 0,
      cash: cash / 100,
      ...project({ sale: executedSale, allocatedBasis, invested, cash },
        { allowance, exitExemption, basicBand, appreciation, yieldRate, dividendRate }),
    };
  }

  return { zeroCgt: scenario(zeroSale), fullIsa: scenario(fullSale) };
}
