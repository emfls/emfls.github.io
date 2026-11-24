const RATE_DENOMINATOR = 1_200_000_000n;
const usd = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});

function amortize(principal, rate, months) {
  if (rate === 0n) {
    return {payment: principal, divisor: BigInt(months), interest: () => 0n};
  }
  // With P/Q = 1 + monthly rate, the balance after k payments is
  // principal * (P^n - P^k Q^(n-k)) / (P^n - Q^n).
  const q = RATE_DENOMINATOR;
  const p = q + rate;
  const end = p ** BigInt(months);
  const start = q ** BigInt(months);
  let previous = start;
  const divisor = q * (end - start);
  const payment = principal * rate * end;
  return {
    payment,
    divisor,
    interest(month) {
      previous = previous / q * p;
      return BigInt(month) * payment - principal * q * (previous - start);
    }
  };
}

function roundCents(numerator, denominator) {
  const magnitude = numerator < 0n ? -numerator : numerator;
  const cents = Number((2n * magnitude + denominator) / (2n * denominator));
  return numerator < 0n && cents !== 0 ? -cents : cents;
}

export function compareMortgage({principal, baseRate, points, reduction, months, holding}) {
  if (![principal, baseRate, points, reduction, months, holding].every(Number.isSafeInteger) ||
      principal < 1 || principal > 1_000_000_000 || baseRate < 0 || baseRate > 25_000 ||
      points < 0 || points > 10_000 || reduction < 0 || reduction > 10_000 ||
      months < 12 || months > 480 || holding < 0 || holding > months) {
    throw new RangeError('Enter a valid loan, rates, points and holding period within the loan term.');
  }
  const baseTicks = BigInt(baseRate) * 1000n;
  const discountTicks = BigInt(points) * BigInt(reduction);
  if (discountTicks > baseTicks) throw new RangeError('The discounted rate cannot be below 0%.');

  const base = amortize(BigInt(principal), baseTicks, months);
  const bought = amortize(BigInt(principal), baseTicks - discountTicks, months);
  // Each point costs 1% of principal. The closing cost is actually charged in cents.
  const cost = roundCents(BigInt(principal) * BigInt(points), 100_000n);
  const divisor = base.divisor * bought.divisor;
  const paymentDifference = base.payment * bought.divisor - bought.payment * base.divisor;
  const target = BigInt(cost) * divisor;
  let cashMonth = cost === 0 ? 0 : null;
  let exitMonth = cashMonth;
  let interestSaved = 0;
  for (let month = 1; month <= months; month += 1) {
    const difference = base.interest(month) * bought.divisor - bought.interest(month) * base.divisor;
    if (month === holding) interestSaved = roundCents(difference, divisor);
    if (cashMonth === null && BigInt(month) * paymentDifference >= target) cashMonth = month;
    if (exitMonth === null && difference >= target) exitMonth = month;
    if (month >= holding && cashMonth !== null && exitMonth !== null) break;
  }
  return {
    rateTicks: Number(baseTicks - discountTicks),
    cost,
    basePayment: roundCents(base.payment, base.divisor),
    boughtPayment: roundCents(bought.payment, bought.divisor),
    paymentSaving: roundCents(paymentDifference, divisor),
    cashMonth,
    exitMonth,
    interestSaved,
    cashNet: roundCents(BigInt(holding) * paymentDifference - target, divisor),
    exitNet: interestSaved - cost
  };
}

function scaled(value, places, label) {
  const match = /^(\d{1,8})(?:\.(\d{1,3}))?$/.exec(value?.trim());
  if (!match || (match[2]?.length ?? 0) > places) {
    throw new RangeError(`Enter ${label} with at most ${places} decimal places.`);
  }
  return Number(match[1]) * 10 ** places + Number((match[2] ?? '').padEnd(places, '0'));
}

export function calculate(input) {
  const result = compareMortgage({
    principal: scaled(input.principal, 2, 'the loan amount'),
    baseRate: scaled(input.baseRate, 3, 'the base rate'),
    points: scaled(input.points, 3, 'points'),
    reduction: scaled(input.reduction, 3, 'the rate reduction'),
    months: 12 * scaled(input.years, 0, 'loan term'),
    holding: scaled(input.holding, 0, 'holding months')
  });
  const monthText = month => month === null ? 'Beyond the loan term' : `Month ${month}`;
  return Object.fromEntries(Object.entries(result).map(([key, value]) => {
    if (key === 'rateTicks') return [key, `${value / 1_000_000}%`];
    if (key === 'cashMonth' || key === 'exitMonth') return [key, monthText(value)];
    return [key, usd.format(value / 100)];
  }));
}
