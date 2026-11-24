const MAX_CENTS = 100_000_000_000;
const BPS = 10_000;
const roundBps = scaled => Math.floor((scaled + BPS / 2) / BPS);

export function parseCents(value) {
  const match = typeof value === 'string' && /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (match) {
    const amount = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
    if (amount <= MAX_CENTS) return amount;
  }
  throw new RangeError('Enter an amount from 0 to 1 billion with up to two decimal places and no commas.');
}

function checkAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_CENTS) {
    throw new RangeError('Enter a nonnegative amount within the supported range.');
  }
}

const PERSONAL_ALLOWANCE = 1_257_000;
const TAPER_START = 10_000_000;
const BASIC_WIDTH = 3_770_000;
const ADDITIONAL_THRESHOLD = 12_514_000;
const UPPER_NI_LIMIT = 5_027_000;
const BIK_RATES = Object.freeze({'2026/27': 4, '2027/28': 5, '2028/29': 7, '2029/30': 9});

export function incomeTax(income) {
  if (!Number.isSafeInteger(income) || income < 0 || income > 2 * MAX_CENTS) {
    throw new RangeError('Enter nonnegative taxable income within the supported range.');
  }
  // Use half-pence internally so the £1 per £2 taper has no intermediate rounding.
  const allowance = Math.max(0, 2 * PERSONAL_ALLOWANCE - Math.max(0, income - TAPER_START));
  const taxable = Math.max(0, 2 * income - allowance);
  const basic = Math.min(taxable, 2 * BASIC_WIDTH);
  const higher = Math.max(0, Math.min(taxable, 2 * ADDITIONAL_THRESHOLD) - 2 * BASIC_WIDTH);
  const additional = Math.max(0, taxable - 2 * ADDITIONAL_THRESHOLD);
  return Math.floor((basic * 20 + higher * 40 + additional * 45 + 100) / 200);
}

export function employeeNI(cashPay) {
  checkAmount(cashPay);
  const main = Math.max(0, Math.min(cashPay, UPPER_NI_LIMIT) - PERSONAL_ALLOWANCE);
  return roundBps(main * 800 + Math.max(0, cashPay - UPPER_NI_LIMIT) * 200);
}

export function calculateEV({salary, monthlySacrifice, p11d}) {
  [salary, monthlySacrifice, p11d].forEach(checkAmount);
  const sacrifice = monthlySacrifice * 12;
  if (sacrifice > salary) throw new RangeError('Annual salary sacrifice cannot exceed gross cash salary.');
  const cashPay = salary - sacrifice;
  const schedule = Object.entries(BIK_RATES).map(([year, rate]) => ({
    year, rate, value: roundBps(p11d * rate * 100),
  }));
  const bikValue = schedule[0].value;
  const ani = cashPay + bikValue;
  const taxBefore = incomeTax(salary);
  const taxOnCash = incomeTax(cashPay);
  const taxAfter = incomeTax(ani);
  const niBefore = employeeNI(salary);
  const niAfter = employeeNI(cashPay);
  const bikTax = taxAfter - taxOnCash;
  const incomeTaxSaved = taxBefore - taxOnCash;
  const niSaved = niBefore - niAfter;
  const grossSavings = incomeTaxSaved + niSaved;
  const netCost = sacrifice - grossSavings + bikTax;
  return {
    sacrifice, bikValue, bikTax, ani, taxBefore, taxAfter, niBefore, niAfter,
    incomeTaxSaved, niSaved, grossSavings, netCost, monthlyCost: Math.round(netCost / 12),
    reliefBps: sacrifice ? Math.round(grossSavings * BPS / sacrifice) : 0,
    crossesChildcareThreshold: salary > TAPER_START && ani <= TAPER_START,
    schedule,
  };
}
