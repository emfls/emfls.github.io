export const TAX_YEAR = 2026;
export const QCD_CAP = 111_000;

// IRS Publication 590-B, Appendix B, Table III, starting at age 72.
const UNIFORM_DIVISORS = [
  27.4, 26.5, 25.5, 24.6, 23.7, 22.9, 22.0, 21.1, 20.2, 19.4,
  18.5, 17.7, 16.8, 16.0, 15.2, 14.4, 13.7, 12.9, 12.2, 11.5,
  10.8, 10.1, 9.5, 8.9, 8.4, 7.8, 7.3, 6.8, 6.4, 6.0,
  5.6, 5.2, 4.9, 4.6, 4.3, 4.1, 3.9, 3.7, 3.5, 3.4,
  3.3, 3.1, 3.0, 2.9, 2.8, 2.7, 2.5, 2.3, 2.0,
];

const ACCOUNTS = ['ira', '401k', 'rothIra', 'roth401k'];
const TAX_THRESHOLDS = {
  single: [0, 12_400, 50_400, 105_700, 201_775, 256_225, 640_600],
  mfj: [0, 24_800, 100_800, 211_400, 403_550, 512_450, 768_700],
};
const TAX_RATES = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const IRMAA_CEILINGS = {
  single: [109_000, 137_000, 171_000, 205_000, 500_000],
  mfj: [218_000, 274_000, 342_000, 410_000, 750_000],
};
// CMS monthly surcharges in cents per person, excluding base premiums.
const PART_B = [0, 8120, 20290, 32460, 44630, 48700];
const PART_D = [0, 1450, 3750, 6040, 8330, 9100];

function dateParts(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError('Enter a complete calendar date.');
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError('Enter a valid calendar date.');
  }
  return value.split('-').map(Number);
}

function requireAmount(value) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Enter a nonnegative amount.');
}

function requireAccount(value) {
  if (!ACCOUNTS.includes(value)) throw new RangeError('Select a supported account type.');
}

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function rmdStartAge(birthDate) {
  const [year] = dateParts(birthDate);
  if (birthDate < '1949-07-01') return 70.5;
  if (year <= 1950) return 72;
  // Treasury's proposed interpretation sets the applicable age for 1959 at 73.
  return year <= 1959 ? 73 : 75;
}

export function uniformDivisor(age) {
  if (!Number.isInteger(age) || age < 72) return null;
  return UNIFORM_DIVISORS[Math.min(age, 120) - 72];
}

export function rmdForYear({ birthDate, accountType, balance, jointTable = false }, year) {
  requireAccount(accountType);
  requireAmount(balance);
  if (!Number.isInteger(year) || year < TAX_YEAR) throw new RangeError('Use 2026 or a later year.');

  const [birthYear, birthMonth] = dateParts(birthDate);
  const startAge = rmdStartAge(birthDate);
  const age = year - birthYear;
  if (age < 0) throw new RangeError('Birth date must precede the distribution year.');
  if (accountType.startsWith('roth')) {
    return { age, startAge: null, firstYear: null, divisor: null, amount: 0, deadline: null };
  }

  const firstYear = birthYear + Math.floor(startAge) + Number(startAge === 70.5 && birthMonth > 6);
  if (year < firstYear) return { age, startAge, firstYear, divisor: null, amount: 0, deadline: null };
  const deadline = year === firstYear ? `${year + 1}-04-01` : `${year}-12-31`;
  const divisor = jointTable ? null : uniformDivisor(age);
  return { age, startAge, firstYear, divisor, amount: divisor === null ? null : balance / divisor, deadline };
}

