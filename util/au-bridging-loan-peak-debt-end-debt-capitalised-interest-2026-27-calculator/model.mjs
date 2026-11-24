export function calcMonthlyPayment(principal, annualRate, months) {
  if (principal <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const rm = annualRate / 12;
  return principal * (rm * Math.pow(1 + rm, months)) / (Math.pow(1 + rm, months) - 1);
}

export function calcBridgingLoan(inputs) {
  const {
    existingPropertyValue = 1200000,
    existingMortgage = 400000,
    newPurchasePrice = 1500000,
    purchaseCosts = 65000,
    depositContributed = 100000,
    bridgingPeriodMonths = 6,
    bridgingRate = 0.0685,
    expectedSalePrice = 1200000,
    sellingCosts = 29500,
    endDebtTermYears = 30,
    endDebtRate = 0.0625
  } = inputs;

  if (existingPropertyValue <= 0 || isNaN(existingPropertyValue)) throw new RangeError('Existing property value must be positive');
  if (newPurchasePrice <= 0 || isNaN(newPurchasePrice)) throw new RangeError('New purchase price must be positive');
  if (bridgingPeriodMonths <= 0 || bridgingPeriodMonths > 24 || isNaN(bridgingPeriodMonths)) throw new RangeError('Bridging period must be between 1 and 24 months');
  if (bridgingRate < 0 || isNaN(bridgingRate)) throw new RangeError('Bridging rate cannot be negative');

  // Initial Peak Debt
  const initialPeakDebt = existingMortgage + newPurchasePrice + purchaseCosts - depositContributed;
  const combinedSecurityValue = existingPropertyValue + newPurchasePrice;
  const peakLvr = (initialPeakDebt / combinedSecurityValue) * 100;

  // Month-by-month capitalised interest
  let currentDebt = initialPeakDebt;
  const schedule = [];
  const monthlyRate = bridgingRate / 12;

  for (let m = 1; m <= bridgingPeriodMonths; m++) {
    const interest = currentDebt * monthlyRate;
    const closingDebt = currentDebt + interest;
    schedule.push({
      month: m,
      openingDebt: currentDebt,
      interestCharged: interest,
      closingDebt: closingDebt
    });
    currentDebt = closingDebt;
  }

  const finalPeakDebt = currentDebt;
  const totalCapitalisedInterest = finalPeakDebt - initialPeakDebt;

  // Net Sale Proceeds
  const netProceeds = Math.max(0, expectedSalePrice - sellingCosts);

  // Ongoing End Debt
  const endDebt = Math.max(0, finalPeakDebt - netProceeds);
  const endLvr = (endDebt / newPurchasePrice) * 100;
  const endDebtMonthlyPayment = calcMonthlyPayment(endDebt, endDebtRate, endDebtTermYears * 12);

  // Stress tests (Sale price drops -5%, -10%, -15%)
  const stressScenarios = [-0.05, -0.10, -0.15].map(pct => {
    const dropPct = Math.abs(pct * 100);
    const stressedSalePrice = expectedSalePrice * (1 + pct);
    const stressedSellingCosts = sellingCosts * (1 + pct * 0.5);
    const stressedNetProceeds = Math.max(0, stressedSalePrice - stressedSellingCosts);
    const stressedEndDebt = Math.max(0, finalPeakDebt - stressedNetProceeds);
    const stressedEndLvr = (stressedEndDebt / newPurchasePrice) * 100;
    const stressedPayment = calcMonthlyPayment(stressedEndDebt, endDebtRate, endDebtTermYears * 12);
    return {
      dropPct,
      salePrice: stressedSalePrice,
      netProceeds: stressedNetProceeds,
      endDebt: stressedEndDebt,
      endLvr: stressedEndLvr,
      monthlyPayment: stressedPayment
    };
  });

  return {
    initialPeakDebt,
    combinedSecurityValue,
    peakLvr,
    totalCapitalisedInterest,
    finalPeakDebt,
    netProceeds,
    endDebt,
    endLvr,
    endDebtMonthlyPayment,
    schedule,
    stressScenarios,
    isPeakLvrSafe: peakLvr <= 80,
    isEndLvrSafe: endLvr <= 80
  };
}
