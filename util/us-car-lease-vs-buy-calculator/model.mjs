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

const ratio = (cents, units, denominator = 10000n) => rounded(BigInt(cents) * BigInt(units), denominator);

function amortize(principal, apr, term, months) {
  const rate = BigInt(apr);
  const divisor = 120000n;
  const growth = (divisor + rate) ** BigInt(term);
  const payment = rate === 0n ? ratio(principal, 1, BigInt(term)) :
    rounded(BigInt(principal) * rate * growth, divisor * (growth - divisor ** BigInt(term)));
  let balance = principal;
  let paid = 0;
  for (let month = 1; month <= Math.min(months, term) && balance > 0; month++) {
    const due = balance + ratio(balance, apr, divisor);
    const instalment = month === term ? due : Math.min(due, payment);
    paid += instalment;
    balance = due - instalment;
  }
  return {payment, balance, paid};
}

export function calculate(input) {
  const months = decimal(input.months, 'Comparison horizon', 0, 60);
  if (![36, 60].includes(months)) throw new RangeError('Choose a 36- or 60-month comparison horizon.');
  const term = decimal(input.loanTerm, 'Loan term', 0, 120);
  if (!term) throw new RangeError('Loan term must be at least one month.');
  const price = decimal(input.price, 'Negotiated price');
  const msrp = decimal(input.msrp, 'MSRP');
  if (!price || !msrp) throw new RangeError('MSRP and negotiated price must be positive.');
  const acquisition = decimal(input.acquisition, 'Acquisition fee');
  const leaseDown = decimal(input.leaseDown, 'Lease down payment');
  const trade = decimal(input.trade, 'Lease trade-in equity');
  const rebate = decimal(input.rebate, 'Lease rebate');
  const factor = decimal(input.factor, 'Money factor', 6, 0.05);
  const cap = price + acquisition - leaseDown - trade - rebate;
  const residual = ratio(msrp, decimal(input.residual, 'Residual percentage', 2, 100));
  if (cap < residual) throw new RangeError('Residual value exceeds the adjusted lease cap cost.');
  const depreciation = ratio(cap - residual, 1, BigInt(months));
  const rent = ratio(cap + residual, factor, 1_000_000n);
  const tax = decimal(input.leaseTax, 'Lease sales tax rate', 2, 100);
  const withTax = payment => payment + ratio(payment, tax);
  const leasePayment = withTax(depreciation + rent);
  let leasePayments = 0;
  let allocated = 0;
  for (let month = 1; month <= months; month++) {
    const cumulativeDepreciation = ratio(cap - residual, month, BigInt(months));
    leasePayments += withTax(cumulativeDepreciation - allocated + rent);
    allocated = cumulativeDepreciation;
  }
  const leaseCost = leasePayments + leaseDown + trade + decimal(input.disposition, 'Disposition fee') +
    decimal(input.leaseOther, 'Other lease costs');

  const buyDown = decimal(input.buyDown, 'Purchase down payment or trade equity');
  const buyTax = ratio(price, decimal(input.buyTax, 'Purchase sales tax rate', 2, 100));
  const principal = price + buyTax + decimal(input.buyFees, 'Financed purchase fees') - buyDown;
  if (principal < 0) throw new RangeError('Purchase down payment exceeds purchase price, tax and fees.');
  const loan = amortize(principal, decimal(input.apr, 'Loan APR', 2, 100), term, months);
  const equity = decimal(input.resale, 'Resale value') - loan.balance;
  const buyCost = buyDown + loan.paid + decimal(input.buyOther, 'Other purchase costs') - equity;
  return {
    cap, residual, depreciation, rent, leasePayment, leaseCost, principal,
    loanPayment: loan.payment, balance: loan.balance, equity, buyCost,
    costDifference: leaseCost - buyCost, aprEquivalentBps: ratio(factor, 24, 100n),
  };
}
