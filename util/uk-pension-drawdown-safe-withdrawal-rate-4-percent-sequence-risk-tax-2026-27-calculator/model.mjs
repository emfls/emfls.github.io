export const PARAMETERS = Object.freeze({
  personalAllowance: 12570,
  basicRateLimit: 37700,
  higherRateThreshold: 50270,
  allowanceTaperStart: 100000,
  additionalRateThreshold: 125140,
  statePensionWeekly: 241.30,
  statePension: 12547.60,
  lumpSumAllowance: 268275,
  taxFreeShare: 0.25,
  horizon: 100,
});

export const STRATEGY = Object.freeze({
  PHASED: 'PHASED_UFPLS_25_TAXFREE',
  UPFRONT: 'UPFRONT_PCLS_THEN_TAXABLE',
});

const PENNY = 0.01;
const { statePension, lumpSumAllowance, taxFreeShare, horizon } = PARAMETERS;

export function incomeTax(grossTaxableIncome) {
  const { personalAllowance, basicRateLimit, allowanceTaperStart, additionalRateThreshold } = PARAMETERS;
  const allowance = Math.max(0, personalAllowance - Math.max(0, grossTaxableIncome - allowanceTaperStart) / 2);
  const taxable = Math.max(0, grossTaxableIncome - allowance);
  return 0.20 * Math.min(taxable, basicRateLimit)
    + 0.40 * Math.max(0, Math.min(taxable, additionalRateThreshold) - basicRateLimit)
    + 0.45 * Math.max(0, taxable - additionalRateThreshold);
}

export function grossWithdrawalForNet(netGap, otherTaxableIncome, remainingAllowance) {
  if (netGap <= 0) return 0;
  const existingTax = incomeTax(otherTaxableIncome);
  // Net proceeds increase monotonically. The allowance taper gives the
  // highest effective marginal rate (60%), so 2.5 times the gap is sufficient.
  let low = netGap;
  let high = netGap / 0.40;
  for (let step = 0; step < 40; step++) {
    const gross = (low + high) / 2;
    const taxFree = Math.min(gross * taxFreeShare, remainingAllowance);
    const extraTax = incomeTax(otherTaxableIncome + gross - taxFree) - existingTax;
    if (gross - extraTax < netGap) low = gross;
    else high = gross;
  }
  return high;
}

export function annualRealReturn(realReturn, yearIndex, stress) {
  if (!stress || yearIndex >= 5) return realReturn;
  if (yearIndex === 0) return -0.25;
  // Match the five-year compound return before any withdrawals.
  return ((1 + realReturn) ** 5 / 0.75) ** (1 / 4) - 1;
}

function validate({ startingPot, targetSpending, retirementAge, statePensionAge, realReturn, strategy }) {
  if (!Number.isFinite(startingPot) || startingPot < 0 || startingPot > 1e8) {
    throw new RangeError('Enter a starting SIPP pot between £0 and £100 million.');
  }
  if (!Number.isFinite(targetSpending) || targetSpending < 0 || targetSpending > 1e7) {
    throw new RangeError('Enter annual spending between £0 and £10 million.');
  }
  if (!Number.isInteger(retirementAge) || retirementAge < 55 || retirementAge > 66) {
    throw new RangeError('Enter a whole retirement age between 55 and 66.');
  }
  if (statePensionAge !== 66 && statePensionAge !== 67) {
    throw new RangeError('Choose State Pension age 66 or 67.');
  }
  if (!Number.isFinite(realReturn) || realReturn < -0.2 || realReturn > 0.2) {
    throw new RangeError('Enter a real investment return from −20% to 20%.');
  }
  if (strategy !== STRATEGY.PHASED && strategy !== STRATEGY.UPFRONT) {
    throw new RangeError('Choose a drawdown strategy.');
  }
}

