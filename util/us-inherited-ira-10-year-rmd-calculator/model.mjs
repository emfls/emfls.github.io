const MAX_CENTS = 100_000_000_000;
const round = (numerator, denominator) => Math.floor((numerator + denominator / 2) / denominator);

export function parseCents(value) {
  const match = typeof value === 'string' && /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError('Enter a nonnegative amount with up to two decimal places and no commas.');
  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  checkCents(cents);
  return cents;
}

function checkCents(...amounts) {
  if (amounts.some(amount => !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_CENTS)) {
    throw new RangeError('Amounts must be between zero and one billion.');
  }
}

// Rev. Proc. 2025-32, sections 4.01 and 4.14. Bracket limits are in dollars.
const RATES = [10, 12, 22, 24, 32, 35, 37];
const BRACKETS = {
  single: [12400, 50400, 105700, 201775, 256225, 640600],
  hoh: [17700, 67450, 105700, 201750, 256200, 640600],
  mfj: [24800, 100800, 211400, 403550, 512450, 768700],
  mfs: [12400, 50400, 105700, 201775, 256225, 384350],
};
export const STANDARD_DEDUCTION = Object.freeze({single: 1610000, hoh: 2415000, mfj: 3220000, mfs: 1610000});

export function federalTax(gross, status) {
  if (!Object.hasOwn(BRACKETS, status) || !Number.isSafeInteger(gross) || gross < 0 || gross > 8 * MAX_CENTS) {
    throw new RangeError('Check income and filing status.');
  }
  const taxable = Math.max(0, gross - STANDARD_DEDUCTION[status]);
  let lower = 0;
  let tax = 0;
  for (const [index, rate] of RATES.entries()) {
    const upper = index < 6 ? BRACKETS[status][index] * 100 : taxable;
    tax += Math.max(0, Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return round(tax, 100);
}

// IRS Publication 590-B, Appendix B, Table I. Factors are stored in tenths.
const LIFE_TENTHS = [
  650, 641, 631, 621, 611, 602, 592, 582, 573, 563,
  553, 544, 534, 525, 515, 505, 496, 486, 477, 467,
  457, 448, 438, 429, 419, 410, 400, 390, 381, 371,
  362, 353, 343, 334, 325, 316, 306, 298, 289, 280,
  271, 262, 254, 245, 237, 229, 220, 212, 204, 196,
  188, 180, 172, 164, 156, 148, 141, 133, 126, 119,
  112, 105, 99, 93, 87, 81, 76, 71, 66, 61,
  57, 53, 49, 46, 43, 40, 37, 34, 32, 30,
  28, 26, 25, 23, 22, 21, 21, 21, 20, 20,
  20, 20, 20, 19, 19, 18, 18, 16, 14, 11, 10,
];

export function lifeFactorTenths(age) {
  if (!Number.isInteger(age) || age < 20 || age > 120) {
    throw new RangeError('Enter an age from 20 to 120 (use 120 for 120 or older).');
  }
  return LIFE_TENTHS[age - 20];
}

export function missedRmdExcise(shortfall) {
  checkCents(shortfall);
  return {standard: round(shortfall * 25, 100), timelyCorrection: round(shortfall * 10, 100)};
}

export function calculateIRA({deathYear, beneficiaryAge, ownerAge, postRbd, balance, growthBps, otherIncome, status, shortfall = 0}) {
  checkCents(balance, otherIncome);
  if (!Number.isInteger(deathYear) || deathYear < 2020 || deathYear > 2026 || typeof postRbd !== 'boolean') {
    throw new RangeError('Choose an RBD status and a year of death from 2020 to 2026.');
  }
  if (!Number.isInteger(growthBps) || growthBps < -1000 || growthBps > 2000) {
    throw new RangeError('Enter annual growth from −10% to 20%.');
  }
  if (!Number.isInteger(beneficiaryAge) || beneficiaryAge < 20 || beneficiaryAge > 90) {
    throw new RangeError('Enter a beneficiary age from 20 to 90 in Year 1.');
  }

  const firstYear = Math.max(2026, deathYear + 1);
  const deadline = deathYear + 10;
  const firstFactor = postRbd ? Math.max(lifeFactorTenths(beneficiaryAge), lifeFactorTenths(ownerAge) - 10) : null;
  const baseTax = federalTax(otherIncome, status);

  const grow = amount => round(amount * (10000 + growthBps), 10000);

  function project(target) {
    const rows = [];
    let prior = balance;
    for (let calendarYear = firstYear; calendarYear <= deadline; calendarYear += 1) {
      const year = calendarYear - deathYear;
      const divisor = postRbd && year < 10 ? Math.max(10, firstFactor - (year - 1) * 10) : null;
      const available = year === 10 ? grow(prior) : prior;
      const minimum = year === 10 || divisor === 10
        ? available
        : divisor === null ? 0 : Math.min(available, round(prior * 10, divisor));
      const withdrawn = Math.min(available, Math.max(minimum, target));
      const tax = federalTax(otherIncome + withdrawn, status) - baseTax;
      prior = grow(available - withdrawn);
      rows.push({year, calendarYear, divisor, minimum, withdrawn, tax, remaining: prior});
    }
    return rows;
  }

  // Smallest level target whose terminal distribution fits that target, honoring each year's RMD.
  let low = 0;
  let high = Math.max(balance, grow(balance));
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (project(middle).at(-1).withdrawn <= middle) high = middle;
    else low = middle + 1;
  }

  const minimumPlan = project(0);
  const smoothPlan = project(low);
  const planTax = rows => rows.reduce((total, row) => total + row.tax, 0);
  return {
    deadline, firstFactor, target: low, minimumPlan, smoothPlan,
    minimumTax: planTax(minimumPlan), smoothTax: planTax(smoothPlan),
    excise: missedRmdExcise(shortfall),
  };
}
