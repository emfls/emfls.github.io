export const FIRST_YEAR = 2026;
export const REPAYMENT_YEARS = 10;
const ANNUAL_CAP = 1_000_000;
const CYCLE_CAP = 2_000_000;
const WINDOW_YEARS = 5;

function range(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

function cents(value, label) {
  return Math.round(range(value, 0, 1_000_000, label) * 100);
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + row[key], 0);
}

export function firstRepaymentYear(qualifyingYears) {
  if (qualifyingYears.length !== 4 || !qualifyingYears.every(value => typeof value === 'boolean')) {
    throw new RangeError('Set qualifying student status for 2027 through 2030.');
  }
  for (let index = 1; index < qualifyingYears.length; index += 1) {
    if (!qualifyingYears[index - 1] && !qualifyingYears[index]) return FIRST_YEAR + index + 1;
  }
  return FIRST_YEAR + 5;
}

export function nonDeductibleContribution(recentContributions, remainingValue) {
  return Math.max(0, cents(recentContributions, 'Recent contributions') - cents(remainingValue, 'Remaining RRSP value')) / 100;
}

function withholdingCents(amount) {
  const rate = amount <= 500_000 ? 10 : amount <= 1_500_000 ? 20 : 30;
  return Math.round(amount * rate / 100);
}

export function withholding(amount) {
  return withholdingCents(cents(amount, 'Withdrawal')) / 100;
}

function repaymentSchedule(total, start, payments, taxRate) {
  if (!total) return [];
  let balance = total;
  return Array.from({ length: REPAYMENT_YEARS }, (_, index) => {
    const opening = balance;
    const minimum = Math.round(opening / (REPAYMENT_YEARS - index));
    const designated = Math.min(opening, payments[index] ?? minimum);
    const income = Math.max(0, minimum - designated);
    balance -= designated + income;
    return {
      year: start + index,
      opening: opening / 100,
      minimum: minimum / 100,
      designated: designated / 100,
      income: income / 100,
      tax: Math.round(income * taxRate / 100) / 100,
      closing: balance / 100,
    };
  });
}

function compareFunding(withdrawals, schedule, { loanFirstMonth, loanTerm, rrspReturn, cashReturn, retirementRate }) {
  const eligible = sum(withdrawals, 'eligible');
  if (!eligible) return { netLLP: null, comparisonReason: 'none' };

  const months = Math.max((schedule.at(-1).year - FIRST_YEAR + 1) * 12, loanFirstMonth + loanTerm - 1);
  const rrspMonthly = (1 + rrspReturn / 100) ** (1 / 12);
  const cashMonthly = (1 + cashReturn / 100) ** (1 / 12);
  const grow = (amount, factor, month) => amount * factor ** (months - month);

  let untouched = 0;
  let restored = 0;
  let cashDifference = 0;
  for (const row of withdrawals) {
    // January draws are timed at the start of the month.
    untouched += grow(row.eligible, rrspMonthly, (row.year - FIRST_YEAR) * 12);
  }
  for (const row of schedule) {
    const month = (row.year - FIRST_YEAR + 1) * 12;
    restored += grow(row.designated, rrspMonthly, month);
    cashDifference -= grow(row.designated + row.tax, cashMonthly, month);
  }
  const rrspBalanceGap = untouched - restored;
  const rrspPrincipalMissing = Math.round((eligible - sum(schedule, 'designated')) * 100) / 100;
  const results = {
    horizonYear: FIRST_YEAR + Math.floor((months - 1) / 12),
    horizonMonth: (months - 1) % 12 + 1,
    rrspBalanceGap,
    rrspPrincipalMissing,
    lostGrowth: rrspBalanceGap - rrspPrincipalMissing,
  };

  const finalDrawMonth = (withdrawals.findLast(row => row.eligible).year - FIRST_YEAR) * 12 + 1;
  if (loanFirstMonth < finalDrawMonth) return { ...results, netLLP: null, comparisonReason: 'timing' };

  // Compare only the matched education funding. Invest the budget difference
  // each month and value the RRSP difference after the assumed retirement tax.
  const loanPayment = eligible / loanTerm;
  for (let offset = 0; offset < loanTerm; offset += 1) {
    cashDifference += grow(loanPayment, cashMonthly, loanFirstMonth + offset);
  }
  return {
    ...results,
    loanPayment,
    loanTotal: eligible,
    netLLP: Math.round((cashDifference - rrspBalanceGap * (1 - retirementRate / 100)) * 100) / 100 || 0,
  };
}

export function calculateLLP(options) {
  const { requested, qualifyingYears, eligible, payments, taxRate, retirementRate, rrspReturn, cashReturn, loanFirstMonth, loanTerm } = options;
  const start = firstRepaymentYear(qualifyingYears);
  if (requested.length !== WINDOW_YEARS) throw new RangeError('Enter all five withdrawal amounts.');
  if (payments.length > REPAYMENT_YEARS || typeof eligible !== 'boolean') throw new RangeError('Check the eligibility and repayment inputs.');
  const requests = requested.map(amount => cents(amount, 'Withdrawal'));
  if (!requests[0] && requests.some(Boolean)) throw new RangeError('Enter a first withdrawal in 2026 to start this plan.');
  const paymentCents = payments.map(amount => amount == null ? null : cents(amount, 'Designated repayment'));
  range(taxRate, 0, 100, 'Marginal tax rate');
  range(retirementRate, 0, 100, 'Retirement tax rate');
  range(rrspReturn, -50, 30, 'RRSP return');
  range(cashReturn, -50, 30, 'Outside savings return');
  range(loanFirstMonth, 1, 120, 'First loan payment month');
  range(loanTerm, 1, 174, 'Federal loan term');
  if (!Number.isInteger(loanFirstMonth) || !Number.isInteger(loanTerm)) {
    throw new RangeError('Loan start and term must be whole months.');
  }

  let principal = 0;
  const withdrawals = requests.map((amount, index) => {
    const year = FIRST_YEAR + index;
    const included = eligible && year < start ? Math.min(amount, ANNUAL_CAP, CYCLE_CAP - principal) : 0;
    const taxable = amount - included;
    principal += included;
    const directTax = Math.round(amount * taxRate / 100);
    const taxableTax = Math.round(taxable * taxRate / 100);
    return {
      year,
      requested: amount / 100,
      eligible: included / 100,
      taxable: taxable / 100,
      taxableTax: taxableTax / 100,
      taxAvoided: (directTax - taxableTax) / 100,
      directWithholding: withholdingCents(amount) / 100,
      withholdingAvoided: (withholdingCents(amount) - withholdingCents(taxable)) / 100,
    };
  });

  const schedule = repaymentSchedule(principal, start, paymentCents, taxRate);
  const roundedSum = (rows, key) => Math.round(sum(rows, key) * 100) / 100;
  return {
    withdrawals,
    schedule,
    eligibleTotal: principal / 100,
    taxableTotal: roundedSum(withdrawals, 'taxable'),
    taxableTax: roundedSum(withdrawals, 'taxableTax'),
    taxAvoided: roundedSum(withdrawals, 'taxAvoided'),
    withholdingAvoided: roundedSum(withdrawals, 'withholdingAvoided'),
    totalIncome: roundedSum(schedule, 'income'),
    totalShortfallTax: roundedSum(schedule, 'tax'),
    ...compareFunding(withdrawals, schedule, options),
  };
}
