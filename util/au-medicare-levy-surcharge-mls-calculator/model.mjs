function decimal(value, label, places = 2, max = 10_000_000) {
  const match = /^(\d{0,8})(?:\.(\d{1,6}))?$/.exec(String(value ?? '').trim());
  if (!match || (!match[1] && !match[2]) || (match[2]?.length ?? 0) > places) {
    throw new RangeError(label + ' must be a nonnegative number with at most ' + places + ' decimal places.');
  }
  const scale = 10 ** places;
  const units = Number(match[1]) * scale + Number((match[2] ?? '').padEnd(places, '0'));
  if (units > max * scale) throw new RangeError(label + ' must be at most ' + max + '.');
  return units;
}

// Round positive rational amounts to the nearest cent, with ties rounded up.
function rounded(numerator, denominator) {
  return Number((2n * numerator + denominator) / (2n * denominator));
}

export function calculate(input) {
  if (!['single', 'family'].includes(input.status)) throw new RangeError('Choose single or family thresholds.');
  const children = decimal(input.children, 'MLS dependent children', 0, 30);
  const family = input.status === 'family';
  if (!family && children) throw new RangeError('Choose family thresholds when you have MLS dependent children.');
  const income = decimal(input.income, 'Income for the MLS tier test');
  const base = String(input.base ?? '').trim() === '' ? income : decimal(input.base, 'Amount subject to MLS');
  const premium = decimal(input.premium, 'Annual hospital cover premium');
  const adjustment = family ? 1500 * Math.max(0, children - 1) : 0;
  const thresholds = [105000, 123000, 164000].map(amount => (amount * (family ? 2 : 1) + adjustment) * 100);
  const tier = thresholds.filter(max => income > max).length;
  const rate = [0, 100, 125, 150][tier];
  const liability = rounded(BigInt(base) * BigInt(rate), 10000n);
  return {tier, rate, thresholds, liability, premiumDifference: premium - liability};
}
