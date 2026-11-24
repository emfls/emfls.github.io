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
const positive = value => value > 0n ? value : 0n;
const fixed = value => `${whole.format(value / 100n)}.${String(value % 100n).padStart(2, '0')}`;
export const formatMoney = cents => `$${fixed(cents)}`;
const percent = (part, total) => total === 0n ? 'N/A' : `${fixed(round(part * 10_000n, total))}%`;

const YEAR = 2026;
const FACTORS = [
  274n, 265n, 255n, 246n, 237n, 229n, 220n, 211n, 202n, 194n, 185n,
  177n, 168n, 160n, 152n, 144n, 137n, 129n, 122n, 115n, 108n, 101n,
  95n, 89n, 84n, 78n, 73n, 68n, 64n, 60n, 56n, 52n, 49n, 46n, 43n,
  41n, 39n, 37n, 35n, 34n, 33n, 31n, 30n, 29n, 28n, 27n, 25n, 23n, 20n
];

export const divisor = age => FACTORS[Math.min(age, 120) - 72];

// Both 1949 birth cohorts had already begun by 2026.
export function firstYear(birth) {
  if (birth < 1949) return birth + 71;
  if (birth < 1951) return birth + 72;
  return birth + (birth < 1960 ? 73 : 75);
}

export function calculate({birth, balance, taken, growth}) {
  const born = integer(birth, 'birth year', 1896, YEAR);
  const lastBalance = decimal(balance, 'prior December 31 balance');
  const withdrawn = decimal(taken, '2026 distribution amount');
  const growthRate = decimal(growth, 'annual growth rate', 10_000n);
  const start = firstYear(born);
  const age = YEAR - born;
  const factor = divisor(age);
  const required = YEAR < start ? 0n : round(lastBalance * 10n, factor);
  const shortfall = positive(required - withdrawn);
  const projection = [];
  let priorBalance = lastBalance;
  for (let year = YEAR; year < YEAR + 5; year++) {
    const distribution = year < start ? 0n : round(priorBalance * 10n, divisor(year - born));
    projection.push([String(year), formatMoney(distribution)]);
    const paid = year === YEAR && withdrawn > distribution ? withdrawn : distribution;
    priorBalance = round(positive(priorBalance - paid) * (10_000n + growthRate), 10_000n);
  }
  let deadline = 'No 2026 RMD';
  if (YEAR === start) deadline = 'April 1, 2027 (first RMD)';
  if (YEAR > start) deadline = 'December 31, 2026';

  return {
    required: formatMoney(required),
    age: String(age),
    factor: factor ? `${factor / 10n}.${factor % 10n}` : 'N/A',
    withdrawal: percent(required, lastBalance),
    deadline,
    shortfall: formatMoney(shortfall),
    penalty: formatMoney(round(shortfall * 25n, 100n)),
    corrected: formatMoney(round(shortfall * 10n, 100n)),
    projection
  };
}
