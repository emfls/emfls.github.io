// 2026–27 Australia ATO Division 152 Small Business Capital Gains Tax (CGT) Concessions Model
export const ATO_MNAV_LIMIT = 6000000; // $6,000,000 Maximum Net Asset Value threshold
export const ATO_TURNOVER_LIMIT = 2000000; // $2,000,000 Small Business Entity turnover threshold
export const ATO_LIFETIME_RETIREMENT_CAP = 500000; // $500,000 Lifetime Retirement Exemption per individual
export const ATO_CGT_SUPER_CAP_2026_27 = 1935000; // 2026–27 Lifetime CGT Superannuation Cap

export function calcAtoSmallBizCgt(inputs = {}) {
  const {
    capitalGain = 800000, // Gross capital gain on business asset
    entityType = 'individual', // 'individual', 'trust', or 'company'
    heldOver12Months = true, // Eligible for 50% general discount (individuals/trusts only)
    netAssetValue = 3500000, // Total net market value of assets (taxpayer + affiliates + connected entities)
    annualTurnover = 1200000, // Aggregated annual turnover
    yearsOwned = 16, // Continuous ownership period
    taxpayerAge = 58, // Age of significant individual
    isRetiringOrIncapacitated = true, // Retiring in connection with disposal or permanently incapacitated
    applyActiveAssetReduction = true, // Apply 50% active asset reduction (Subdiv 152-C)
    lifetimeRetirementUsed = 100000, // Amount of $500k lifetime retirement cap previously utilized
    marginalTaxRate = 45 // 45% (top individual rate + Medicare) or 30% / 25% (company)
  } = inputs;

  const validGain = Math.max(0, Number(capitalGain) || 0);
  const validMNAV = Math.max(0, Number(netAssetValue) || 0);
  const validTurnover = Math.max(0, Number(annualTurnover) || 0);
  const age = Math.max(18, Math.min(100, Number(taxpayerAge) || 58));
  const validYears = Math.max(0, Number(yearsOwned) || 0);
  const prevUsedCap = Math.max(0, Math.min(ATO_LIFETIME_RETIREMENT_CAP, Number(lifetimeRetirementUsed) || 0));
  const availableRetirementCap = Math.max(0, ATO_LIFETIME_RETIREMENT_CAP - prevUsedCap);
  const taxRate = Math.max(0, Math.min(50, Number(marginalTaxRate) || 45)) / 100;

  // 1. Gateway Eligibility Check (Div 152-A)
  // Must satisfy either: Turnover < $2M OR MNAV <= $6M
  const passesTurnoverTest = validTurnover < ATO_TURNOVER_LIMIT;
  const passesMNAVTest = validMNAV <= ATO_MNAV_LIMIT;
  const isEligibleForConcessions = passesTurnoverTest || passesMNAVTest;

  if (!isEligibleForConcessions) {
    // Ineligible: full standard CGT applies
    const standardDiscount = (entityType !== 'company' && heldOver12Months) ? 0.5 : 0;
    const taxableGain = validGain * (1 - standardDiscount);
    const taxPayable = taxableGain * taxRate;
    return {
      isEligible: false,
      ineligibilityReason: 'Failed both the $2M Turnover test and $6M Maximum Net Asset Value test.',
      grossGain: validGain,
      netTaxableGain: Math.round(taxableGain * 100) / 100,
      taxPayable: Math.round(taxPayable * 100) / 100,
      taxSaved: 0,
      fifteenYearExemptionApplied: false,
      generalDiscountApplied: standardDiscount > 0,
      activeAssetReductionApplied: false,
      retirementExemptionAmount: 0,
      superContributionMandatory: false
    };
  }

  // 2. Step 1: 15-Year Exemption (Subdiv 152-B)
  // 100% tax-free if held >= 15 years and age >= 55 retiring
  const qualifies15Year = validYears >= 15 && age >= 55 && isRetiringOrIncapacitated;
  if (qualifies15Year) {
    return {
      isEligible: true,
      concessionStep: '15_YEAR_EXEMPTION',
      grossGain: validGain,
      fifteenYearExemptionApplied: true,
      generalDiscountApplied: false,
      activeAssetReductionApplied: false,
      retirementExemptionAmount: 0,
      superContributionMandatory: false,
      netTaxableGain: 0,
      taxPayable: 0,
      taxSaved: Math.round(validGain * taxRate * 100) / 100,
      effectiveTaxRate: 0
    };
  }

  // 3. Step 2: 50% General CGT Discount (Div 115)
  // Individuals and trusts held >12 months get 50% discount. Companies do NOT.
  let runningGain = validGain;
  let generalDiscountAmount = 0;
  if (entityType !== 'company' && heldOver12Months) {
    generalDiscountAmount = runningGain * 0.5;
    runningGain -= generalDiscountAmount;
  }

  // 4. Step 3: 50% Small Business Active Asset Reduction (Subdiv 152-C)
  let activeAssetReductionAmount = 0;
  if (applyActiveAssetReduction) {
    activeAssetReductionAmount = runningGain * 0.5;
    runningGain -= activeAssetReductionAmount;
  }

  // 5. Step 4: $500,000 Lifetime Retirement Exemption (Subdiv 152-D)
  // Applied to shelter remaining gain up to available cap
  const retirementExemptionAmount = Math.min(runningGain, availableRetirementCap);
  runningGain -= retirementExemptionAmount;

  // Age rule for retirement exemption: If under 55, MUST pay into super fund!
  const superContributionMandatory = (retirementExemptionAmount > 0 && age < 55);

  const netTaxableGain = Math.max(0, runningGain);
  const taxPayable = netTaxableGain * taxRate;
  const fullNominalTax = validGain * taxRate;
  const taxSaved = Math.max(0, fullNominalTax - taxPayable);
  const effectiveTaxRate = validGain > 0 ? (taxPayable / validGain) * 100 : 0;

  return {
    isEligible: true,
    grossGain: validGain,
    fifteenYearExemptionApplied: false,
    generalDiscountApplied: generalDiscountAmount > 0,
    generalDiscountAmount: Math.round(generalDiscountAmount * 100) / 100,
    activeAssetReductionApplied: activeAssetReductionAmount > 0,
    activeAssetReductionAmount: Math.round(activeAssetReductionAmount * 100) / 100,
    retirementExemptionAmount: Math.round(retirementExemptionAmount * 100) / 100,
    superContributionMandatory,
    remainingRetirementCap: Math.round((availableRetirementCap - retirementExemptionAmount) * 100) / 100,
    netTaxableGain: Math.round(netTaxableGain * 100) / 100,
    taxPayable: Math.round(taxPayable * 100) / 100,
    taxSaved: Math.round(taxSaved * 100) / 100,
    effectiveTaxRate: Math.round(effectiveTaxRate * 10) / 10
  };
}
