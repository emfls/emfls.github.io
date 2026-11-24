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

const FRA = 67 * 12;

// All three statutory fractions share an exact denominator of 3,600.
export function benefitCents(pia, claimMonth) {
  if (!Number.isSafeInteger(pia) || pia < 0 || pia > 10_000_000 || !Number.isInteger(claimMonth) ||
      claimMonth < 62 * 12 || claimMonth > 70 * 12) {
    throw new RangeError('Use integer cents and a claim age from 62 through 70.');
  }
  const early = Math.max(0, FRA - claimMonth);
  const delayed = Math.max(0, claimMonth - FRA);
  const fraction = 3600 - 20 * Math.min(early, 36) - 15 * Math.max(0, early - 36) + 24 * delayed;
  return rounded(BigInt(pia) * BigInt(fraction), 3600n);
}

export function calculate(input) {
  const pia = decimal(input.pia, 'Full retirement age benefit', 2, 100_000);
  if (pia === 0) throw new RangeError('Enter a positive full retirement age benefit.');
  const cola = decimal(input.cola, 'Annual COLA', 2, 20);
  const discount = decimal(input.discount, 'Annual discount rate', 2, 20);
  if (!['nominal', 'present'].includes(input.mode)) throw new RangeError('Choose a comparison mode.');
  const claims = [62, 67, 70].map(age => age * 12);
  const benefits = claims.map(month => benefitCents(pia, month));
  const total = [0, 0, 0];
  const cross = [null, null];
  const growth = BigInt(10000 + cola);
  const discountFactor = BigInt(10000 + (input.mode === 'present' ? discount : 0));
  let annualNumerator = 1n;
  let annualDenominator = 1n;
  for (let month = claims[0]; month < 120 * 12; month++) {
    if (month > claims[0] && (month - claims[0]) % 12 === 0) {
      annualNumerator *= growth;
      annualDenominator *= discountFactor;
    }
    for (let i = 0; i < claims.length; i++) {
      if (month >= claims[i]) total[i] += rounded(BigInt(benefits[i]) * annualNumerator, annualDenominator);
    }
    for (let i = 0; i < cross.length; i++) {
      if (cross[i] === null && benefits[i + 1] > benefits[i] &&
          month >= claims[i + 1] && total[i + 1] >= total[i]) cross[i] = month + 1;
    }
  }
  return {benefits, cross62: cross[0], cross67: cross[1]};
}
