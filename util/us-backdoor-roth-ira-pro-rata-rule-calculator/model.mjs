const whole = new Intl.NumberFormat('en-US');

function decimal(value, label, limit = 100_000_000_000n) {
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError(`Enter a nonnegative ${label} with up to two decimal places, without commas or symbols.`);
  const scaled = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
  if (scaled > limit) throw new RangeError(`The ${label} exceeds the supported maximum (${whole.format(limit / 100n)}).`);
  return scaled;
}

function integer(value, label, min, max) {
  const digits = value.trim();
  const result = Number(digits);
  if (!/^\d{1,4}$/.test(digits) || result < min || result > max) {
    throw new RangeError(`Enter a whole ${label} from ${min} to ${max}.`);
  }
  return result;
}

const round = (numerator, denominator) => (numerator + denominator / 2n) / denominator;
const min = (a, b) => a < b ? a : b;
const positive = value => value > 0n ? value : 0n;
const fixed = value => `${whole.format(value / 100n)}.${String(value % 100n).padStart(2, '0')}`;
export const formatMoney = cents => `$${fixed(cents)}`;
const percent = (part, total) => total === 0n ? 'N/A' : `${fixed(round(part * 10_000n, total))}%`;

const PHASE_OUT = new Map([
  ['single', [15_300_000n, 16_800_000n]],
  ['joint', [24_200_000n, 25_200_000n]]
]);

export function calculate({basis, yearEnd, outstanding, distributions, conversion, rate, age, status, magi}) {
  if (!PHASE_OUT.has(status)) throw new RangeError('Choose a supported filing status.');
  const eligibleBasis = decimal(basis, 'Form 8606 line 5 basis');
  const balance = decimal(yearEnd, 'year-end IRA balance');
  const inTransit = decimal(outstanding, 'outstanding IRA rollover amount');
  const other = decimal(distributions, 'other distribution amount');
  const converted = decimal(conversion, 'net conversion amount');
  const marginal = decimal(rate, 'marginal tax rate', 10_000n);
  const yearsOld = integer(age, 'age', 0, 130);
  const modifiedIncome = decimal(magi, 'modified adjusted gross income');
  const total = balance + inTransit + other + converted;
  const basisUsed = min(eligibleBasis, total);
  const exempt = total === 0n ? 0n : round(converted * basisUsed, total);
  const taxable = converted - exempt;

  const rollover = min(balance, positive(total - eligibleBasis));
  const reducedTotal = total - rollover;
  const exemptAfter = reducedTotal === 0n ? 0n : round(converted * min(eligibleBasis, reducedTotal), reducedTotal);
  const taxableAfter = converted - exemptAfter;

  const [lower, upper] = PHASE_OUT.get(status);
  let direct = 'No MAGI reduction';
  if (modifiedIncome > lower) direct = 'Phase-out range';
  if (modifiedIncome >= upper) direct = 'No direct contribution';
  return {
    denominator: formatMoney(total),
    ratio: percent(basisUsed, total),
    nonTaxable: formatMoney(exempt),
    taxable: formatMoney(taxable),
    tax: formatMoney(round(taxable * marginal, 10_000n)),
    rollover: formatMoney(rollover),
    afterTaxable: formatMoney(taxableAfter),
    afterTax: formatMoney(round(taxableAfter * marginal, 10_000n)),
    limit: formatMoney(750_000n + (yearsOld >= 50 ? 110_000n : 0n)),
    direct
  };
}
