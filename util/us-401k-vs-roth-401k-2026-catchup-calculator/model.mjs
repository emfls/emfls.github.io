export const LIMITS_2026 = Object.freeze({
  employeeDeferral: 24_500,
  standardCatchUp: 8_000,
  superCatchUp: 11_250,
  annualAdditions: 72_000,
  priorYearFicaThreshold: 150_000,
  matchCompensation: 360_000,
});

function requireRange(value, min, max, label, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new RangeError(`Enter ${label} between ${min} and ${max}${integer ? ' in whole years' : ''}.`);
  }
}

export function getLimits(age, priorYearFicaWages) {
  requireRange(age, 0, 120, 'your age', true);
  requireRange(priorYearFicaWages, 0, 1e9, '2025 sponsor FICA wages');
  const { employeeDeferral, standardCatchUp, superCatchUp, annualAdditions, priorYearFicaThreshold } = LIMITS_2026;
  const catchUp = age < 50 ? 0 : (age >= 60 && age <= 63 ? superCatchUp : standardCatchUp);
  return {
    baseLimit: employeeDeferral,
    catchUp,
    employeeMax: employeeDeferral + catchUp,
    additionsBase: annualAdditions,
    additionsMax: annualAdditions + catchUp,
    mandatoryRoth: age >= 50 && priorYearFicaWages > priorYearFicaThreshold,
  };
}

export function compareStrategies({
  age, priorYearFicaWages, compensation, annualDeferral, yearsToRetirement,
  currentTaxRate, futureTaxRate, annualReturn, capitalGainsTaxRate,
  matchRate, matchUpTo, rothMatch = false, reinvestSavings = true,
}) {
  const limits = getLimits(age, priorYearFicaWages);
  requireRange(compensation, 0, 1e9, 'plan-eligible compensation');
  requireRange(annualDeferral, 0, 1e9, 'annual employee deferral');
  requireRange(yearsToRetirement, 1, 80, 'years to retirement', true);
  requireRange(currentTaxRate, 0, 1, 'current income tax rate');
  requireRange(futureTaxRate, 0, 1, 'retirement income tax rate');
  requireRange(annualReturn, -0.99, 1, 'annual investment return');
  requireRange(capitalGainsTaxRate, 0, 1, 'tax rate on brokerage gains');
  requireRange(matchRate, 0, 2, 'employer match rate');
  requireRange(matchUpTo, 0, 1, 'employer match limit as a share of pay');

  const employeeDeferral = Math.min(annualDeferral, limits.employeeMax, compensation);
  const baseDeferral = Math.min(employeeDeferral, limits.baseLimit);
  const catchUpDeferral = employeeDeferral - baseDeferral;
  const mandatoryRothDeferral = limits.mandatoryRoth ? catchUpDeferral : 0;
  const matchCompensation = Math.min(compensation, LIMITS_2026.matchCompensation);
  const uncappedMatch = Math.min(baseDeferral, matchCompensation * matchUpTo) * matchRate;
  // Eligible catch-up deferrals do not count toward annual additions.
  const annualAdditionsLimit = Math.min(limits.additionsBase, compensation);
  const employerMatch = Math.min(uncappedMatch, annualAdditionsLimit - baseDeferral);
  const matchTax = rothMatch ? employerMatch * currentTaxRate : 0;
  const cashBudget = employeeDeferral + matchTax;
  const maxPreTaxDeferral = employeeDeferral - mandatoryRothDeferral;

  // Future value of one dollar deposited at the end of each projection year.
  const growth = annualReturn === 0
    ? yearsToRetirement
    : Math.expm1(yearsToRetirement * Math.log1p(annualReturn)) / annualReturn;

  function project(preTaxEmployee) {
    const rothEmployee = employeeDeferral - preTaxEmployee;
    const taxSavings = preTaxEmployee * currentTaxRate;
    const brokerageDeposit = reinvestSavings ? taxSavings : 0;
    const spentSavings = reinvestSavings ? 0 : taxSavings;
    const preTaxBalance = (preTaxEmployee + (rothMatch ? 0 : employerMatch)) * growth;
    const rothBalance = (rothEmployee + (rothMatch ? employerMatch : 0)) * growth;
    const brokerageBalance = brokerageDeposit * growth;
    const brokerageBasis = brokerageDeposit * yearsToRetirement;
    const brokerageTax = Math.max(0, brokerageBalance - brokerageBasis) * capitalGainsTaxRate;
    const afterTaxBrokerage = brokerageBalance - brokerageTax;
    return {
      preTaxEmployee, rothEmployee, taxSavings, brokerageDeposit, spentSavings,
      paycheckCost: cashBudget - taxSavings,
      preTaxBalance, rothBalance, brokerageBalance, brokerageTax, afterTaxBrokerage,
      afterTaxWealth: preTaxBalance * (1 - futureTaxRate) + rothBalance + afterTaxBrokerage,
    };
  }

  const traditional = project(maxPreTaxDeferral);
  const roth = project(0);
  // Identical match balances cancel. Every eligible dollar has the same
  // marginal outcome, so no interior split beats the better endpoint.
  const breakEvenTaxRate = maxPreTaxDeferral > 0
    ? Math.min(1, traditional.afterTaxBrokerage / (maxPreTaxDeferral * growth))
    : null;
  const preferred = breakEvenTaxRate === null || Math.abs(futureTaxRate - breakEvenTaxRate) < 1e-10
    ? 'tie'
    : (futureTaxRate < breakEvenTaxRate ? 'traditional' : 'roth');
  const optimal = preferred === 'tie' ? project(maxPreTaxDeferral / 2)
    : (preferred === 'traditional' ? traditional : roth);

  return {
    limits, employeeDeferral, baseDeferral, catchUpDeferral, mandatoryRothDeferral,
    annualAdditionsLimit, employerMatch, matchTax, cashBudget, breakEvenTaxRate,
    preferred, traditional, roth, optimal,
  };
}
