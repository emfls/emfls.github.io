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

export const ADDITIONS_LIMIT = 7_200_000;
export const REGULAR_LIMIT = 2_450_000;
export const COMPENSATION_LIMIT = 36_000_000;

export function catchUpLimit(age) {
  if (!Number.isInteger(age) || age < 0 || age > 120) {
    throw new RangeError('Enter a whole-number age from 0 to 120.');
  }
  if (age < 50) return 0;
  return age >= 60 && age <= 63 ? 1_125_000 : 800_000;
}

export function calculateRoom(input) {
  const {age, salary, deferred, employer, employerRate, catchUp, afterTax, inPlan, inService} = input;
  [salary, deferred, employer].forEach(checkAmount);
  if (deferred > Math.min(REGULAR_LIMIT, salary)) {
    throw new RangeError('Regular deferrals cannot exceed pay or $24,500. Exclude catch-up contributions.');
  }
  if (!Number.isInteger(employerRate) || employerRate < 0 || employerRate > BPS) {
    throw new RangeError('Enter an employer contribution rate from 0% to 100%.');
  }

  const eligiblePay = Math.min(salary, COMPENSATION_LIMIT);
  const employerAdditions = employer + roundBps(eligiblePay * employerRate);
  const baseCeiling = Math.min(salary, ADDITIONS_LIMIT);
  const remaining = baseCeiling - deferred - employerAdditions;
  const ageLimit = catchUpLimit(age);
  const catchUpRoom = catchUp ? ageLimit : 0;
  const eligible = afterTax && (inPlan || inService);
  return {
    eligible, eligiblePay, employer: employerAdditions, baseCeiling,
    catchUp: catchUpRoom, statutoryTotal: ADDITIONS_LIMIT + catchUpRoom,
    room: Math.max(0, remaining), available: eligible ? Math.max(0, remaining) : 0,
    excess: Math.max(0, -remaining),
  };
}
