export const PARAMETERS = Object.freeze({
  withholdingRate: 0.20,
  tenantWeeklyThreshold: 100,
  tenantAnnualThreshold: 5200,
  personalAllowance: 12570,
  taperStarts: 100000,
  basicBandEnd: 37700,
  higherBandEnd: 125140,
  basicRate: 0.20,
  higherRate: 0.40,
  additionalRate: 0.45,
  financeCreditRate: 0.20,
});

const roundMoney = (amount) => Math.round(amount * 100 + 1e-7) / 100;

export function personalAllowance(adjustedNetIncome, qualifies) {
  const taper = Math.max(0, adjustedNetIncome - PARAMETERS.taperStarts) / 2;
  return qualifies ? Math.max(0, PARAMETERS.personalAllowance - taper) : 0;
}

export function incomeTax(taxableIncome) {
  const { basicBandEnd, higherBandEnd, basicRate, higherRate, additionalRate } = PARAMETERS;
  const basic = Math.min(Math.max(0, taxableIncome), basicBandEnd);
  const higher = Math.max(0, Math.min(taxableIncome, higherBandEnd) - basicBandEnd);
  const additional = Math.max(0, taxableIncome - higherBandEnd);
  return roundMoney(basic * basicRate + higher * higherRate + additional * additionalRate);
}

export function calculateNrls({
  grossAnnualRent = 0,
  allowableOperatingExpenses = 0,
  agentPaidExpenses = allowableOperatingExpenses,
  mortgageInterest = 0,
  mortgagePrincipal = 0,
  priorFinanceCosts = 0,
  propertyValue = 0,
  otherIncome = 0,
  otherTaxPaid = 0,
  qualifiesForAllowance = false,
  hasNrl1GrossApproval = false,
  payer = 'agent',
  tenantDirectedByHmrc = false,
  tenantLiabilityWeeks = 52,
  taxWithheldOverride = null,
} = {}) {
  const amounts = [
    grossAnnualRent, allowableOperatingExpenses, agentPaidExpenses, mortgageInterest,
    mortgagePrincipal, priorFinanceCosts, propertyValue, otherIncome, otherTaxPaid,
    taxWithheldOverride ?? 0,
  ];
  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0 || amount > 100000000)) {
    throw new RangeError('Enter amounts between £0 and £100,000,000.');
  }
  if (payer !== 'agent' && payer !== 'tenant') {
    throw new RangeError('Choose a letting agent or a direct-paying tenant.');
  }
  if (payer === 'agent' && agentPaidExpenses > allowableOperatingExpenses) {
    throw new RangeError('Agent-paid expenses must be part of the total operating expenses.');
  }
  if (payer === 'tenant' && (!Number.isFinite(tenantLiabilityWeeks) || tenantLiabilityWeeks <= 0 || tenantLiabilityWeeks > 52)) {
    throw new RangeError('Enter more than 0 and up to 52 weeks of tenant rent liability.');
  }

  const { tenantWeeklyThreshold, withholdingRate, financeCreditRate } = PARAMETERS;
  const taxableRentalProfit = roundMoney(Math.max(0, grossAnnualRent - allowableOperatingExpenses));
  const adjustedNetIncome = roundMoney(otherIncome + taxableRentalProfit);
  const allowance = personalAllowance(adjustedNetIncome, qualifiesForAllowance);
  const adjustedTaxableIncome = roundMoney(Math.max(0, adjustedNetIncome - allowance));
  const grossIncomeTax = incomeTax(adjustedTaxableIncome);
  const eligibleFinanceCosts = roundMoney(mortgageInterest + priorFinanceCosts);
  const creditBase = Math.min(eligibleFinanceCosts, taxableRentalProfit, adjustedTaxableIncome);
  const financeCostCredit = Math.min(grossIncomeTax, roundMoney(creditBase * financeCreditRate));
  const selfAssessmentTax = roundMoney(grossIncomeTax - financeCostCredit);

  const taxWithoutRental = incomeTax(otherIncome - personalAllowance(otherIncome, qualifiesForAllowance));
  const rentalIncomeTax = roundMoney(selfAssessmentTax - taxWithoutRental);

  const fullDeductionProfit = Math.max(0, taxableRentalProfit - mortgageInterest);
  const fullDeductionIncome = otherIncome + fullDeductionProfit;
  const fullDeductionTax = incomeTax(fullDeductionIncome - personalAllowance(fullDeductionIncome, qualifiesForAllowance));
  const section24ExtraTax = roundMoney(selfAssessmentTax - fullDeductionTax);

  const tenantAboveThreshold = grossAnnualRent > roundMoney(tenantWeeklyThreshold * tenantLiabilityWeeks);
  const withholdingBase = payer === 'agent'
    ? Math.max(0, grossAnnualRent - agentPaidExpenses)
    : (tenantAboveThreshold || tenantDirectedByHmrc ? grossAnnualRent : 0);
  const withholdingWithoutApproval = roundMoney(withholdingBase * withholdingRate);
  const estimatedWithheld = hasNrl1GrossApproval ? 0 : withholdingWithoutApproval;
  const nrlsWithheld = taxWithheldOverride === null ? estimatedWithheld : roundMoney(taxWithheldOverride);
  const balance = roundMoney(selfAssessmentTax - nrlsWithheld - otherTaxPaid);
  const netAnnualCash = roundMoney(
    grossAnnualRent - allowableOperatingExpenses - mortgageInterest - mortgagePrincipal - rentalIncomeTax,
  );

  return {
    taxableRentalProfit,
    allowance: roundMoney(allowance),
    adjustedTaxableIncome,
    grossIncomeTax,
    financeCostCredit,
    unusedFinanceCosts: roundMoney(eligibleFinanceCosts - creditBase),
    selfAssessmentTax,
    rentalIncomeTax,
    fullDeductionTax,
    section24ExtraTax,
    nrlsWithheld,
    monthlyWithheld: roundMoney(nrlsWithheld / 12),
    nrl1MonthlyBoost: roundMoney(withholdingWithoutApproval / 12),
    refund: Math.max(0, -balance),
    balancingPayment: Math.max(0, balance),
    netAnnualCash,
    netYieldPercent: propertyValue > 0 ? roundMoney(netAnnualCash / propertyValue * 100) : null,
  };
}
