// Canada Revenue Agency (CRA) 2026 Automobile Deduction Limits & Rates:
// - Class 10.1 (Gas/Hybrid Passenger Vehicle): $39,000 CCA ceiling before tax (increased from $38,000)
// - Class 54 (Zero-Emission Passenger Vehicle): $61,000 CCA ceiling before tax
// - Standard CCA Rate: 30% declining balance (Half-year rule applies in Year 1: 15%)
// - Monthly Lease Deduction Limit: $1,100/month before tax
// - Maximum Interest Deduction Limit: $350/month ($4,200/year)
// - 2026 Tax-Exempt Per-Kilometre Rates (Provinces): $0.73/km first 5,000 km, $0.67/km thereafter
// - 2026 Tax-Exempt Per-Kilometre Rates (Territories): $0.77/km first 5,000 km, $0.71/km thereafter
// - Operating Expense Benefit: $0.33/km of personal driving (if paid by corporation)
// - Standby Charge: 2% per month of original capital cost (or 2/3 of monthly lease payment)

export const CRA_2026_LIMITS = {
  class10_1_ceiling: 39000,
  class54_ceiling: 61000,
  leaseMonthlyCap: 1100,
  interestMonthlyCap: 350,
  perKmRateTier1: 0.73,
  perKmRateTier2: 0.67,
  operatingBenefitPerKm: 0.33,
  standbyMonthlyRateBuy: 0.02,
  standbyRateLease: 2 / 3
};

export function calcTaxFreeMileageReimbursement(businessKm, isTerritory = false) {
  const t1Rate = isTerritory ? 0.77 : 0.73;
  const t2Rate = isTerritory ? 0.71 : 0.67;
  if (businessKm <= 0 || isNaN(businessKm)) return 0;
  const tier1Km = Math.min(businessKm, 5000);
  const tier2Km = Math.max(0, businessKm - 5000);
  return (tier1Km * t1Rate) + (tier2Km * t2Rate);
}

export function calcCcaSchedule(costBeforeTax, isZev = false, years = 5) {
  const ceiling = isZev ? CRA_2026_LIMITS.class54_ceiling : CRA_2026_LIMITS.class10_1_ceiling;
  const startingUcc = Math.min(costBeforeTax, ceiling);
  let ucc = startingUcc;
  const schedule = [];

  for (let y = 1; y <= years; y++) {
    // Year 1 half-year rule: 15% (or 30% on half); subsequent years 30%
    const rate = y === 1 ? 0.15 : 0.30;
    const ccaDeduction = ucc * rate;
    ucc -= ccaDeduction;
    schedule.push({
      year: y,
      ccaClaimed: Math.round(ccaDeduction),
      endingUcc: Math.round(ucc)
    });
  }
  return { startingUcc, schedule };
}

