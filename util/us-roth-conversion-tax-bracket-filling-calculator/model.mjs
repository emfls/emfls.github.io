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

const RATES = [10n, 12n, 22n, 24n, 32n, 35n, 37n];
const SCHEDULES = new Map([
  ['single', [16_100n, [12_400n, 50_400n, 105_700n, 201_775n, 256_225n, 640_600n]]],
  ['joint', [32_200n, [24_800n, 100_800n, 211_400n, 403_550n, 512_450n, 768_700n]]],
  ['hoh', [24_150n, [17_700n, 67_450n, 105_700n, 201_750n, 256_200n, 640_600n]]]
]);

// Keep hundredths of a cent until the incremental tax is determined.
export function taxNumerator(status, income) {
  const [, ceilings] = SCHEDULES.get(status);
  let lower = 0n;
  let tax = 0n;
  for (const [index, rate] of RATES.entries()) {
    const ceiling = index < ceilings.length ? ceilings[index] * 100n : income;
    const upper = min(ceiling, income);
    tax += (upper - lower) * rate;
    if (upper === income) break;
    lower = upper;
  }
  return tax;
}

export function calculate({status, income, incomeType, balance, target, years, growth, futureRate}) {
  if (!SCHEDULES.has(status)) throw new RangeError('Choose a supported filing status.');
  if (!['agi', 'taxable'].includes(incomeType)) throw new RangeError('Choose an income type.');
  const targetIndex = RATES.findIndex(rate => String(rate) === target);
  if (targetIndex < 0) throw new RangeError('Choose a target marginal rate.');
  const preConversion = decimal(income, 'pre-conversion income');
  const available = decimal(balance, 'available pretax IRA balance');
  const yearsToGrow = BigInt(integer(years, 'number of years', 0, 60));
  const growthRate = decimal(growth, 'annual growth rate', 10_000n);
  const withdrawalRate = decimal(futureRate, 'future withdrawal tax rate', 10_000n);
  const [deductionDollars, ceilings] = SCHEDULES.get(status);
  const deduction = deductionDollars * 100n;
  const net = preConversion - (incomeType === 'agi' ? deduction : 0n);
  const ceiling = ceilings[targetIndex];
  const room = ceiling === undefined ? null : positive(ceiling * 100n - net);
  const conversion = room === null ? available : min(available, room);
  const incremental = taxNumerator(status, positive(net + conversion)) - taxNumerator(status, positive(net));
  const tax = round(incremental, 100n);
  const growthNumerator = (10_000n + growthRate) ** yearsToGrow;
  const growthDenominator = 10_000n ** yearsToGrow;
  const roth = round((conversion - tax) * growthNumerator, growthDenominator);
  const traditional = round(conversion * growthNumerator * (10_000n - withdrawalRate), growthDenominator * 10_000n);

  return {
    deduction: incomeType === 'agi' ? formatMoney(deduction) : 'Already reflected',
    taxable: formatMoney(positive(net)),
    room: room === null ? 'No ceiling' : formatMoney(room),
    conversion: formatMoney(conversion),
    tax: formatMoney(tax),
    effective: percent(incremental, conversion * 100n),
    futureRoth: formatMoney(roth),
    futureTraditional: formatMoney(traditional)
  };
}
