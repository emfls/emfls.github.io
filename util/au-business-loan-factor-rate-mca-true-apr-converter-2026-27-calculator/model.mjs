/**
 * Tool 491: 2026–27 Australia Factor Rate & MCA True APR Converter
 * Pure deterministic ESM module.
 */

export const DEFAULT_PRINCIPAL = 100000;
export const DEFAULT_FACTOR_RATE = 1.25;
export const DEFAULT_TERM_MONTHS = 12;
export const DEFAULT_FEE_PERCENT = 3.0;
export const DEFAULT_BANK_RATE = 9.25; // 2026 Australian Major Bank commercial rate benchmark

/**
 * Deterministic Newton-Raphson IRR solver for periodic payment streams
 * Solves: 0 = -netDisbursed + sum_{t=1}^N (payment / (1 + r)^t)
 * @param {number} netDisbursed Actual cash received after upfront fees
 * @param {number} periodicPayment Payment per period
 * @param {number} periods Total number of payments
 * @returns {number} Periodic interest rate (r)
 */
export function solvePeriodicIrr(netDisbursed, periodicPayment, periods) {
  if (netDisbursed <= 0 || periodicPayment <= 0 || periods <= 0) return 0;

  // Simple initial guess based on average capital balance
  const totalPaid = periodicPayment * periods;
  const totalInterest = totalPaid - netDisbursed;
  if (totalInterest <= 0) return 0;

  let r = (totalInterest / (netDisbursed * 0.55)) / periods;
  r = Math.max(0.0001, Math.min(0.5, r));

  const maxIter = 50;
  const tol = 1e-9;

  for (let iter = 0; iter < maxIter; iter++) {
    let npv = -netDisbursed;
    let dnpv = 0;

    for (let t = 1; t <= periods; t++) {
      const discount = Math.pow(1 + r, t);
      npv += periodicPayment / discount;
      dnpv -= (t * periodicPayment) / (discount * (1 + r));
    }

    if (Math.abs(npv) < tol) {
      break;
    }

    if (dnpv === 0) break;
    const nextR = r - npv / dnpv;
    if (nextR <= -0.99) {
      r = r / 2;
    } else {
      r = nextR;
    }
  }

  return Math.max(0, r);
}

/**
 * Calculates complete factor rate to True APR conversion metrics
 */
export function calcFactorRateToApr(params) {
  const principal = Math.max(1000, Number(params.principal ?? 100000));
  const factorRate = Math.max(1.01, Math.min(2.0, Number(params.factorRate ?? 1.25)));
  const termMonths = Math.max(1, Math.min(36, Number(params.termMonths ?? 12)));
  const originationFeePercent = Math.max(0, Math.min(15, Number(params.originationFeePercent ?? 3.0)));
  const deductFeeUpfront = params.deductFeeUpfront !== false;
  const frequency = String(params.frequency ?? 'weekly').toLowerCase();

  const totalRepayment = Math.round(principal * factorRate);
  const fixedFinanceCharge = totalRepayment - principal;
  const originationFee = Math.round(principal * (originationFeePercent / 100));

  let netDisbursed = principal;
  if (deductFeeUpfront) {
    netDisbursed = principal - originationFee;
  }

  let periodsPerYear = 52;
  let totalPeriods = Math.round((termMonths / 12) * 52);

  if (frequency === 'daily') {
    periodsPerYear = 260; // 5 business days x 52 weeks
    totalPeriods = Math.round((termMonths / 12) * 260);
  } else if (frequency === 'monthly') {
    periodsPerYear = 12;
    totalPeriods = termMonths;
  }

  const periodicPayment = totalPeriods > 0 ? totalRepayment / totalPeriods : 0;
  const periodicIrr = solvePeriodicIrr(netDisbursed, periodicPayment, totalPeriods);

  // Annualized Nominal APR (Simple)
  const nominalApr = periodicIrr * periodsPerYear * 100;

  // Annualized Effective Compounded APR (EAR / APY)
  const effectiveApr = (Math.pow(1 + periodicIrr, periodsPerYear) - 1) * 100;

  // Comparison with Australian Bank Commercial Loan (Reducing Balance)
  const bankRate = Math.max(0, Number(params.bankRate ?? 9.25));
  // Standard amortizing loan monthly payment
  const bankMonthlyRate = bankRate / 100 / 12;
  let bankMonthlyPayment = 0;
  if (bankMonthlyRate > 0) {
    bankMonthlyPayment = principal * (bankMonthlyRate * Math.pow(1 + bankMonthlyRate, termMonths)) / (Math.pow(1 + bankMonthlyRate, termMonths) - 1);
  } else {
    bankMonthlyPayment = principal / termMonths;
  }
  const bankTotalRepayment = Math.round(bankMonthlyPayment * termMonths);
  const bankTotalInterest = bankTotalRepayment - principal;

  const totalMcaCost = fixedFinanceCharge + originationFee;
  const potentialSavingsWithBank = totalMcaCost - bankTotalInterest;

  return {
    principal,
    factorRate,
    termMonths,
    frequency,
    totalRepayment,
    fixedFinanceCharge,
    originationFee,
    netDisbursed,
    totalPeriods,
    periodicPayment: Math.round(periodicPayment * 100) / 100,
    nominalApr: Math.round(nominalApr * 10) / 10,
    effectiveApr: Math.round(effectiveApr * 10) / 10,
    bankTotalInterest,
    potentialSavingsWithBank: Math.max(0, potentialSavingsWithBank),
    effectiveRateMultipleVsBank: bankRate > 0 ? Math.round((effectiveApr / bankRate) * 10) / 10 : 0
  };
}
