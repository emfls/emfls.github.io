export const MAX_AMOUNT = 1_000_000_000;
export const NO_ALLOWANCE = 'sole_director_no_ea';
export const ELIGIBLE = 'multi_employee_ea_yes';

const PERSONAL_ALLOWANCE = 1_257_000;
const PERSONAL_TAPER = 10_000_000;
const BASIC_BAND = 3_770_000;
const HIGHER_BAND = 12_514_000;
const UPPER_EARNINGS_LIMIT = 5_027_000;
const SECONDARY_THRESHOLD = 500_000;
const LOWER_EARNINGS_LIMIT = 670_800;
const DIVIDEND_ALLOWANCE = 50_000;
const MAX_EMPLOYMENT_ALLOWANCE = 1_050_000;

function toPence(value, field, max = MAX_AMOUNT) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`${field} must be between £0 and £${max.toLocaleString('en-GB')}.`);
  }
  const pence = Math.round(value * 100);
  if (pence / 100 !== value) throw new RangeError(`${field} must use at most two decimal places.`);
  return pence;
}

function pounds(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value / 100]));
}

function companyTaxPence(profit) {
  if (profit <= 5_000_000) return Math.round(profit * 19 / 100);
  if (profit >= 25_000_000) return Math.round(profit / 4);
  // Augmented profit equals taxable profit for the standalone trading company model.
  return Math.round((profit * 50 - (25_000_000 - profit) * 3) / 200);
}

function niSlice(pence, rate) {
  // HMRC's exact percentage method rounds a half-penny down on each slice.
  return Math.floor((pence * rate + 49) / 100);
}

function employerNIPence(salary, availableAllowance) {
  const lower = Math.max(0, Math.min(salary, UPPER_EARNINGS_LIMIT) - SECONDARY_THRESHOLD);
  const upper = Math.max(0, salary - UPPER_EARNINGS_LIMIT);
  return Math.max(0, niSlice(lower, 15) + niSlice(upper, 15) - availableAllowance);
}

function bandTaxUnits(end, start, rates) {
  const basic = Math.max(0, Math.min(end, BASIC_BAND) - start);
  const higher = Math.max(0, Math.min(end, HIGHER_BAND) - Math.max(start, BASIC_BAND));
  const additional = Math.max(0, end - Math.max(HIGHER_BAND, start));
  return basic * rates[0] + higher * rates[1] + additional * rates[2];
}

function personalTaxesPence(salary, dividends) {
  const gross = salary + dividends;
  const personalAllowance = Math.max(0, PERSONAL_ALLOWANCE - Math.max(0, (gross - PERSONAL_TAPER) / 2));
  const taxable = Math.max(0, gross - personalAllowance);
  const lowestSalary = Math.max(0, salary - personalAllowance);
  const highestSalary = Math.min(salary, taxable);

  // In 2026/27 allocate the allowance for the lowest income tax. The only
  // possible minima are the endpoints and the breakpoints of the tax bands.
  const breakpoints = [
    lowestSalary, highestSalary, BASIC_BAND, HIGHER_BAND,
    BASIC_BAND - DIVIDEND_ALLOWANCE, HIGHER_BAND - DIVIDEND_ALLOWANCE,
    taxable - DIVIDEND_ALLOWANCE
  ];
  let income = 0;
  let dividend = 0;
  let lowestTax = Infinity;
  for (const taxableSalary of breakpoints) {
    if (taxableSalary < lowestSalary || taxableSalary > highestSalary) continue;
    const salaryTax = bandTaxUnits(taxableSalary, 0, [2000, 4000, 4500]);
    const dividendTax = bandTaxUnits(taxable, taxableSalary + DIVIDEND_ALLOWANCE, [1075, 3575, 3935]);
    if (salaryTax + dividendTax < lowestTax) {
      lowestTax = salaryTax + dividendTax;
      income = salaryTax;
      dividend = dividendTax;
    }
  }

  const employeeBasic = Math.max(0, Math.min(salary, UPPER_EARNINGS_LIMIT) - PERSONAL_ALLOWANCE);
  const employeeUpper = Math.max(0, salary - UPPER_EARNINGS_LIMIT);
  return {
    personalAllowance,
    incomeTax: Math.round(income / 10_000),
    dividendTax: Math.round(dividend / 10_000),
    employeeNI: niSlice(employeeBasic, 8) + niSlice(employeeUpper, 2)
  };
}

