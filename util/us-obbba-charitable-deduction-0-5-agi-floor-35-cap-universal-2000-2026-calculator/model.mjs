const schedules = {
  single: { standard: 16100, thresholds: [0, 12400, 50400, 105700, 201775, 256225, 640600] },
  mfj: { standard: 32200, thresholds: [0, 24800, 100800, 211400, 403550, 512450, 768700] },
  hoh: { standard: 24150, thresholds: [0, 17700, 67450, 105700, 201750, 256200, 640600] },
  mfs: { standard: 16100, thresholds: [0, 12400, 50400, 105700, 201775, 256225, 384350] },
};
const rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
export const MAX_AMOUNT = 1_000_000_000;

function ordinaryTax(taxable, thresholds) {
  return thresholds.reduce((total, lower, index) => {
    const upper = thresholds[index + 1] ?? Infinity;
    return total + Math.max(0, Math.min(taxable, upper) - lower) * rates[index];
  }, 0);
}

function itemizedTax(agi, deductions, thresholds) {
  const topBracketIncome = Math.max(0, agi - thresholds.at(-1));
  const section68Reduction = Math.min(deductions, topBracketIncome) * 2 / 37;
  const allowed = deductions - section68Reduction;
  const taxable = Math.max(0, agi - allowed);
  return { allowed, taxable, section68Reduction, tax: ordinaryTax(taxable, thresholds) };
}

export function compareGiving({
  filingStatus, agi, directCash, otherCash, stock, otherDeductions, spouseItemizes = false,
}) {
  if (!Object.hasOwn(schedules, filingStatus)) throw new RangeError('Choose a valid filing status.');
  if (![agi, directCash, otherCash, stock, otherDeductions]
    .every(amount => Number.isFinite(amount) && amount >= 0 && amount <= MAX_AMOUNT)) {
    throw new RangeError('Enter amounts from $0 to $1 billion in all five fields.');
  }

  const { standard, thresholds } = schedules[filingStatus];
  const standardDeduction = filingStatus === 'mfs' && spouseItemizes ? 0 : standard;
  const universalLimit = filingStatus === 'mfj' ? 2000 : 1000;
  const agiFloor = agi * 0.005;
  const cashCap = agi * 0.60;
  const stockCap = agi * 0.30;

  function year(multiplier) {
    const stockGift = stock * multiplier;
    const cashGift = (directCash + otherCash) * multiplier;
    const allowedStock = Math.min(stockGift, stockCap);
    // Section 170(b)(1)(G)(i) coordinates cash with gifts counted under (A).
    const allowedCash = Math.min(cashGift, Math.max(0, cashCap - allowedStock));
    const grossEligibleGiving = allowedStock + allowedCash;
    const floorOnStock = Math.min(allowedStock, agiFloor);
    const floorOnCash = Math.min(allowedCash, agiFloor - floorOnStock);
    const lostToFloor = floorOnStock + floorOnCash;
    const capExcess = (stockGift - allowedStock) + (cashGift - allowedCash);
    const potentiallyCarriedFloor =
      (stockGift > allowedStock ? floorOnStock : 0) + (cashGift > allowedCash ? floorOnCash : 0);
    const itemizedCharitableDeduction = Math.max(0, grossEligibleGiving - lostToFloor);
    const itemized = itemizedTax(agi, otherDeductions + itemizedCharitableDeduction, thresholds);
    const floorTaxCost = itemized.tax - itemizedTax(agi, otherDeductions + grossEligibleGiving, thresholds).tax;
    const universalDeduction = Math.min(directCash * multiplier, universalLimit, cashCap);
    const standardAllowed = standardDeduction + universalDeduction;
    const standardTaxable = Math.max(0, agi - standardAllowed);
    const standardTax = ordinaryTax(standardTaxable, thresholds);
    const bestTax = Math.min(standardTax, itemized.tax);
    return {
      universalDeduction, standardAllowed, standardTaxable, standardTax,
      grossEligibleGiving, lostToFloor, capExcess, potentiallyCarriedFloor,
      itemizedCharitableDeduction, itemized, floorTaxCost, bestTax,
    };
  }

  const noGifts = year(0);
  const annual = year(1);
  const bunched = year(3);
  const annualTax = annual.bestTax * 3;
  const bunchedTax = bunched.bestTax + noGifts.bestTax * 2;
  const taxAdvantage = annual.standardTax - annual.itemized.tax;
  const winner = taxAdvantage > 0.005 ? 'itemize'
    : taxAdvantage < -0.005 ? 'standard' : 'tie';
  const effectiveRate = Math.min(0.35, rates.findLast((_, index) => agi >= thresholds[index]));

  return {
    agiFloor, cashCap, stockCap, standardDeduction,
    universalLimit, annual, taxAdvantage, winner, effectiveRate,
    bestGiftTaxSavings: Math.max(0, noGifts.bestTax - annual.bestTax),
    bunching: {
      annualTax, bunchedTax, taxSavings: annualTax - bunchedTax,
      floorRecovered: annual.lostToFloor * 3 - bunched.lostToFloor,
      floorOnlyTaxSavings: annual.floorTaxCost * 3 - bunched.floorTaxCost,
      twoFloorBenchmark: 2 * agiFloor * effectiveRate,
      annualCapExcess: annual.capExcess * 3, bunchedCapExcess: bunched.capExcess,
    },
  };
}
