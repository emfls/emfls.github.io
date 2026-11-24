/**
 * Tool 483: 2026-27 Australia Commercial Property Cap Rate & Valuation Calculator
 * Pure deterministic ESM module.
 */

export const DEFAULT_CAP_RATE = 0.0625; // 6.25% market average for Australian suburban office/industrial
export const DEFAULT_LENDER_DSCR_MIN = 1.35; // 1.35x standard commercial bank stress covenant floor (CBA/NAB/ANZ/Westpac)
export const DEFAULT_VACANCY_RATE = 0.03; // 3.0% structural vacancy

/**
 * Calculates Net Operating Income (NOI)
 */
export function calcCommercialNoi(params) {
  const passingGrossRent = Math.max(0, Number(params.passingGrossRent) || 0);
  const outgoings = Math.max(0, Number(params.outgoings) || 0);
  const rawRecovery = params.outgoingsRecoveryRate !== undefined ? Number(params.outgoingsRecoveryRate) : 1.0;
  const outgoingsRecoveryRate = Math.min(1, Math.max(0, isNaN(rawRecovery) ? 1.0 : rawRecovery)); // 1.0 = 100% net lease
  const rawVacancy = params.vacancyRate !== undefined ? Number(params.vacancyRate) : DEFAULT_VACANCY_RATE;
  const vacancyRate = Math.min(0.5, Math.max(0, isNaN(rawVacancy) ? DEFAULT_VACANCY_RATE : rawVacancy));

  const vacancyReserve = Math.round(passingGrossRent * vacancyRate);
  const recoveredOutgoings = Math.round(outgoings * outgoingsRecoveryRate);
  const nonRecoverableOutgoings = Math.max(0, outgoings - recoveredOutgoings);

  // In standard Australian commercial valuation:
  // Effective Gross Rent = Passing Rent - Vacancy Reserve
  // NOI = Effective Gross Rent - Non-recoverable Outgoings
  const effectiveGrossRent = Math.max(0, passingGrossRent - vacancyReserve);
  const noi = Math.max(0, effectiveGrossRent - nonRecoverableOutgoings);

  return {
    passingGrossRent,
    outgoings,
    outgoingsRecoveryRate,
    recoveredOutgoings,
    nonRecoverableOutgoings,
    vacancyReserve,
    effectiveGrossRent,
    noi
  };
}

/**
 * Calculates Commercial Loan Debt Service
 */
export function calcDebtService(loanAmount, interestRate, termYears = 25, isInterestOnly = false) {
  if (loanAmount <= 0 || interestRate <= 0) {
    return { annualDebtService: 0, monthlyDebtService: 0 };
  }
  if (isInterestOnly) {
    const annual = Math.round(loanAmount * interestRate);
    return { annualDebtService: annual, monthlyDebtService: Math.round(annual / 12) };
  }
  const monthlyRate = interestRate / 12;
  const numPayments = Math.max(1, termYears * 12);
  const monthly = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  const annual = Math.round(monthly * 12);
  return { annualDebtService: annual, monthlyDebtService: Math.round(monthly) };
}

/**
 * Full Commercial Property Valuation & Bank Covenants
 */
export function calcAuCommercialProperty(params) {
  const noiBreakdown = calcCommercialNoi(params);
  const noi = noiBreakdown.noi;
  const capRate = Math.max(0.01, Number(params.capRate) || DEFAULT_CAP_RATE);
  const lvr = Math.min(0.9, Math.max(0, Number(params.lvr) || 0.65)); // 65% standard commercial LVR
  const interestRate = Math.max(0.01, Number(params.interestRate) || 0.0675); // 6.75% commercial rate
  const loanTermYears = Number(params.loanTermYears) || 25;
  const isInterestOnly = Boolean(params.isInterestOnly);
  const lenderDscrMin = Number(params.lenderDscrMin) || DEFAULT_LENDER_DSCR_MIN;

  // 1. Valuation & Yields
  const impliedValuation = noi > 0 ? Math.round(noi / capRate) : 0;
  const netInitialYield = impliedValuation > 0 ? (noi / impliedValuation) * 100 : 0;
  const grossYield = impliedValuation > 0 ? (noiBreakdown.passingGrossRent / impliedValuation) * 100 : 0;

  // 2. Financing & Bank Underwriting
  const loanAmount = Math.round(impliedValuation * lvr);
  const equityRequired = Math.max(0, impliedValuation - loanAmount);

  const { annualDebtService, monthlyDebtService } = calcDebtService(loanAmount, interestRate, loanTermYears, isInterestOnly);

  // 3. DSCR / ICR (Debt Service Coverage Ratio)
  const dscr = annualDebtService > 0 ? Math.round((noi / annualDebtService) * 100) / 100 : (noi > 0 ? 99 : 0);
  const passesLenderDscr = dscr >= lenderDscrMin;

  // Maximum loan bank will lend based on DSCR covenant:
  // Max Annual Debt Service = NOI / lenderDscrMin
  let maxBorrowingCapacity = 0;
  if (noi > 0 && interestRate > 0) {
    const maxAllowedDebtService = noi / lenderDscrMin;
    if (isInterestOnly) {
      maxBorrowingCapacity = Math.round(maxAllowedDebtService / interestRate);
    } else {
      const monthlyRate = interestRate / 12;
      const numPayments = Math.max(1, loanTermYears * 12);
      const factor = (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
      const maxMonthlyAllowed = maxAllowedDebtService / 12;
      maxBorrowingCapacity = Math.round(maxMonthlyAllowed / factor);
    }
  }

  // 4. Cash Flows & Investor Return
  const netCashFlowAfterDebt = Math.round(noi - annualDebtService);
  const cashOnCashReturn = equityRequired > 0 ? Math.round((netCashFlowAfterDebt / equityRequired) * 10000) / 100 : 0;

  return {
    ...noiBreakdown,
    capRate,
    impliedValuation,
    netInitialYield: Math.round(netInitialYield * 100) / 100,
    grossYield: Math.round(grossYield * 100) / 100,
    lvr,
    loanAmount,
    equityRequired,
    interestRate,
    annualDebtService,
    monthlyDebtService,
    dscr,
    lenderDscrMin,
    passesLenderDscr,
    maxBorrowingCapacity,
    netCashFlowAfterDebt,
    cashOnCashReturn
  };
}
