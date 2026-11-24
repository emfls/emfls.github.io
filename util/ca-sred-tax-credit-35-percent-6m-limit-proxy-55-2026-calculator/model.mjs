// 2026 Canada SR&ED Tax Credit Statutory Model (Bill C-15 Overhaul: $6M Limit & $15M–$75M Phase-Out)
export const SRED_2026_EXPENDITURE_LIMIT = 6000000; // $6,000,000 enhanced limit under Bill C-15
export const SRED_2026_CAPITAL_FLOOR = 15000000; // $15,000,000 taxable capital phase-out start
export const SRED_2026_CAPITAL_CEILING = 75000000; // $75,000,000 taxable capital phase-out complete
export const SRED_PRESCRIBED_PROXY_RATE = 0.55; // 55% Prescribed Proxy Amount (PPA) overhead on salaries
export const SRED_CONTRACTOR_RATE = 0.80; // 80% statutory eligibility for arm's-length Canadian subcontractors

export function calcCanadaSredCredit(inputs = {}) {
  const {
    directSalaries = 1200000, // Canadian R&D employee salaries
    useProxyMethod = true, // 55% Prescribed Proxy Amount (PPA)
    contractorCosts = 350000, // Canadian third-party R&D subcontractors
    materialsCosts = 150000, // Materials consumed or transformed in R&D
    overheadTraditional = 0, // Traditional overhead if not using proxy
    taxableCapital = 18000000, // Prior year taxable capital employed in Canada
    isCcpc = true, // Canadian-Controlled Private Corporation
    provincialJurisdiction = 'ontario' // 'ontario' (8%), 'quebec' (14%), 'bc' (10%), 'alberta' (8%), 'none' (0%)
  } = inputs;

  const validSalaries = Math.max(0, Number(directSalaries) || 0);
  const validContractors = Math.max(0, Number(contractorCosts) || 0);
  const validMaterials = Math.max(0, Number(materialsCosts) || 0);
  const validCapital = Math.max(0, Number(taxableCapital) || 0);

  // 1. Calculate Qualified SR&ED Expenditures Pool
  const proxyOverhead = useProxyMethod ? (validSalaries * SRED_PRESCRIBED_PROXY_RATE) : Math.max(0, Number(overheadTraditional) || 0);
  const eligibleContractors = validContractors * SRED_CONTRACTOR_RATE; // 80% rule
  const totalQualifiedExpenditures = validSalaries + proxyOverhead + eligibleContractors + validMaterials;

  // 2. Bill C-15 Expenditure Limit & Capital Phase-Out ($15M to $75M)
  let expenditureLimit2026 = 0;
  if (isCcpc) {
    if (validCapital <= SRED_2026_CAPITAL_FLOOR) {
      expenditureLimit2026 = SRED_2026_EXPENDITURE_LIMIT;
    } else if (validCapital >= SRED_2026_CAPITAL_CEILING) {
      expenditureLimit2026 = 0;
    } else {
      const capitalExcess = validCapital - SRED_2026_CAPITAL_FLOOR;
      const reductionRatio = capitalExcess / (SRED_2026_CAPITAL_CEILING - SRED_2026_CAPITAL_FLOOR);
      expenditureLimit2026 = SRED_2026_EXPENDITURE_LIMIT * (1 - reductionRatio);
    }
  }

  // 3. Federal SR&ED Investment Tax Credit (ITC)
  let federalRefundableExpenditures = 0;
  let federalBasicExpenditures = 0;

  if (isCcpc && expenditureLimit2026 > 0) {
    federalRefundableExpenditures = Math.min(totalQualifiedExpenditures, expenditureLimit2026);
    federalBasicExpenditures = Math.max(0, totalQualifiedExpenditures - expenditureLimit2026);
  } else {
    federalBasicExpenditures = totalQualifiedExpenditures;
  }

  // 35% enhanced refundable rate on limit; 15% non-refundable basic rate on excess
  const federalRefundableITC = federalRefundableExpenditures * 0.35;
  const federalBasicITC = federalBasicExpenditures * 0.15;
  const totalFederalITC = federalRefundableITC + federalBasicITC;

  // 4. Provincial R&D Tax Credit Top-Up
  let provRate = 0;
  if (provincialJurisdiction === 'ontario') provRate = 0.08; // 8% OITC
  else if (provincialJurisdiction === 'quebec') provRate = 0.14; // 14%
  else if (provincialJurisdiction === 'bc') provRate = 0.10; // 10%
  else if (provincialJurisdiction === 'alberta') provRate = 0.08; // 8%

  const provincialCredit = totalQualifiedExpenditures * provRate;
  const totalRndFunding = totalFederalITC + provincialCredit;

  // 5. Pre-2026 Comparison Benchmark ($3M Limit / $10M-$50M phase-out)
  let oldLimit = 0;
  if (isCcpc) {
    if (validCapital <= 10000000) oldLimit = 3000000;
    else if (validCapital >= 50000000) oldLimit = 0;
    else oldLimit = 3000000 * (1 - ((validCapital - 10000000) / 40000000));
  }
  const oldRefundableExp = Math.min(totalQualifiedExpenditures, oldLimit);
  const oldBasicExp = Math.max(0, totalQualifiedExpenditures - oldLimit);
  const oldFederalITC = (oldRefundableExp * 0.35) + (oldBasicExp * 0.15);
  const billC15Advantage = totalFederalITC - oldFederalITC;

  return {
    totalQualifiedExpenditures: Math.round(totalQualifiedExpenditures * 100) / 100,
    directSalaries: Math.round(validSalaries * 100) / 100,
    proxyOverhead: Math.round(proxyOverhead * 100) / 100,
    eligibleContractors: Math.round(eligibleContractors * 100) / 100,
    materialsCosts: Math.round(validMaterials * 100) / 100,
    isCcpc,
    taxableCapital: Math.round(validCapital * 100) / 100,
    expenditureLimit2026: Math.round(expenditureLimit2026 * 100) / 100,
    // Federal ITC
    federalRefundableITC: Math.round(federalRefundableITC * 100) / 100,
    federalBasicITC: Math.round(federalBasicITC * 100) / 100,
    totalFederalITC: Math.round(totalFederalITC * 100) / 100,
    // Provincial
    provincialJurisdiction,
    provincialCredit: Math.round(provincialCredit * 100) / 100,
    totalRndFunding: Math.round(totalRndFunding * 100) / 100,
    // Comparison
    oldFederalITC: Math.round(oldFederalITC * 100) / 100,
    billC15Advantage: Math.round(billC15Advantage * 100) / 100
  };
}
