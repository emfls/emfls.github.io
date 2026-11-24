// 2026–27 Australia Chattel Mortgage vs Finance Lease Statutory Model (ATO BAS GST, Car Limit & Tax Deductions)
export const ATO_CAR_LIMIT_2026_27 = 69883; // 2026–27 ATO Depreciation and GST Car Cost Limit
export const ATO_MAX_CAR_GST_2026_27 = 6353; // Maximum claimable upfront GST ($69,883 / 11)

export function calcChattelMortgageVsLease(inputs = {}) {
  const {
    assetPrice = 95000, // Total purchase price incl GST
    assetType = 'commercial', // 'commercial' (ute/truck/machinery, uncapped) or 'passenger' (car, subject to $69,883 cap)
    termMonths = 60, // 12, 24, 36, 48, 60
    interestRate = 6.75, // Annual interest rate %
    balloonPercent = 30, // Residual balloon % at term end
    corporateTaxRate = 25, // 25% (Base Rate Entity) or 30%
    businessUsePercent = 100 // % business use
  } = inputs;

  const validPrice = Math.max(1000, Number(assetPrice) || 95000);
  const isPassengerCar = assetType === 'passenger';
  const validTerm = Math.max(12, Math.min(84, Math.round(Number(termMonths) || 60)));
  const validRate = Math.max(0.1, Math.min(25, Number(interestRate) || 6.75)) / 100;
  const validMonthlyRate = validRate / 12;
  const validBalloonPct = Math.max(0, Math.min(60, Number(balloonPercent) || 30)) / 100;
  const validTaxRate = Math.max(0, Math.min(50, Number(corporateTaxRate) || 25)) / 100;
  const validBizUse = Math.max(1, Math.min(100, Number(businessUsePercent) || 100)) / 100;

  // --- 1. CHATTEL MORTGAGE CALCULATION ---
  // Buyer owns asset Day 1. Full GST (or capped GST) claimed upfront on next BAS.
  let cmUpfrontGST = validPrice / 11;
  let cmDeprecCostBase = validPrice - (cmUpfrontGST); // Net cost base for depreciation
  if (isPassengerCar && validPrice > ATO_CAR_LIMIT_2026_27) {
    cmUpfrontGST = ATO_MAX_CAR_GST_2026_27;
    cmDeprecCostBase = ATO_CAR_LIMIT_2026_27; // Capped depreciation limit
  }
  cmUpfrontGST = cmUpfrontGST * validBizUse;

  // Amount financed under Chattel Mortgage = Full purchase price (GST is funded or refunded to buyer)
  const cmFinancedAmount = validPrice;
  const cmBalloonAmount = cmFinancedAmount * validBalloonPct;

  // Monthly payment calculation with balloon (FV = -cmBalloonAmount)
  // PMT = (PV - FV / (1+r)^n) * (r / (1 - (1+r)^(-n)))
  const discountFactor = Math.pow(1 + validMonthlyRate, -validTerm);
  const balloonPV = cmBalloonAmount * discountFactor;
  const cmMonthlyPayment = ((cmFinancedAmount - balloonPV) * (validMonthlyRate / (1 - discountFactor)));
  const cmTotalRepayments = (cmMonthlyPayment * validTerm) + cmBalloonAmount;
  const cmTotalInterest = cmTotalRepayments - cmFinancedAmount;

  // Depreciation: Small business simplified pool (15% Year 1, 30% thereafter) over term
  // For standard comparison over the term, approximate total allowable depreciation = cost base - residual balloon (or capped limit)
  const cmTotalAllowableDepreciation = Math.max(0, cmDeprecCostBase - (cmBalloonAmount * (cmDeprecCostBase / validPrice))) * validBizUse;
  const cmDeductibleInterest = cmTotalInterest * validBizUse;
  const cmTotalTaxDeductions = cmTotalAllowableDepreciation + cmDeductibleInterest;
  const cmTaxShield = cmTotalTaxDeductions * validTaxRate;

  // Net After-Tax Cash Cost (Chattel Mortgage)
  // Cash out: Total repayments - Upfront GST refund - Tax Shield
  const cmNetLifetimeCost = cmTotalRepayments - cmUpfrontGST - cmTaxShield;

  // --- 2. FINANCE LEASE CALCULATION ---
  // Financier owns asset. Net asset price (ex-GST) is financed.
  const leaseNetFinanced = validPrice / 1.1; // Ex-GST asset price
  const leaseResidualExGST = leaseNetFinanced * validBalloonPct;
  const leaseBalloonPV = leaseResidualExGST * discountFactor;
  const leaseMonthlyRentalExGST = ((leaseNetFinanced - leaseBalloonPV) * (validMonthlyRate / (1 - discountFactor)));

  // 10% GST is added to each monthly rental and claimed back on quarterly BAS
  const leaseMonthlyGST = leaseMonthlyRentalExGST * 0.1 * validBizUse;
  const leaseMonthlyRentalIncGST = leaseMonthlyRentalExGST * 1.1;
  const leaseResidualGST = leaseResidualExGST * 0.1 * validBizUse;
  const leaseResidualIncGST = leaseResidualExGST * 1.1;

  const leaseTotalRentalsExGST = leaseMonthlyRentalExGST * validTerm;
  const leaseTotalGSTClaimed = (leaseMonthlyGST * validTerm) + leaseResidualGST;
  const leaseTotalGrossOutflow = (leaseMonthlyRentalIncGST * validTerm) + leaseResidualIncGST;

  // Tax deductions: 100% of lease rental payments (ex-GST) are tax deductible
  // (Subject to car limit depreciation deduction limit if passenger car above limit, ATO TR 98/15)
  let leaseDeductibleRentals = leaseTotalRentalsExGST;
  if (isPassengerCar && validPrice > ATO_CAR_LIMIT_2026_27) {
    const carLimitRatio = ATO_CAR_LIMIT_2026_27 / validPrice;
    leaseDeductibleRentals = leaseTotalRentalsExGST * carLimitRatio;
  }
  leaseDeductibleRentals = leaseDeductibleRentals * validBizUse;
  const leaseTaxShield = leaseDeductibleRentals * validTaxRate;

  // Net After-Tax Cash Cost (Finance Lease)
  // Cash out: Gross Outflows - Total GST Claimed - Tax Shield
  const leaseNetLifetimeCost = leaseTotalGrossOutflow - leaseTotalGSTClaimed - leaseTaxShield;

  // Difference: Positive means Chattel Mortgage saves money; negative means Lease is cheaper
  const netSavings = leaseNetLifetimeCost - cmNetLifetimeCost;
  const winner = netSavings >= 0 ? 'CHATTEL_MORTGAGE' : 'FINANCE_LEASE';

  return {
    assetPrice: Math.round(validPrice * 100) / 100,
    isPassengerCar,
    termMonths: validTerm,
    interestRate: Math.round(validRate * 10000) / 100,
    balloonPercent: Math.round(validBalloonPct * 100),
    balloonAmount: Math.round(cmBalloonAmount * 100) / 100,
    corporateTaxRate: Math.round(validTaxRate * 100),
    // Chattel Mortgage Results
    cmUpfrontGST: Math.round(cmUpfrontGST * 100) / 100,
    cmMonthlyPayment: Math.round(cmMonthlyPayment * 100) / 100,
    cmTotalRepayments: Math.round(cmTotalRepayments * 100) / 100,
    cmTotalInterest: Math.round(cmTotalInterest * 100) / 100,
    cmTotalTaxDeductions: Math.round(cmTotalTaxDeductions * 100) / 100,
    cmTaxShield: Math.round(cmTaxShield * 100) / 100,
    cmNetLifetimeCost: Math.round(cmNetLifetimeCost * 100) / 100,
    // Finance Lease Results
    leaseMonthlyRentalExGST: Math.round(leaseMonthlyRentalExGST * 100) / 100,
    leaseMonthlyRentalIncGST: Math.round(leaseMonthlyRentalIncGST * 100) / 100,
    leaseResidualIncGST: Math.round(leaseResidualIncGST * 100) / 100,
    leaseTotalGSTClaimed: Math.round(leaseTotalGSTClaimed * 100) / 100,
    leaseTotalGrossOutflow: Math.round(leaseTotalGrossOutflow * 100) / 100,
    leaseTaxShield: Math.round(leaseTaxShield * 100) / 100,
    leaseNetLifetimeCost: Math.round(leaseNetLifetimeCost * 100) / 100,
    // Comparison
    netSavings: Math.round(Math.abs(netSavings) * 100) / 100,
    winner
  };
}
