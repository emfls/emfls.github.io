const MAX_CENTS = 10_000_000_000;
const roundRatio = (n, d) => Math.sign(n) * Math.floor((Math.abs(n) + d / 2) / d);

function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + ' is outside the supported range.');
  }
  return value;
}
const money = (value, name) => integer(value, 0, MAX_CENTS, name);

export function parseCents(value) {
  const match = /^([+-]?)([0-9]{1,9})(?:[.]([0-9]{1,2}))?$/.exec(String(value).trim());
  if (!match) throw new RangeError('Enter a number with up to two decimal places.');
  const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return integer(match[1] === '-' && cents ? -cents : cents, -MAX_CENTS, MAX_CENTS, 'Amount');
}

// IRS Publication 946 Table A-6: percentages in thousandths of a percent.
export const A6_FIRST_YEAR = Object.freeze([3485,3182,2879,2576,2273,1970,1667,1364,1061,758,455,152]);

export function depreciation(basis, month) {
  integer(basis, 0, MAX_CENTS * 2, 'Building basis');
  integer(month, 1, 12, 'Placed-in-service month');
  const first = roundRatio(basis * A6_FIRST_YEAR[month - 1], 100000);
  const full = roundRatio(basis * 2, 55);
  const fullYears = month <= 6 ? 26 : 27;
  const schedule = [first];
  let remaining = basis - first;
  for (let year = 0; year < fullYears; year++) {
    const amount = Math.min(remaining, full);
    schedule.push(amount);
    remaining -= amount;
  }
  return [...schedule, remaining];
}

export function mortgage(principal, rate, months, year) {
  money(principal, 'Loan principal');
  integer(rate, 0, 2500, 'Annual interest rate');
  integer(months, 12, 480, 'Term in months');
  integer(year, 1, 40, 'Loan year');
  if (!principal || (year - 1) * 12 >= months) return {payment:0, debt:0, interest:0};

  let payment;
  if (!rate) {
    payment = roundRatio(principal, months);
  } else {
    // Exact rational amortizing payment before rounding it to cents.
    const base = 120000n;
    const interest = BigInt(rate);
    const growth = (base + interest) ** BigInt(months);
    const numerator = BigInt(principal) * interest * growth;
    const denominator = base * (growth - base ** BigInt(months));
    payment = Number((numerator * 2n + denominator) / (2n * denominator));
  }

  let balance = principal;
  let debt = 0;
  let interest = 0;
  for (let month = 1; month <= Math.min(months, year * 12) && balance > 0; month++) {
    const monthInterest = roundRatio(balance * rate, 120000);
    const due = balance + monthInterest;
    const paid = month === months ? due : Math.min(payment, due);
    balance = due - paid;
    if (month > (year - 1) * 12) {
      debt += paid;
      interest += monthInterest;
    }
  }
  return {payment, debt, interest};
}

export function lossAllowance(status, magi, active) {
  integer(magi, -MAX_CENTS, MAX_CENTS, 'Modified AGI');
  if (!['general','apart','together'].includes(status)) throw new RangeError('Choose a filing situation.');
  if (!active || status === 'together') return 0;
  const apart = status === 'apart';
  const maximum = apart ? 1250000 : 2500000;
  const start = apart ? 5000000 : 10000000;
  return Math.max(0, maximum - roundRatio(Math.max(0, magi - start), 2));
}

export function calculateRental({
  price, closing, land, month, year, annualRent, vacancy, expenses, loan, interestRate,
  term, invested, status, magi, active, taxRate, passiveIncome = 0,
}) {
  for (const [value, label] of [[price,'Price'],[closing,'Closing costs'],[land,'Land'],
    [annualRent,'Rent'],[expenses,'Expenses'],[invested,'Cash invested'],[passiveIncome,'Other passive income']]) {
    money(value, label);
  }
  integer(vacancy, 0, 10000, 'Vacancy');
  integer(taxRate, 0, 3700, 'Federal marginal rate');
  integer(term, 1, 40, 'Mortgage term');
  integer(year, 1, 40, 'Projection year');
  const basis = Math.max(0, price + closing - land);
  const schedule = depreciation(basis, month);
  const annualDep = schedule[year - 1] ?? 0;
  const gross = roundRatio(annualRent * (10000 - vacancy), 10000);
  const noi = gross - expenses;
  const debt = mortgage(loan, interestRate, term * 12, year);
  const firstDebt = year === 1 ? debt : mortgage(loan, interestRate, term * 12, 1);
  const cashFlow = noi - debt.debt;
  const taxable = noi - debt.interest - annualDep;
  const loss = Math.max(0, -taxable);
  const passiveOffset = Math.min(loss, passiveIncome);
  const allowance = lossAllowance(status, magi, active);
  const specialDeduction = Math.min(loss - passiveOffset, allowance);
  const deducted = passiveOffset + specialDeduction;
  return {basis, annualDep, schedule, gross, noi, debt, firstDebt, cashFlow, taxable, allowance, passiveOffset,
    specialDeduction, deducted, suspended:loss - deducted, shield:roundRatio(deducted * taxRate, 10000),
    capRate:price ? roundRatio(noi * 10000, price) : null,
    cashReturn:invested ? roundRatio(cashFlow * 10000, invested) : null};
}
