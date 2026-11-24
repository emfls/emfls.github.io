export const LARGE_THRESHOLD = 3_000_000;
export const VERY_LARGE_THRESHOLD = 10_000_000;
export const MAX_AMOUNT = 1_000_000_000;

export function calculateDivision296({
  year, openingTsb = 0, closingTsb, superEarnings, priorLoss = 0, outsideRate = 47,
}) {
  if (year !== '2026-27' && year !== '2027-28+') {
    throw new RangeError('Choose a tax year mode.');
  }

  const firstYear = year === '2026-27';
  const amounts = firstYear ? [closingTsb, priorLoss] : [openingTsb, closingTsb, priorLoss];
  if (amounts.some(amount => !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) ||
      !Number.isFinite(superEarnings) || Math.abs(superEarnings) > MAX_AMOUNT ||
      !Number.isFinite(outsideRate) || outsideRate < 0 || outsideRate > 47) {
    throw new RangeError('Check each amount and the outside tax rate.');
  }

  const testedTsb = firstYear ? closingTsb : Math.max(openingTsb, closingTsb);
  const earnings = Math.max(0, superEarnings);
  const propOver3M = testedTsb > LARGE_THRESHOLD ? (testedTsb - LARGE_THRESHOLD) / testedTsb : 0;
  const propOver10M = testedTsb > VERY_LARGE_THRESHOLD ? (testedTsb - VERY_LARGE_THRESHOLD) / testedTsb : 0;
  const roundedOver3M = Math.round(propOver3M * 10_000) / 10_000;
  const roundedOver10M = Math.round(propOver10M * 10_000) / 10_000;
  const tier1Tax15Pct = 0.15 * (earnings * roundedOver3M);
  const tier2Surcharge10Pct = 0.10 * (earnings * roundedOver10M);
  const totalDiv296Tax = tier1Tax15Pct + tier2Surcharge10Pct;
  const fundTax = 0.15 * earnings;
  const outsideTax = earnings * outsideRate / 100;
  const scenarioEarnings = Math.max(0, superEarnings - priorLoss);
  const scenarioTax = 0.15 * (scenarioEarnings * propOver3M) +
    0.10 * (scenarioEarnings * propOver10M);

  return {
    testedTsb, earnings, propOver3M, propOver10M, roundedOver3M, roundedOver10M,
    tier1Tax15Pct, tier2Surcharge10Pct, totalDiv296Tax, fundTax, outsideTax,
    inSuperAfterTax: earnings - fundTax - totalDiv296Tax,
    outsideAfterTax: earnings - outsideTax,
    scenarioEarnings, scenarioTax, scenarioLossRemaining: Math.max(0, priorLoss - superEarnings),
  };
}
