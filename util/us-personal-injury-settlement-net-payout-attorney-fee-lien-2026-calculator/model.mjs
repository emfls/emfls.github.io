// 2026 US Personal Injury Settlement Distribution & IRS 26 U.S. Code § 104(a)(2) Statutory Tax Exclusion
export const DEFAULT_ATTORNEY_FEE_PRE_SUIT = 33.33; // 33.33% (1/3rd) standard pre-litigation contingency fee
export const DEFAULT_ATTORNEY_FEE_LITIGATION = 40.0; // 40.0% standard trial/litigation contingency fee
export const DEFAULT_LIEN_REDUCTION_RATE = 25.0; // Typical negotiated health insurance / Medicare subrogation discount

export function calcPersonalInjurySettlement(inputs = {}) {
  const {
    medicalBills = 45000,
    lostWages = 18000,
    futureCare = 15000,
    painSufferingMultiplier = 2.5, // 1.5x to 5.0x of economic damages
    punitiveDamages = 0,
    attorneyFeePercent = DEFAULT_ATTORNEY_FEE_PRE_SUIT,
    caseExpenses = 3500,
    rawMedicalLiens = 32000,
    lienReductionPercent = DEFAULT_LIEN_REDUCTION_RATE,
    marginalTaxRate = 28 // federal + state tax on punitive/interest only
  } = inputs;

  const validMedBills = Math.max(0, Number(medicalBills) || 0);
  const validLostWages = Math.max(0, Number(lostWages) || 0);
  const validFutureCare = Math.max(0, Number(futureCare) || 0);
  const validMultiplier = Math.max(1.0, Math.min(10.0, Number(painSufferingMultiplier) || 2.5));
  const validPunitive = Math.max(0, Number(punitiveDamages) || 0);

  // 1. Economic Damages
  const totalEconomicDamages = validMedBills + validLostWages + validFutureCare;

  // 2. Non-Economic Damages (Pain & Suffering)
  const painAndSuffering = totalEconomicDamages * validMultiplier;

  // 3. Gross Settlement Amount
  const grossSettlement = totalEconomicDamages + painAndSuffering + validPunitive;

  // 4. Attorney Contingency Fee
  const validFeePct = Math.max(0, Math.min(50, Number(attorneyFeePercent) || DEFAULT_ATTORNEY_FEE_PRE_SUIT)) / 100;
  const attorneyFeeAmount = grossSettlement * validFeePct;

  // 5. Case Litigation Expenses
  const validExpenses = Math.max(0, Number(caseExpenses) || 0);

  // 6. Medical Liens & Subrogation (Health Insurer, Medicare, Hospital)
  const validRawLiens = Math.max(0, Number(rawMedicalLiens) || 0);
  const validLienRedPct = Math.max(0, Math.min(80, Number(lienReductionPercent) || 0)) / 100;
  const lienSavings = validRawLiens * validLienRedPct;
  const finalMedicalLiensPaid = validRawLiens - lienSavings;

  // 7. Taxes under IRS 26 U.S. Code § 104(a)(2)
  // Physical injury compensatory damages are 100% EXEMPT from federal & state income tax!
  // Punitive damages and pre-judgment interest are FULLY TAXABLE as ordinary income.
  const validTaxRate = Math.max(0, Math.min(55, Number(marginalTaxRate) || 0)) / 100;
  const taxablePortion = validPunitive;
  const taxLiability = taxablePortion * validTaxRate;
  const taxFreeCompensatory = grossSettlement - taxablePortion;

  // 8. Net Take-Home Settlement for Claimant
  const totalDeductions = attorneyFeeAmount + validExpenses + finalMedicalLiensPaid + taxLiability;
  const netTakeHome = Math.max(0, grossSettlement - totalDeductions);
  const netTakeHomePercent = grossSettlement > 0 ? (netTakeHome / grossSettlement) * 100 : 0;

  return {
    totalEconomicDamages: Math.round(totalEconomicDamages * 100) / 100,
    painAndSuffering: Math.round(painAndSuffering * 100) / 100,
    punitiveDamages: Math.round(validPunitive * 100) / 100,
    grossSettlement: Math.round(grossSettlement * 100) / 100,
    attorneyFeePercent: Math.round(validFeePct * 10000) / 100,
    attorneyFeeAmount: Math.round(attorneyFeeAmount * 100) / 100,
    caseExpenses: Math.round(validExpenses * 100) / 100,
    rawMedicalLiens: Math.round(validRawLiens * 100) / 100,
    lienSavings: Math.round(lienSavings * 100) / 100,
    finalMedicalLiensPaid: Math.round(finalMedicalLiensPaid * 100) / 100,
    taxFreeCompensatory: Math.round(taxFreeCompensatory * 100) / 100,
    taxablePortion: Math.round(taxablePortion * 100) / 100,
    taxLiability: Math.round(taxLiability * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netTakeHome: Math.round(netTakeHome * 100) / 100,
    netTakeHomePercent: Math.round(netTakeHomePercent * 100) / 100
  };
}
