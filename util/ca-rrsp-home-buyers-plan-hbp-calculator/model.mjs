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

function participant(withdrawal, paid, deduction, rate) {
  let balance = withdrawal;
  const schedule = [];
  for (let years = 15; years > 0; years--) {
    const minimum = rounded(BigInt(balance), BigInt(years));
    schedule.push(minimum);
    // An income inclusion reduces the HBP balance just like a designated payment.
    balance -= years === 15 ? Math.max(minimum, paid) : minimum;
  }
  const shortfall = Math.max(0, schedule[0] - paid);
  return {
    schedule, balance, shortfall,
    tax: rounded(BigInt(shortfall) * BigInt(rate), 10000n),
    refund: rounded(BigInt(deduction) * BigInt(rate), 10000n),
  };
}

export function calculate(input) {
  const year = decimal(input.year, 'First withdrawal year', 0, 2099);
  if (year < 2020) throw new RangeError('Enter a first withdrawal year from 2020 through 2099.');
  const limit = year < 2024 || (year === 2024 && input.beforeApr16 === 'yes') ? 3500000 : 6000000;
  const withdrawal = decimal(input.withdrawal, 'Your withdrawal');
  const partner = decimal(input.partner, 'Partner withdrawal');
  if (withdrawal > limit || partner > limit) throw new RangeError('Each withdrawal must stay within the individual limit.');
  if (withdrawal + partner === 0) throw new RangeError('Enter a positive HBP withdrawal.');
  const paid = decimal(input.paid, 'Your first-year repayment');
  const partnerPaid = decimal(input.partnerPaid, 'Partner first-year repayment');
  if (paid > withdrawal || partnerPaid > partner) throw new RangeError('Each repayment must be no greater than its own withdrawal.');
  const first = participant(withdrawal, paid, decimal(input.deduction, 'Your deductible contribution'),
    decimal(input.rate, 'Your marginal tax rate', 2, 100));
  const second = participant(partner, partnerPaid, decimal(input.partnerDeduction, 'Partner deductible contribution'),
    decimal(input.partnerRate, 'Partner marginal tax rate', 2, 100));
  const start = year + (year >= 2022 && year <= 2028 ? 5 : 2);
  const schedule = first.schedule.map((amount, i) => ({year: start + i, first: amount, second: second.schedule[i]}));
  return {
    limit, householdLimit: 2 * limit, start, end: start + 14, standardStart: year + 2,
    firstMinimum: schedule[0].first + schedule[0].second, schedule,
    line12900: first.shortfall + second.shortfall, tax: first.tax + second.tax,
    refund: first.refund + second.refund, remainingAfterSchedule: first.balance + second.balance,
  };
}
