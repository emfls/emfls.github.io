// 2026 Canada Commercial Equipment Lease vs Buy & CRA Capital Cost Allowance (CCA) Tax Shield Model
export const CCA_RATES = {
  class8: 0.20, // 20% - Office equipment, machinery, tools costing $500+
  class10: 0.30, // 30% - Motor vehicles, general contractor equipment
  class50: 0.55  // 55% - Computer systems, data servers & system software
};

export function calcLeaseVsBuyCanada(inputs = {}) {
  const {
    equipmentCost = 120000,
    ccaClass = 'class8',
    acceleratedIncentive = true, // CRA Accelerated Investment Incentive (1.5x in Year 1)
    usefulLifeYears = 5,
    salvageValue = 15000,
    loanInterestRate = 6.5,
    downPaymentPercent = 10,
    monthlyLeasePayment = 2450,
    leaseBuyoutResidual = 10000,
    corporateTaxRate = 12.2, // 12.2% (Ontario Small Business Rate) or 26.5% (General Corporate)
    discountRate = 7.0 // Cost of capital / WACC
  } = inputs;

  const validCost = Math.max(1000, Number(equipmentCost) || 120000);
  const baseCCARate = CCA_RATES[ccaClass] || 0.20;
  const years = Math.max(2, Math.min(10, Math.round(Number(usefulLifeYears) || 5)));
  const validSalvage = Math.max(0, Number(salvageValue) || 0);
  const loanRate = Math.max(0.1, Math.min(25, Number(loanInterestRate) || 6.5)) / 100;
  const downPayPct = Math.max(0, Math.min(50, Number(downPaymentPercent) || 10)) / 100;
  const leasePmt = Math.max(100, Number(monthlyLeasePayment) || 2450);
  const leaseBuyout = Math.max(0, Number(leaseBuyoutResidual) || 0);
  const taxRate = Math.max(0, Math.min(50, Number(corporateTaxRate) || 12.2)) / 100;
  const discRate = Math.max(0.1, Math.min(25, Number(discountRate) || 7.0)) / 100;

  // --- 1. BUY SCENARIO (LOAN + CCA TAX SHIELD) ---
  const downPayment = validCost * downPayPct;
  const loanPrincipal = validCost - downPayment;

  // Annual loan payment amortized over term
  const loanFactor = loanPrincipal > 0 ? (loanRate / (1 - Math.pow(1 + loanRate, -years))) : 0;
  const annualLoanPayment = loanPrincipal * loanFactor;

  let ucc = validCost;
  let totalCCAClaimed = 0;
  let totalCCATaxShield = 0;
  let totalLoanInterest = 0;
  let totalInterestTaxShield = 0;
  let buyNPV = downPayment; // Initial outflow at t=0

  let currentPrincipal = loanPrincipal;

  for (let yr = 1; yr <= years; yr++) {
    // Interest portion of loan
    const interest = currentPrincipal * loanRate;
    const principalPaid = annualLoanPayment - interest;
    currentPrincipal = Math.max(0, currentPrincipal - principalPaid);
    totalLoanInterest += interest;
    const interestShield = interest * taxRate;
    totalInterestTaxShield += interestShield;

    // CRA CCA Calculation
    let yearCCARate = baseCCARate;
    if (yr === 1 && acceleratedIncentive) {
      yearCCARate = Math.min(1.0, baseCCARate * 1.5); // AII 150% rule
    } else if (yr === 1 && !acceleratedIncentive) {
      yearCCARate = baseCCARate * 0.5; // Traditional half-year rule
    }

    const yearCCA = ucc * yearCCARate;
    ucc -= yearCCA;
    totalCCAClaimed += yearCCA;
    const yearCCAShield = yearCCA * taxRate;
    totalCCATaxShield += yearCCAShield;

    // Net After-tax cash outflow for year yr
    let netAnnualOutflow = annualLoanPayment - interestShield - yearCCAShield;

    // Terminal year salvage recovery (taxed as CCA recapture if exceeds UCC, simplified to after-tax salvage)
    if (yr === years) {
      netAnnualOutflow -= validSalvage;
    }

    // Discounted to PV
    const pvFactor = Math.pow(1 + discRate, -yr);
    buyNPV += netAnnualOutflow * pvFactor;
  }

  const buyTotalGrossOutflow = downPayment + (annualLoanPayment * years) - validSalvage;
  const buyTotalTaxShield = totalCCATaxShield + totalInterestTaxShield;
  const buyNetNominalCost = buyTotalGrossOutflow - buyTotalTaxShield;

  // --- 2. LEASE SCENARIO (OPERATING LEASE EXPENSE TAX SHIELD) ---
  const annualLeaseCost = leasePmt * 12;
  let leaseNPV = 0;
  let totalLeaseDeductions = 0;
  let totalLeaseTaxShield = 0;

  for (let yr = 1; yr <= years; yr++) {
    const annualDeduction = annualLeaseCost;
    totalLeaseDeductions += annualDeduction;
    const yearLeaseShield = annualDeduction * taxRate;
    totalLeaseTaxShield += yearLeaseShield;

    let netLeaseOutflow = annualLeaseCost - yearLeaseShield;

    // Add optional buyout at the end of term
    if (yr === years) {
      netLeaseOutflow += leaseBuyout;
    }

    const pvFactor = Math.pow(1 + discRate, -yr);
    leaseNPV += netLeaseOutflow * pvFactor;
  }

  const leaseTotalGrossOutflow = (annualLeaseCost * years) + leaseBuyout;
  const leaseNetNominalCost = leaseTotalGrossOutflow - totalLeaseTaxShield;

  // NPV Winner Decision: Lower NPV cost is superior
  const npvDifference = leaseNPV - buyNPV;
  const winner = npvDifference >= 0 ? 'BUY' : 'LEASE';
  const npvSavings = Math.abs(npvDifference);

  return {
    equipmentCost: Math.round(validCost * 100) / 100,
    ccaClass,
    acceleratedIncentive,
    years,
    corporateTaxRate: Math.round(taxRate * 1000) / 10,
    discountRate: Math.round(discRate * 1000) / 10,
    // Buy Scenario
    downPayment: Math.round(downPayment * 100) / 100,
    annualLoanPayment: Math.round(annualLoanPayment * 100) / 100,
    totalLoanInterest: Math.round(totalLoanInterest * 100) / 100,
    totalCCAClaimed: Math.round(totalCCAClaimed * 100) / 100,
    buyTotalTaxShield: Math.round(buyTotalTaxShield * 100) / 100,
    buyTotalGrossOutflow: Math.round(buyTotalGrossOutflow * 100) / 100,
    buyNetNominalCost: Math.round(buyNetNominalCost * 100) / 100,
    buyNPV: Math.round(buyNPV * 100) / 100,
    // Lease Scenario
    annualLeaseCost: Math.round(annualLeaseCost * 100) / 100,
    totalLeaseDeductions: Math.round(totalLeaseDeductions * 100) / 100,
    totalLeaseTaxShield: Math.round(totalLeaseTaxShield * 100) / 100,
    leaseTotalGrossOutflow: Math.round(leaseTotalGrossOutflow * 100) / 100,
    leaseNetNominalCost: Math.round(leaseNetNominalCost * 100) / 100,
    leaseNPV: Math.round(leaseNPV * 100) / 100,
    // Decision
    winner,
    npvSavings: Math.round(npvSavings * 100) / 100
  };
}
