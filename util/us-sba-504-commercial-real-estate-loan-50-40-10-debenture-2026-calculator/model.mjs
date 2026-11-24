/**
 * Tool 485: 2026 US SBA 504 Commercial Real Estate Loan Calculator
 * Pure deterministic ESM module.
 */

export const STANDARD_CDC_CAP = 5000000;      // $5M standard SBA 504 debenture cap
export const MFG_GREEN_CDC_CAP = 5500000;     // $5.5M for small manufacturers & green energy projects
export const FINANCED_CDC_FEE_RATE = 0.0265;  // ~2.65% total financed CDC/SBA fees (0.5% guaranty, 1.5% CDC processing, underwriting/closing)
export const DEFAULT_CONVENTIONAL_DOWN = 0.25; // 25% typical conventional commercial mortgage down payment

/**
 * Calculates monthly P&I payment
 */
export function calcMonthlyPi(principal, annualRate, termYears) {
  if (principal <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 12;
  const n = Math.max(1, termYears * 12);
  const pmt = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(pmt);
}

/**
 * Full SBA 504 Loan Structure Calculation
 */
export function calcSba504Loan(params) {
  const projectCost = Math.max(0, Number(params.projectCost) || 0);
  const isStartup = Boolean(params.isStartup); // Business < 2 years (+5% equity)
  const isSpecialPurpose = Boolean(params.isSpecialPurpose); // Hotel, car wash, gas station (+5% equity)
  const isManufacturingOrGreen = Boolean(params.isManufacturingOrGreen); // $5.5M CDC cap

  const bankRate = Math.max(0.01, Number(params.bankRate) || 0.070); // e.g. 7.0%
  const bankTermYears = Number(params.bankTermYears) || 25;

  const cdcRate = Math.max(0.01, Number(params.cdcRate) || 0.0635); // e.g. 6.35% effective rate
  const cdcTermYears = Number(params.cdcTermYears) || 25; // 10, 20, or 25 years

  // 1. Determine Equity Injection Tier
  // Standard: 10%
  // Startup (<2 yrs) OR Special-Purpose: 15%
  // BOTH Startup AND Special-Purpose: 20%
  let equityRate = 0.10;
  if (isStartup && isSpecialPurpose) {
    equityRate = 0.20;
  } else if (isStartup || isSpecialPurpose) {
    equityRate = 0.15;
  }

  const equityAmount = Math.round(projectCost * equityRate);

  // 2. Bank 1st Mortgage: Always 50% of Project Cost
  const bankLoanAmount = Math.round(projectCost * 0.50);

  // 3. SBA CDC 2nd Mortgage (Debenture):
  // Baseline debenture percentage = 1.0 - 0.50 - equityRate (40%, 35%, or 30%)
  const cdcRateShare = 1.0 - 0.50 - equityRate;
  let rawCdcAmount = Math.round(projectCost * cdcRateShare);

  const cdcCap = isManufacturingOrGreen ? MFG_GREEN_CDC_CAP : STANDARD_CDC_CAP;
  const isCapped = rawCdcAmount > cdcCap;
  const netCdcDebenture = Math.min(rawCdcAmount, cdcCap);

  // Financed fees added to CDC debenture
  const financedFees = Math.round(netCdcDebenture * FINANCED_CDC_FEE_RATE);
  const grossCdcDebenture = netCdcDebenture + financedFees;

  // 4. Monthly Payments & Debt Service
  const bankMonthlyPayment = calcMonthlyPi(bankLoanAmount, bankRate, bankTermYears);
  const cdcMonthlyPayment = calcMonthlyPi(grossCdcDebenture, cdcRate, cdcTermYears);
  const combinedMonthlyPayment = bankMonthlyPayment + cdcMonthlyPayment;
  const annualDebtService = combinedMonthlyPayment * 12;

  // 5. Blended Effective Interest Rate
  const totalLoanFinanced = bankLoanAmount + grossCdcDebenture;
  const blendedInterestRate = totalLoanFinanced > 0
    ? Math.round(((bankLoanAmount * bankRate + grossCdcDebenture * cdcRate) / totalLoanFinanced) * 10000) / 100
    : 0;

  // 6. Working Capital Preserved vs Conventional 25% Down Commercial Mortgage
  const conventionalDownPayment = Math.round(projectCost * DEFAULT_CONVENTIONAL_DOWN);
  const preservedWorkingCapital = Math.max(0, conventionalDownPayment - equityAmount);

  return {
    projectCost,
    isStartup,
    isSpecialPurpose,
    isManufacturingOrGreen,
    equityRate,
    equityAmount,
    bankLoanAmount,
    bankRate,
    bankTermYears,
    bankMonthlyPayment,
    cdcRateShare,
    netCdcDebenture,
    financedFees,
    grossCdcDebenture,
    cdcRate,
    cdcTermYears,
    cdcMonthlyPayment,
    cdcCap,
    isCapped,
    totalLoanFinanced,
    combinedMonthlyPayment,
    annualDebtService,
    blendedInterestRate,
    conventionalDownPayment,
    preservedWorkingCapital
  };
}
