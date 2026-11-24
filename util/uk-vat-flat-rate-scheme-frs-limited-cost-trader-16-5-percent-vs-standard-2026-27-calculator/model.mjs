export const VAT_RULES = Object.freeze({
  standardRate: 20,
  limitedCostRate: 16.5,
  relevantGoodsPercent: 2,
  annualGoodsFloor: 1000,
  registrationThreshold: 90000,
  entryLimit: 150000,
  exitLimit: 230000,
  capitalPurchaseMinimum: 2000,
  firstYearDiscount: 1,
  maxAmount: 1_000_000_000,
});

function toPence(value, label) {
  const pence = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > VAT_RULES.maxAmount ||
      Math.abs(value * 100 - pence) > 0.00005) {
    throw new RangeError(label + ' must be between £0 and £1 billion, with up to two decimal places.');
  }
  return pence;
}

export function calculateVat({
  netTaxableSales,
  vatableExpensesNet,
  relevantGoodsGross,
  singleCapitalPurchaseGross = 0,
  otherCapitalNet = 0,
  sectorRate,
  firstYear = false,
  rollingTaxableTurnover,
  projectedTaxableTurnover,
  anniversaryTotalIncome,
}) {
  const sales = toPence(netTaxableSales, 'Annual sales');
  const expenses = toPence(vatableExpensesNet, 'Operating expenses');
  const goods = toPence(relevantGoodsGross, 'Relevant goods');
  const purchase = toPence(singleCapitalPurchaseGross, 'Single capital purchase');
  const otherCapital = toPence(otherCapitalNet, 'Other capital purchases');
  const sectorBasisPoints = Math.round(sectorRate * 100);
  if (!Number.isFinite(sectorRate) || sectorRate < 4 || sectorRate > 14.5 ||
      Math.abs(sectorRate * 100 - sectorBasisPoints) > 0.00005) {
    throw new RangeError('Sector rate must be between 4% and 14.5%, with up to two decimal places.');
  }

  const outputVat = Math.round(sales * VAT_RULES.standardRate / 100);
  const grossSales = sales + outputVat;
  const minimumGoods = Math.max(
    VAT_RULES.annualGoodsFloor * 100,
    Math.ceil(grossSales * VAT_RULES.relevantGoodsPercent / 100),
  );
  const limited = goods < minimumGoods;
  const rateBasisPoints = (limited ? VAT_RULES.limitedCostRate * 100 : sectorBasisPoints) -
    (firstYear ? VAT_RULES.firstYearDiscount * 100 : 0);
  const operatingVat = Math.round(expenses * VAT_RULES.standardRate / 100);
  const singlePurchaseVat = Math.round(purchase * VAT_RULES.standardRate / (100 + VAT_RULES.standardRate));
  const otherCapitalVat = Math.round(otherCapital * VAT_RULES.standardRate / 100);
  const standardCapitalVat = singlePurchaseVat + otherCapitalVat;
  const flatCapitalVat = purchase >= VAT_RULES.capitalPurchaseMinimum * 100 ? singlePurchaseVat : 0;
  const standardPayable = outputVat - operatingVat - standardCapitalVat;
  const flatPayable = Math.round(grossSales * rateBasisPoints / 10000) - flatCapitalVat;
  const flatRateCashAdvantage = standardPayable - flatPayable;
  const grossCosts = expenses + operatingVat + purchase + otherCapital + otherCapitalVat;
  const breakEvenOperatingInputVat = outputVat - standardCapitalVat - flatPayable;
  const rolling = toPence(rollingTaxableTurnover ?? netTaxableSales, 'Rolling taxable turnover');
  const projected = toPence(projectedTaxableTurnover ?? netTaxableSales, 'Projected taxable turnover');
  const anniversary = anniversaryTotalIncome === undefined ? grossSales :
    toPence(anniversaryTotalIncome, 'Anniversary total income');

  return {
    status: limited ? 'LIMITED_COST_16_5_PCT' : 'SECTOR_RATE_ELIGIBLE',
    effectiveFlatRate: rateBasisPoints / 100,
    grossTurnoverIncVat: grossSales / 100,
    outputVat: outputVat / 100,
    relevantGoodsTarget: minimumGoods / 100,
    additionalRelevantGoodsNeeded: Math.max(0, minimumGoods - goods) / 100,
    standardCapitalVat: standardCapitalVat / 100,
    flatCapitalVat: flatCapitalVat / 100,
    standardVatPayable: standardPayable / 100,
    flatRateVatPayable: flatPayable / 100,
    standardNetCash: (grossSales - grossCosts - standardPayable) / 100,
    flatRateNetCash: (grossSales - grossCosts - flatPayable) / 100,
    flatRateCashAdvantage: flatRateCashAdvantage / 100,
    winner: flatRateCashAdvantage > 0 ? 'FLAT_RATE' : flatRateCashAdvantage < 0 ? 'STANDARD' : 'TIE',
    annualSavings: Math.abs(flatRateCashAdvantage) / 100,
    breakEvenOperatingExpensesNet: breakEvenOperatingInputVat < 0 ? null :
      breakEvenOperatingInputVat / VAT_RULES.standardRate,
    registrationThresholdExceeded: rolling > VAT_RULES.registrationThreshold * 100,
    withinEntryTurnoverLimit: projected <= VAT_RULES.entryLimit * 100,
    anniversaryExitThresholdExceeded: anniversary > VAT_RULES.exitLimit * 100,
  };
}
