const lifetimeLimit = 3_500_000;
const baseAnnualLimit = 750_000;
const catchUp = 110_000;

export function parseCents(value) {
  const match = /^([0-9]+)(?:\.([0-9]{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError('Enter a nonnegative dollar amount with at most two decimal places.');
  const cents = Number(match[1] + (match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new RangeError('Dollar amount is outside the calculation range.');
  return cents;
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function calculateRollover({
  opened, transfer, balance, recent, prior, earned, direct, earlierThisYear = 0,
  age50 = false, confirmed = false,
}) {
  if (![balance, recent, prior, earned, direct, earlierThisYear].every(value =>
        Number.isSafeInteger(value) && value >= 0) ||
      recent > balance || earlierThisYear > prior || !isDate(opened) || opened < '1996-01-01' ||
      !isDate(transfer) || !transfer.startsWith('2026-') || opened > transfer ||
      typeof age50 !== 'boolean' || typeof confirmed !== 'boolean') {
    throw new RangeError('Check the 529 dates, balance and IRA amounts.');
  }

  // Compare full calendar dates. A February 29 anniversary falls after February 28 in a non-leap year.
  const anniversary = String(Number(opened.slice(0, 4)) + 15) + opened.slice(4);
  const ageEligible = transfer >= anniversary;
  const eligibleBalance = balance - recent;
  const lifetimeRoom = Math.max(0, lifetimeLimit - prior);
  const annualLimit = baseAnnualLimit + (age50 ? catchUp : 0);
  const futureRoom = Math.max(0, Math.min(annualLimit, earned) - direct);
  const annualRoom = Math.max(0, futureRoom - earlierThisYear);
  const qualified = ageEligible && confirmed;
  const target = qualified ? Math.min(eligibleBalance, lifetimeRoom) : 0;
  const current = Math.min(target, annualRoom);
  const schedule = [];

  if (target > 0) {
    let remaining = target;
    for (let year = 2026; year <= 2035 && remaining > 0; year++) {
      const amount = year === 2026 ? current : Math.min(remaining, futureRoom);
      if (year !== 2026 && amount === 0) break;
      remaining -= amount;
      schedule.push({year, amount, cumulative: target - remaining, remaining});
    }
  }

  const remaining = target - (schedule.at(-1)?.cumulative ?? 0);
  return {ageEligible, qualified, eligibleBalance, lifetimeRoom, annualLimit, annualRoom,
    current, target, schedule, remaining};
}
