// Money is represented as integer pence. Rates are expressed in basis points.
export const RULES = Object.freeze({
  personalAllowance: 1_257_000,
  taperStart: 10_000_000,
  basicBand: 3_770_000,
  additionalThreshold: 12_514_000,
  dividendAllowance: 50_000,
  lowerEarningsLimit: 670_800,
  primaryThreshold: 1_257_000,
  upperEarningsLimit: 5_027_000,
  secondaryThreshold: 500_000,
  employmentAllowance: 1_050_000,
  smallProfitsLimit: 5_000_000,
  mainRateLimit: 25_000_000,
  maxProfit: 100_000_000_000,
});

function rateAmount(scaledPence, halfAdjustment = 5_000) {
  return Math.floor((scaledPence + halfAdjustment) / 10_000);
}

export function personalAllowance(income) {
  const reduction = Math.floor(Math.max(0, income - RULES.taperStart) / 2);
  return Math.max(0, RULES.personalAllowance - reduction);
}

function taxUnits(start, end, [basic, higher, additional]) {
  const bands = [
    [0, RULES.basicBand, basic],
    [RULES.basicBand, RULES.additionalThreshold, higher],
    [RULES.additionalThreshold, Infinity, additional],
  ];
  return bands.reduce((total, [lower, upper, rate]) => {
    return total + Math.max(0, Math.min(end, upper) - Math.max(start, lower)) * rate;
  }, 0);
}

export function personalTaxes(salary, dividends) {
  const allowance = personalAllowance(salary + dividends);
  const taxableSalary = Math.max(0, salary - allowance);
  const taxableDividends = Math.max(0, dividends - Math.max(0, allowance - salary));
  // Dividends stack above salary. The 0% dividend allowance occupies band space.
  const dividendStart = taxableSalary + Math.min(taxableDividends, RULES.dividendAllowance);
  return {
    allowance,
    salaryTax: rateAmount(taxUnits(0, taxableSalary, [2_000, 4_000, 4_500])),
    dividendTax: rateAmount(taxUnits(dividendStart, taxableSalary + taxableDividends, [1_075, 3_575, 3_935])),
  };
}

export function employeeNI(salary) {
  const main = Math.max(0, Math.min(salary, RULES.upperEarningsLimit) - RULES.primaryThreshold);
  const upper = Math.max(0, salary - RULES.upperEarningsLimit);
  // HMRC’s exact percentage method rounds an exact half penny down.
  return rateAmount(main * 800 + upper * 200, 4_999);
}

export function employerNI(salary, allowance = 0) {
  const gross = rateAmount(Math.max(0, salary - RULES.secondaryThreshold) * 1_500, 4_999);
  return Math.max(0, gross - allowance);
}

export function corporationTax(profit) {
  if (profit <= 0) return 0;
  if (profit <= RULES.smallProfitsLimit) return rateAmount(profit * 1_900);
  // Assumes taxable and augmented profits are equal.
  const relief = Math.max(0, RULES.mainRateLimit - profit) * 150;
  return rateAmount(profit * 2_500 - relief);
}

function affordableSalary(budget, allowance) {
  let lower = 0;
  let upper = budget;
  while (lower < upper) {
    const salary = Math.ceil((lower + upper) / 2);
    if (salary + employerNI(salary, allowance) <= budget) {
      lower = salary;
    } else {
      upper = salary - 1;
    }
  }
  return lower;
}

function checkAmount(amount, maximum, label) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > maximum) {
    throw new RangeError(label);
  }
}

export function compareStrategies({ profit, pension = 0, allowance = 0 }) {
  checkAmount(profit, RULES.maxProfit, 'Company profit is outside the supported range.');
  checkAmount(pension, profit, 'The company pension contribution must fit within company profit.');
  checkAmount(allowance, RULES.employmentAllowance, 'Employment Allowance must be between £0 and £10,500.');

  const budget = profit - pension;
  const maxSalary = affordableSalary(budget, allowance);
  const targets = [
    ['personal-allowance', RULES.personalAllowance],
    ['secondary-threshold', RULES.secondaryThreshold],
    ['paye', maxSalary],
  ];

  const strategies = targets.map(([id, target]) => {
    const salary = Math.min(target, maxSalary);
    const grossEmployerNI = employerNI(salary);
    const netEmployerNI = employerNI(salary, allowance);
    const companyTaxableProfit = budget - salary - netEmployerNI;
    // For PAYE, rounding can leave a penny that cannot buy another penny of salary.
    const companyTax = corporationTax(companyTaxableProfit);
    const postTaxProfit = companyTaxableProfit - companyTax;
    const dividends = id === 'paye' ? 0 : postTaxProfit;
    const retainedProfit = postTaxProfit - dividends;
    const { allowance: availablePersonalAllowance, salaryTax, dividendTax } = personalTaxes(salary, dividends);
    const primaryNI = employeeNI(salary);
    return {
      id, target, salary, pension, grossEmployerNI, employmentAllowanceUsed: grossEmployerNI - netEmployerNI,
      employerNI: netEmployerNI, companyTaxableProfit, corporationTax: companyTax, dividends, retainedProfit,
      personalAllowance: availablePersonalAllowance, salaryTax, dividendTax, employeeNI: primaryNI,
      takeHome: salary + dividends - salaryTax - dividendTax - primaryNI,
      meetsLEL: salary >= RULES.lowerEarningsLimit,
    };
  });

  const [personalAllowanceStrategy, secondaryThresholdStrategy, paye] = strategies;
  const bestMixedTakeHome = Math.max(personalAllowanceStrategy.takeHome, secondaryThresholdStrategy.takeHome);
  const bestTakeHome = Math.max(bestMixedTakeHome, paye.takeHome);
  return {
    strategies,
    winners: strategies.filter(strategy => strategy.takeHome === bestTakeHome).map(strategy => strategy.id),
    savingsVsPaye: bestMixedTakeHome - paye.takeHome,
  };
}
