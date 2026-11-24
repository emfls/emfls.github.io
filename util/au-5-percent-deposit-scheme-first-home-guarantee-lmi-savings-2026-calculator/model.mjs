// Price caps from the official First Home Buyers table, effective 1 July 2026.
const regions = [
  ['nsw-metro', 1500000, 0],
  ['nsw-other', 800000, 0],
  ['vic-metro', 950000, 10],
  ['vic-other', 650000, 10],
  ['qld-metro', 1000000, 9],
  ['qld-other', 700000, 9],
  ['act', 1000000, 0],
  ['sa-metro', 900000, 11],
  ['sa-other', 500000, 11],
  ['wa-metro', 850000, 10],
  ['wa-other', 600000, 10],
  ['tas-metro', 700000, 10],
  ['tas-other', 550000, 10],
  ['nt-darwin', 750000, 10],
  ['nt-other', 600000, 10],
  ['jbt-nf', 550000, null],
  ['cx-cc', 400000, null]
];

export const REGIONS = Object.freeze(Object.fromEntries(
  regions.map(([id, cap, dutyPercent]) => [id, Object.freeze({ cap, dutyPercent })])
));
export const WAIT_LIMIT_MONTHS = 360;

const cents = dollars => Math.round(dollars * 100);
const dollars = amount => amount / 100;

function requireRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
}

function regionRules(region) {
  if (!Object.hasOwn(REGIONS, region)) throw new RangeError('Choose a listed region.');
  return REGIONS[region];
}

export function checkPriceCap(region, price) {
  const { cap } = regionRules(region);
  requireRange(price, .01, 100000000, 'Purchase price');
  const excess = Math.max(0, cents(price) - cents(cap));
  return { cap, status: excess ? 'OVER_CAP' : 'PASS', excess: dollars(excess) };
}

export function monthlyPayment(principal, annualRate, months) {
  requireRange(principal, 0, Number.MAX_SAFE_INTEGER, 'Loan amount');
  requireRange(annualRate, 0, 30, 'Interest rate');
  requireRange(months, 1, 360, 'Loan term in months');
  if (!Number.isInteger(months)) throw new RangeError('Use a whole number of months.');
  if (annualRate === 0) return principal / months;

  const monthlyRate = annualRate / 1200;
  if (monthlyRate === 0) return principal / months;
  return principal * (monthlyRate / -Math.expm1(-months * Math.log1p(monthlyRate)));
}

// Illustrative GST-inclusive premiums in basis points of the base loan.
const lmiBands = [[80, 0], [85, 65], [88, 120], [90, 200], [92, 300], [94, 370], [95, 415]];

export function estimateLmi({ principal, price, region, annualRate, months }) {
  const { dutyPercent } = regionRules(region);
  requireRange(price, .01, 100000000, 'Purchase price');
  const basePayment = monthlyPayment(principal, annualRate, months);
  const loanCents = cents(principal);
  const priceCents = cents(price);
  const band = lmiBands.find(([ceiling]) => loanCents * 100 <= priceCents * ceiling);
  if (!band) throw new RangeError('The LMI estimate supports loans up to 95% LVR.');

  const rate = band[1] / 10000;
  const premiumCents = Math.round(loanCents * band[1] / 10000);
  const dutyCents = dutyPercent === null && premiumCents > 0
    ? null
    : Math.round(premiumCents * (dutyPercent ?? 0) / 100);
  const upfrontCents = dutyCents === null ? null : premiumCents + dutyCents;
  const upfront = upfrontCents === null ? null : dollars(upfrontCents);
  const capitalisedPrincipal = upfront === null ? null : dollars(loanCents + upfrontCents);
  const extraInterest = upfront === null ? null
    : annualRate === 0 ? 0
    : dollars(cents(Math.max(0, monthlyPayment(upfront, annualRate, months) * months - upfront)));

  return {
    rate, dutyPercent, premium: dollars(premiumCents),
    duty: dutyCents === null ? null : dollars(dutyCents),
    upfront, capitalisedPrincipal, extraInterest,
    monthlyUpfront: basePayment,
    monthlyCapitalised: capitalisedPrincipal === null
      ? null
      : monthlyPayment(capitalisedPrincipal, annualRate, months)
  };
}

export function projectWait({ price, saved, monthlySavings, annualGrowth, weeklyRent }) {
  requireRange(price, .01, 100000000, 'Purchase price');
  requireRange(saved, 0, 100000000, 'Saved deposit');
  requireRange(monthlySavings, 0, 1000000, 'Monthly savings');
  requireRange(annualGrowth, -30, 30, 'Home price growth');
  requireRange(weeklyRent, 0, 100000, 'Weekly rent');

  const priceCents = cents(price);
  const savedCents = cents(saved);
  const monthlySavingsCents = cents(monthlySavings);
  const gapToday = dollars(Math.max(0, Math.ceil(priceCents / 5) - savedCents));
  for (let months = 0; months <= WAIT_LIMIT_MONTHS; months++) {
    const futurePriceCents = Math.max(1, Math.round(priceCents * (1 + annualGrowth / 100) ** (months / 12)));
    const depositCents = Math.ceil(futurePriceCents / 5);
    const availableCents = savedCents + monthlySavingsCents * months;
    if (availableCents >= depositCents) {
      return {
        months, gapToday,
        futurePrice: dollars(futurePriceCents),
        priceChange: dollars(futurePriceCents - priceCents),
        requiredDeposit: dollars(depositCents),
        savingsAtTarget: dollars(availableCents),
        futureLoan: dollars(futurePriceCents - depositCents),
        rentPaid: dollars(Math.round(cents(weeklyRent) * 52 * months / 12))
      };
    }
  }
  return { months: null, gapToday };
}

export function comparePaths(inputs) {
  const { region, price, saved, depositPercent, annualRate, years } = inputs;
  const capCheck = checkPriceCap(region, price);
  const wait = projectWait(inputs);
  requireRange(depositPercent, 5, 19.9, 'Deposit percentage');
  if (Math.abs(depositPercent * 10 - Math.round(depositPercent * 10)) > 1e-9) {
    throw new RangeError('Use a deposit in steps of 0.1 percentage point.');
  }
  requireRange(years, 1, 30, 'Loan term');
  if (!Number.isInteger(years)) throw new RangeError('Use a whole number of years.');

  const months = years * 12;
  const priceCents = cents(price);
  const depositCents = Math.ceil(priceCents * Math.round(depositPercent * 10) / 1000);
  const principal = dollars(priceCents - depositCents);
  const payment = monthlyPayment(principal, annualRate, months);
  const withinCap = capCheck.status === 'PASS';

  return {
    deposit: dollars(depositCents), principal,
    lvr: (priceCents - depositCents) * 100 / priceCents,
    depositShortfall: dollars(Math.max(0, depositCents - cents(saved))),
    scheme: { ...capCheck, lmi: withinCap ? 0 : null, monthlyPayment: withinCap ? payment : null },
    standard: estimateLmi({ principal, price, region, annualRate, months }),
    wait: {
      ...wait,
      monthlyPayment: wait.months === null ? null : monthlyPayment(wait.futureLoan, annualRate, months)
    }
  };
}