export function corporationTax(profit) {
  return companyTaxPence(toPence(profit, 'Taxable company profit')) / 100;
}

export function employerNI(salary, availableAllowance = 0) {
  return employerNIPence(
    toPence(salary, 'Salary'),
    toPence(availableAllowance, 'Remaining Employment Allowance', 10_500)
  ) / 100;
}

export function personalTaxes(salary, dividends) {
  return pounds(personalTaxesPence(toPence(salary, 'Salary'), toPence(dividends, 'Dividends')));
}

function affordableSalary(budget, ceiling, allowance) {
  let lower = 0;
  let upper = Math.min(budget, ceiling);
  while (lower < upper) {
    const salary = Math.ceil((lower + upper) / 2);
    if (salary + employerNIPence(salary, allowance) <= budget) {
      lower = salary;
    } else {
      upper = salary - 1;
    }
  }
  return lower;
}

export function compareStrategies({
  profit,
  pension = 0,
  target = null,
  employmentAllowanceEligibility = NO_ALLOWANCE,
  remainingAllowance = 10_500
}) {
  const companyProfit = toPence(profit, 'Company profit');
  const contribution = toPence(pension, 'Pension contribution');
  const grossTarget = target === null ? null : toPence(target, 'Gross cash target');
  const unusedAllowance = toPence(remainingAllowance, 'Remaining Employment Allowance', MAX_EMPLOYMENT_ALLOWANCE / 100);
  if (contribution > companyProfit) throw new RangeError('Pension contribution cannot exceed company profit.');
  if (![NO_ALLOWANCE, ELIGIBLE].includes(employmentAllowanceEligibility)) {
    throw new RangeError('Select a valid Employment Allowance option.');
  }

  const budget = companyProfit - contribution;
  const allowance = employmentAllowanceEligibility === ELIGIBLE ? unusedAllowance : 0;
  const maxCash = grossTarget ?? budget;
  const plans = [
    { id: 'A', salaryLimit: PERSONAL_ALLOWANCE, allowDividends: true },
    { id: 'B', salaryLimit: SECONDARY_THRESHOLD, allowDividends: true },
    { id: 'C', salaryLimit: maxCash, allowDividends: false }
  ];

  const strategies = plans.map(({ id, salaryLimit, allowDividends }) => {
    const salary = affordableSalary(budget, Math.min(maxCash, salaryLimit), allowance);
    const employerNI = employerNIPence(salary, allowance);
    const taxableProfit = budget - salary - employerNI;
    const corporationTax = companyTaxPence(taxableProfit);
    const profitAfterTax = taxableProfit - corporationTax;
    const dividends = allowDividends ? Math.min(profitAfterTax, maxCash - salary) : 0;
    const grossCash = salary + dividends;
    const { incomeTax, dividendTax, employeeNI, personalAllowance } = personalTaxesPence(salary, dividends);
    const personalTax = incomeTax + dividendTax;
    const totalTax = corporationTax + employerNI + employeeNI + personalTax;
    return {
      id,
      ...pounds({
        salary, dividends, grossCash, taxableProfit, corporationTax, employerNI,
        employeeNI, incomeTax, dividendTax, personalTax, personalAllowance, totalTax,
        netCash: grossCash - personalTax - employeeNI,
        retainedProfit: profitAfterTax - dividends,
        targetShortfall: grossTarget === null ? 0 : grossTarget - grossCash
      }),
      combinedTaxRate: budget ? totalTax / budget : null,
      belowLowerEarningsLimit: salary < LOWER_EARNINGS_LIMIT
    };
  });

  const meetingTarget = strategies.filter(strategy => strategy.targetShortfall === 0);
  const ranked = (meetingTarget.length ? meetingTarget : strategies).slice()
    .sort((a, b) => b.netCash - a.netCash);
  const best = ranked[0];
  return {
    strategies,
    winners: ranked.filter(strategy => strategy.netCash === best.netCash),
    targetMet: grossTarget === null || meetingTarget.length > 0,
    cashGain: ranked.length > 1 ? (Math.round(best.netCash * 100) - Math.round(ranked[1].netCash * 100)) / 100 : null
  };
}