export function calcVehicleBuyVsLease(inputs) {
  const {
    vehicleType = 'gas', // 'gas' or 'zev'
    purchasePrice = 58000,
    monthlyLeasePayment = 920,
    monthlyLoanPayment = 1150,
    monthlyInterestPortion = 280,
    annualBusinessKm = 18000,
    annualPersonalKm = 7000,
    annualOperatingCost = 4500, // fuel/energy, insurance, maintenance
    corporateTaxRate = 0.27,    // e.g. 12.2% small business or 27% general rate
    personalMarginalTaxRate = 0.43,
    isTerritory = false
  } = inputs;

  const totalAnnualKm = annualBusinessKm + annualPersonalKm;
  const businessUsePct = totalAnnualKm > 0 ? (annualBusinessKm / totalAnnualKm) : 0;
  const personalUsePct = 1 - businessUsePct;

  const isZev = vehicleType === 'zev';
  const ccaInfo = calcCcaSchedule(purchasePrice, isZev, 5);

  // Strategy A: Corporate Buy
  // 5-Year Corporate Deductions:
  // 1) Total CCA over 5 years * businessUsePct (Class 10.1 restricts CCA on sale/disposition, no terminal loss)
  // 2) Eligible Interest deduction (capped at $350/mo = $4,200/yr) * businessUsePct * 5 yrs
  // 3) Operating expenses * businessUsePct * 5 yrs
  const total5YrCca = ccaInfo.schedule.reduce((acc, curr) => acc + curr.ccaClaimed, 0);
  const annualEligibleInterest = Math.min(monthlyInterestPortion, CRA_2026_LIMITS.interestMonthlyCap) * 12;
  const total5YrInterest = annualEligibleInterest * 5;
  const total5YrOperating = annualOperatingCost * 5;

  const corpBuyDeductions = (total5YrCca * businessUsePct) +
                            (total5YrInterest * businessUsePct) +
                            (total5YrOperating * businessUsePct);
  const corpBuyTaxSavings = corpBuyDeductions * corporateTaxRate;

  // Personal Taxable Benefits on Corporate Buy:
  // Standby Charge: 2% of original vehicle cost per month * 12 * min(1, personalKm / 20000)
  // Operating Benefit: $0.33 * personalKm * 5 yrs
  const standbyBuyAnnual = (purchasePrice * CRA_2026_LIMITS.standbyMonthlyRateBuy * 12) * Math.min(1, annualPersonalKm / 20000);
  const operatingBenefitAnnual = annualPersonalKm * CRA_2026_LIMITS.operatingBenefitPerKm;
  const total5YrTaxableBenefitBuy = (standbyBuyAnnual + operatingBenefitAnnual) * 5;
  const total5YrPersonalTaxPaidBuy = total5YrTaxableBenefitBuy * personalMarginalTaxRate;
  const netFamilyBenefitBuy = corpBuyTaxSavings - total5YrPersonalTaxPaidBuy;

  // Strategy B: Corporate Lease
  // Deductible lease payment: lesser of actual monthly lease or $1,100 cap
  // Luxury lease proration: max deductible = min(actual, $1,100) * min(1.0, 39,000 / (0.85 * purchasePrice))
  const allowableCeiling = isZev ? CRA_2026_LIMITS.class54_ceiling : CRA_2026_LIMITS.class10_1_ceiling;
  const luxuryFactor = purchasePrice > allowableCeiling ? Math.min(1.0, allowableCeiling / (0.85 * purchasePrice)) : 1.0;
  const eligibleMonthlyLease = Math.min(monthlyLeasePayment, CRA_2026_LIMITS.leaseMonthlyCap) * luxuryFactor;
  const annualEligibleLease = eligibleMonthlyLease * 12;

  const corpLeaseDeductions = (annualEligibleLease * 5 * businessUsePct) + (total5YrOperating * businessUsePct);
  const corpLeaseTaxSavings = corpLeaseDeductions * corporateTaxRate;

  // Standby Charge on Lease: 2/3 of actual monthly lease * 12 * min(1, personalKm / 20000)
  const standbyLeaseAnnual = (monthlyLeasePayment * 12 * CRA_2026_LIMITS.standbyRateLease) * Math.min(1, annualPersonalKm / 20000);
  const total5YrTaxableBenefitLease = (standbyLeaseAnnual + operatingBenefitAnnual) * 5;
  const total5YrPersonalTaxPaidLease = total5YrTaxableBenefitLease * personalMarginalTaxRate;
  const netFamilyBenefitLease = corpLeaseTaxSavings - total5YrPersonalTaxPaidLease;

  // Strategy C: Personal Ownership + CRA Tax-Free Per-Km Reimbursement
  // Corp pays employee/shareholder tax-free mileage: $0.73/km first 5,000 km, $0.67/km beyond
  // Corp gets 100% tax deduction on the reimbursement!
  // Employee pays 0% tax (100% tax-free cash extraction into personal hands, 0 standby charge, 0 operating benefit!)
  const annualTaxFreeMileage = calcTaxFreeMileageReimbursement(annualBusinessKm, isTerritory);
  const total5YrMileageReimbursement = annualTaxFreeMileage * 5;
  const corpMileageTaxSavings = total5YrMileageReimbursement * corporateTaxRate;
  // Total net family cash value = Tax-free cash extracted + Corp tax savings
  const netFamilyBenefitMileage = total5YrMileageReimbursement + corpMileageTaxSavings;

  return {
    summary: {
      vehicleType,
      purchasePrice,
      businessUsePct: Math.round(businessUsePct * 100),
      personalUsePct: Math.round(personalUsePct * 100),
      corpBuyTaxSavings: Math.round(corpBuyTaxSavings),
      personalTaxPaidBuy: Math.round(total5YrPersonalTaxPaidBuy),
      netFamilyBenefitBuy: Math.round(netFamilyBenefitBuy),

      corpLeaseTaxSavings: Math.round(corpLeaseTaxSavings),
      personalTaxPaidLease: Math.round(total5YrPersonalTaxPaidLease),
      netFamilyBenefitLease: Math.round(netFamilyBenefitLease),

      annualMileageReimbursement: Math.round(annualTaxFreeMileage),
      total5YrMileageReimbursement: Math.round(total5YrMileageReimbursement),
      corpMileageTaxSavings: Math.round(corpMileageTaxSavings),
      netFamilyBenefitMileage: Math.round(netFamilyBenefitMileage)
    },
    ccaSchedule: ccaInfo.schedule,
    allowableCeiling
  };
}