function runProjection(inputs, stress, postPensionSpending = inputs.targetSpending) {
  const { startingPot, retirementAge, statePensionAge, couple, realReturn, strategy } = inputs;
  const phased = strategy === STRATEGY.PHASED;
  const initialCash = phased ? 0 : Math.min(startingPot * taxFreeShare, lumpSumAllowance);
  let cash = initialCash;
  let pot = startingPot - initialCash;
  let remainingAllowance = phased ? lumpSumAllowance : 0;
  let estateAt90 = 0;
  let totalTax = 0;
  let depletionAge = null;
  let sippDepletionAge = null;
  let firstShortfallAge = null;
  const rows = [];

  for (let age = retirementAge; age < horizon; age++) {
    const afterPension = age >= statePensionAge;
    const ownerPension = afterPension ? statePension : 0;
    const partnerPension = couple ? ownerPension : 0;
    const statePensionIncome = ownerPension + partnerPension;
    const target = afterPension ? postPensionSpending : inputs.targetSpending;
    const statePensionNet = statePensionIncome - incomeTax(ownerPension) - incomeTax(partnerPension);
    const netGapBeforeSipp = Math.max(0, target - statePensionNet);
    const cashUsed = Math.min(cash, netGapBeforeSipp);
    const requiredPension = grossWithdrawalForNet(netGapBeforeSipp - cashUsed, ownerPension, remainingAllowance);
    const pensionWithdrawal = Math.min(pot, requiredPension);
    const taxFree = Math.min(remainingAllowance, pensionWithdrawal * taxFreeShare);
    const tax = incomeTax(ownerPension + pensionWithdrawal - taxFree) + incomeTax(partnerPension);
    const netIncome = statePensionIncome + cashUsed + pensionWithdrawal - tax;
    const shortfall = Math.max(0, target - netIncome);

    cash -= cashUsed;
    remainingAllowance -= taxFree;
    const yearReturn = annualRealReturn(realReturn, age - retirementAge, stress);
    pot = (pot - pensionWithdrawal) * (1 + yearReturn);
    const portfolioEnd = pot + cash;
    if (portfolioEnd < PENNY) depletionAge ??= age;
    if (pot < PENNY) sippDepletionAge ??= age;
    if (shortfall >= PENNY) firstShortfallAge ??= age;
    if (age === 89) estateAt90 = portfolioEnd;
    totalTax += tax;
    rows.push({
      age, statePension: statePensionIncome, netGapBeforeSipp, cashUsed, requiredPension,
      pensionWithdrawal, taxFree, tax, netIncome, shortfall, portfolioEnd,
      realReturn: yearReturn,
    });
  }

  return { rows, initialCash, totalTax, depletionAge, sippDepletionAge, firstShortfallAge, estateAt90 };
}

export function projectDrawdown(inputs, stress = false) {
  validate(inputs);
  return runProjection(inputs, stress);
}

function findPostPensionCeiling(inputs, baseline) {
  const { retirementAge, statePensionAge, startingPot, realReturn } = inputs;
  if (baseline.firstShortfallAge !== null && baseline.firstShortfallAge < statePensionAge) return null;

  const firstPensionIndex = statePensionAge - retirementAge;
  const pensionIncome = baseline.rows[firstPensionIndex].statePension;
  let low = pensionIncome;
  let high = pensionIncome + startingPot * (1 + Math.max(0, realReturn)) ** (horizon - retirementAge);
  for (let step = 0; step < 44; step++) {
    const candidate = (low + high) / 2;
    if (runProjection(inputs, false, candidate).firstShortfallAge === null) low = candidate;
    else high = candidate;
  }

  const firstYear = runProjection(inputs, false, low).rows[firstPensionIndex];
  return { netSpending: low, grossWithdrawal: firstYear.pensionWithdrawal + firstYear.cashUsed };
}

export function compareDrawdown(inputs) {
  validate(inputs);
  const phased = runProjection({ ...inputs, strategy: STRATEGY.PHASED }, false);
  const upfront = runProjection({ ...inputs, strategy: STRATEGY.UPFRONT }, false);
  const baseline = inputs.strategy === STRATEGY.PHASED ? phased : upfront;
  return {
    baseline, phased, upfront,
    stress: inputs.stressTest ? runProjection(inputs, true) : null,
    taxSaved: upfront.totalTax - phased.totalTax,
    postPensionCeiling: findPostPensionCeiling(inputs, baseline),
  };
}
