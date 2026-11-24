const WEEKS = 52;
const MEDICARE_RATE = 0.02;

export function residentIncomeTax(taxableIncome) {
  if (!Number.isFinite(taxableIncome)) throw new RangeError('Income must be finite.');

  if (taxableIncome > 190000) return 51370 + (taxableIncome - 190000) * 0.45;
  if (taxableIncome > 135000) return 31020 + (taxableIncome - 135000) * 0.37;
  if (taxableIncome > 45000) return 4020 + (taxableIncome - 45000) * 0.30;
  return Math.max(0, taxableIncome - 18200) * 0.15;
}

export function modelledTax(taxableIncome) {
  return residentIncomeTax(taxableIncome) + Math.max(0, taxableIncome) * MEDICARE_RATE;
}

export function calculateNegativeGearing({
  otherTaxableIncome, weeklyRent, vacancyWeeks, loanAmount, interestRate,
  councilWaterRates, insurance, managementFees, strataMaintenance, nonCashDepreciation, bucket
}) {
  const dollars = [
    otherTaxableIncome, weeklyRent, loanAmount, councilWaterRates, insurance, managementFees,
    strataMaintenance, nonCashDepreciation
  ];
  if (dollars.some(value => !Number.isFinite(value) || value < 0 || value > 1e9)) {
    throw new RangeError('Enter dollar amounts from 0 to 1 billion.');
  }
  if (!Number.isFinite(vacancyWeeks) || vacancyWeeks < 0 || vacancyWeeks > WEEKS) {
    throw new RangeError('Enter vacancy from 0 to 52 weeks.');
  }
  if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) {
    throw new RangeError('Enter an annual interest rate from 0% to 100%.');
  }
  if (!['A', 'B', 'C'].includes(bucket)) throw new RangeError('Select a property category.');

  const grossAnnualRent = weeklyRent * (WEEKS - vacancyWeeks);
  const annualInterest = loanAmount * (interestRate / 100);
  const cashExpenses = annualInterest + councilWaterRates + insurance + managementFees + strataMaintenance;
  const preTaxCashFlow = grossAnnualRent - cashExpenses;
  const netTaxableRentalIncome = preTaxCashFlow - nonCashDepreciation;
  const baselineTax = modelledTax(otherTaxableIncome);

  function scenario(rentalIncome, quarantine) {
    const quarantinedLoss = quarantine ? Math.max(0, -rentalIncome) : 0;
    const taxableRentalIncome = quarantine ? Math.max(0, rentalIncome) : rentalIncome;
    const taxableIncome = Math.max(0, otherTaxableIncome + taxableRentalIncome);
    const annualTaxBenefit = baselineTax - modelledTax(taxableIncome);
    const annualAfterTaxCashFlow = preTaxCashFlow + annualTaxBenefit;

    return {
      taxableIncome,
      annualTaxBenefit,
      weeklyTaxBenefit: annualTaxBenefit / WEEKS,
      annualAfterTaxCashFlow,
      weeklyHoldingCost: -annualAfterTaxCashFlow / WEEKS,
      weeklyCashFlowWithoutDepreciation: (
        preTaxCashFlow + baselineTax -
        modelledTax(otherTaxableIncome + (quarantine ? Math.max(0, preTaxCashFlow) : preTaxCashFlow))
      ) / WEEKS,
      quarantinedLoss
    };
  }

  const transition = scenario(netTaxableRentalIncome, false);
  // Hold 2026–27 tax rates constant so the comparison measures only quarantine.
  const from2027 = scenario(netTaxableRentalIncome, bucket === 'C');
  return {
    grossAnnualRent, annualInterest, cashExpenses, preTaxCashFlow, netTaxableRentalIncome,
    transition, from2027,
    weeklyQuarantineImpact: from2027.weeklyHoldingCost - transition.weeklyHoldingCost
  };
}