export function qcdEligibilityDate(birthDate) {
  const [year, month, day] = dateParts(birthDate);
  const targetMonth = (month + 5) % 12 + 1;
  const targetYear = year + 70 + Number(month > 6);
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export function calculateQcd({ birthDate, accountType, giftDate, gift, priorQcd = 0, offset = 0 }) {
  requireAccount(accountType);
  [gift, priorQcd, offset].forEach(requireAmount);
  if (dateParts(giftDate)[0] !== TAX_YEAR) throw new RangeError('Enter a gift date in 2026.');

  const eligibleDate = qcdEligibilityDate(birthDate);
  const eligible = accountType === 'ira' && giftDate >= eligibleDate;
  const remainingCap = Math.max(0, QCD_CAP - priorQcd);
  const excluded = eligible ? roundMoney(Math.max(0, Math.min(gift, remainingCap) - offset)) : 0;
  return { eligible, eligibleDate, remainingCap, excluded, taxable: roundMoney(gift - excluded) };
}

export function calculatePenalty(rmd, otherDistributions, plannedRmdPayment) {
  [rmd, otherDistributions, plannedRmdPayment].forEach(requireAmount);
  const remaining = Math.max(0, rmd - otherDistributions);
  const applied = Math.min(remaining, plannedRmdPayment);
  const shortfall = roundMoney(Math.max(0, remaining - plannedRmdPayment));
  return {
    qcdApplied: roundMoney(applied),
    shortfall,
    standard: roundMoney(shortfall * 0.25),
    corrected: roundMoney(shortfall * 0.10),
  };
}

export function federalOrdinaryTax(taxableIncome, filing) {
  if (!Number.isFinite(taxableIncome) || !Object.hasOwn(TAX_THRESHOLDS, filing)) {
    throw new RangeError('Enter taxable income and select Single or Married filing jointly.');
  }

  const thresholds = TAX_THRESHOLDS[filing];
  return thresholds.reduce((tax, lower, index) => {
    const upper = thresholds[index + 1] ?? Infinity;
    return tax + Math.max(0, Math.min(taxableIncome, upper) - lower) * TAX_RATES[index];
  }, 0);
}

export function compareQcdIncomeTax({ filing, ordinaryIncome, gift, excluded, stateRate }) {
  [gift, excluded, stateRate].forEach(requireAmount);
  if (excluded > gift || stateRate > 100) throw new RangeError('Check the gift amount and state tax rate.');
  const federal = roundMoney(federalOrdinaryTax(ordinaryIncome + gift, filing)
    - federalOrdinaryTax(ordinaryIncome + gift - excluded, filing));
  const state = roundMoney(excluded * stateRate / 100);
  return { federal, state, total: roundMoney(federal + state) };
}

export function compareIrmaa({ filing, partB, partD, withQcd, withoutQcd }) {
  const maxEnrollees = filing === 'mfj' ? 2 : 1;
  if (!Object.hasOwn(IRMAA_CEILINGS, filing)
    || ![partB, partD].every((count) => Number.isInteger(count) && count >= 0 && count <= maxEnrollees)
    || ![withQcd, withoutQcd].every(Number.isFinite) || withQcd > withoutQcd) {
    throw new RangeError('Check the Medicare enrollment counts and income amounts.');
  }

  function tier(magi) {
    const ceilings = IRMAA_CEILINGS[filing];
    if (magi >= ceilings[4]) return 5;
    return ceilings.slice(0, 4).filter((ceiling) => magi > ceiling).length;
  }

  const beforeTier = tier(withoutQcd);
  const afterTier = tier(withQcd);
  const annualCents = (level) => 12 * (partB * PART_B[level] + partD * PART_D[level]);
  const before = annualCents(beforeTier);
  const after = annualCents(afterTier);
  return { beforeTier, afterTier, before: before / 100, after: after / 100, saved: (before - after) / 100 };
}

export function projectRmd(account, growthRate) {
  if (!Number.isFinite(growthRate) || growthRate < -100 || growthRate > 100) {
    throw new RangeError('Enter an annual return between −100% and 100%.');
  }

  const rows = [];
  let balance = account.balance;
  for (let year = TAX_YEAR; year < TAX_YEAR + 10; year += 1) {
    if (balance === null) break;
    const rmd = rmdForYear({ ...account, balance }, year);
    // Grow the opening balance, then pay the RMD at year-end. A large loss can exhaust the account.
    balance = rmd.amount === null ? null : Math.max(0, balance * (1 + growthRate / 100) - rmd.amount);
    rows.push({ year, ...rmd, endingBalance: balance });
  }
  return rows;
}
