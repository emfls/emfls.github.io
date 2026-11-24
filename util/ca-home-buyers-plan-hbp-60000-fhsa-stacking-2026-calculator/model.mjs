const REPAYMENT_YEARS = 15;
const RELIEF_OFFSET = 5;

const dollars = cents => cents / 100;

function toCents(amount, label) {
  const scaled = amount * 100;
  const cents = Math.round(scaled);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents) ||
      amount !== dollars(cents)) {
    throw new RangeError(`${label} must be a non-negative amount in dollars and cents.`);
  }
  return cents;
}

export function hbpLimit(buyers, withdrawalYear, before2024Increase = false) {
  if (buyers !== 1 && buyers !== 2) {
    throw new RangeError('Select one or two eligible buyers.');
  }
  if (!Number.isInteger(withdrawalYear) || withdrawalYear < 2022 || withdrawalYear > 2028) {
    throw new RangeError('Select a first HBP withdrawal year from 2022 to 2028.');
  }
  const oldLimit = withdrawalYear < 2024 || (withdrawalYear === 2024 && before2024Increase);
  return buyers * (oldLimit ? 35000 : 60000);
}

function scheduleRow(year, opening, minimum, repaid, income = 0) {
  return {
    year,
    opening: dollars(opening),
    minimum: dollars(minimum),
    repaid: dollars(repaid),
    income: dollars(income),
    balance: dollars(opening - repaid - income)
  };
}

export function calculateHbp({
  buyers, withdrawalYear, withdrawal, fhsa, taxRate, missed = 0, extra = 0,
  before2024Increase = false
}) {
  const limit = hbpLimit(buyers, withdrawalYear, before2024Increase);
  const principal = toCents(withdrawal, 'HBP withdrawal');
  if (withdrawal > limit) {
    throw new RangeError(`HBP withdrawal must be at most $${limit.toLocaleString('en-CA')} for the selected buyers and year.`);
  }
  const pool = principal + toCents(fhsa, 'FHSA balance');
  if (!Number.isSafeInteger(pool)) throw new RangeError('Combined down payment is too large.');
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    throw new RangeError('Marginal tax rate must be between 0% and 100%.');
  }
  const requestedMiss = toCents(missed, 'Missed repayment');
  const annualExtra = toCents(extra, 'Extra repayment');
  const firstYear = withdrawalYear + RELIEF_OFFSET;
  const lastYear = firstYear + REPAYMENT_YEARS - 1;
  const initialMinimum = Math.round(principal / REPAYMENT_YEARS);
  let balance = principal;
  let clearedYear = null;
  const graceRows = [];
  for (let year = withdrawalYear + 1; year < firstYear; year++) {
    const repaid = Math.min(balance, annualExtra);
    graceRows.push(scheduleRow(year, balance, 0, repaid));
    balance -= repaid;
    if (repaid && !balance) clearedYear = year;
  }

  // Under ITA 146.01(4.1), pre-period designations credit year one dollar for dollar.
  const earlyCredit = principal - balance;
  const rows = [];
  let firstDueYear = null;
  let firstDueMinimum = 0;
  let income = 0;
  for (let year = firstYear; year <= lastYear; year++) {
    const minimum = year === firstYear
      ? Math.max(0, initialMinimum - earlyCredit)
      : Math.round(balance / (lastYear - year + 1));
    const firstDue = firstDueYear === null && minimum > 0;
    if (firstDue) {
      firstDueYear = year;
      firstDueMinimum = minimum;
      income = Math.min(minimum, requestedMiss);
    }

    const shortfall = firstDue ? income : 0;
    const repaid = shortfall
      ? minimum - shortfall
      : minimum + Math.min(balance - minimum, annualExtra);
    rows.push(scheduleRow(year, balance, minimum, repaid, shortfall));
    balance -= repaid + shortfall;
    if ((repaid || shortfall) && !balance) clearedYear = year;
  }

  return {
    pool: dollars(pool),
    firstYear,
    lastYear,
    firstDueYear,
    clearedYear,
    baselineAnnual: dollars(initialMinimum),
    baselineMonthly: dollars(Math.round(principal / (REPAYMENT_YEARS * 12))),
    firstDueMinimum: dollars(firstDueMinimum),
    fullMissTax: dollars(Math.round(firstDueMinimum * taxRate / 100)),
    incomeInclusion: dollars(income),
    scenarioTax: dollars(Math.round(income * taxRate / 100)),
    totalRepaid: dollars(principal - income - balance),
    graceRows,
    rows
  };
}
