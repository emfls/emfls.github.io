const HORIZONS = [5, 10, 15];
const FILINGS = new Map([
  ['mfj_single_750k', { current: 750000, legacy: null }],
  ['mfs_375k', { current: 375000, legacy: null }],
  ['grandfathered_1m', { current: 750000, legacy: 1000000 }],
  ['grandfathered_mfs_500k', { current: 375000, legacy: 500000 }]
]);

export function monthlyPayment(principal, annualRate, months) {
  if (principal === 0) return 0;
  const rate = annualRate / 1200;
  if (rate === 0) return principal / months;
  return principal * rate / -Math.expm1(-months * Math.log1p(rate));
}

export function loanSchedule(principal, annualRate, repayMonths, drawMonths = 0) {
  if (principal === 0) return [];
  const installment = monthlyPayment(principal, annualRate, repayMonths);
  const term = drawMonths + repayMonths;
  let balance = principal;
  return Array.from({ length: term }, (_, month) => {
    const opening = balance;
    const interest = opening * (annualRate / 1200);
    const payment = month < drawMonths ? interest : Math.min(installment, opening + interest);
    const principalPaid = month === term - 1 ? opening : payment - interest;
    balance = opening - principalPaid;
    return { opening, balance, interest, principalPaid, payment: interest + principalPaid };
  });
}

function validate(input) {
  const ranges = [
    ['homeValue', 'Home value', 0.01, 1e9], ['mortgageBalance', 'First mortgage balance', 0, 1e9],
    ['cashNeeded', 'Cash needed', 0, 1e9], ['maxCltv', 'Maximum LTV / CLTV', 80, 85],
    ['mortgageRate', 'First mortgage rate', 0, 50], ['taxRate', 'Marginal federal tax rate', 0, 37],
    ['helocRate', 'HELOC rate', 0, 50], ['refiRate', 'Refinance rate', 0, 50],
    ['helocCosts', 'HELOC closing costs', 0, 1e9], ['refiCostsPct', 'Refinance closing costs', 0, 30]
  ];
  for (const [key, label, min, max] of ranges) {
    const value = input[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${label} must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}.`);
    }
  }
  const terms = [
    ['mortgageYears', 'Mortgage term', input.mortgageBalance > 0 ? 1 : 0, 50],
    ['drawYears', 'HELOC draw period', 0, 30], ['repayYears', 'HELOC repayment period', 1, 40],
    ['refiYears', 'Refinance term', 1, 50]
  ];
  for (const [key, label, min, max] of terms) {
    const months = input[key] * 12;
    if (!Number.isFinite(months) || Math.abs(months - Math.round(months)) > 1e-7 || months < min || months > max * 12) {
      throw new RangeError(`${label} must be ${min} month${min === 1 ? '' : 's'} to ${max} years in whole-month increments.`);
    }
  }
  if (!FILINGS.has(input.filing) || !['yes', 'no'].includes(input.itemizing) ||
      !['substantial_home_improvement', 'personal_non_deductible'].includes(input.use)) {
    throw new RangeError('Select a valid tax scenario.');
  }
}

function cashFlowApr(principal, fees, payments) {
  const proceeds = principal - fees;
  if (proceeds <= 0) return null;
  if (fees === 0 && monthlyPresentValue(payments, 0) - principal < 1e-7) return 0;

  let low = 0;
  let high = 1;
  while (monthlyPresentValue(payments, high) > proceeds) high *= 2;
  for (let step = 0; step < 100; step++) {
    const mid = (low + high) / 2;
    if (monthlyPresentValue(payments, mid) > proceeds) low = mid;
    else high = mid;
  }
  return (low + high) / 2 * 1200;
}

function monthlyPresentValue(payments, rate) {
  let remaining = 0;
  for (let index = payments.length - 1; index >= 0; index--) {
    remaining = (remaining + payments[index]) / (1 + rate);
  }
  return remaining;
}

const paidOff = { opening: 0, balance: 0, interest: 0, principalPaid: 0, payment: 0 };

function deductibleInterest(first, added, mortgageRate, addedRate, limits, legacyActive, qualifies) {
  const firstLimit = legacyActive ? limits.legacy : limits.current;
  const firstEligible = Math.min(first, firstLimit);
  const addedEligible = qualifies ? Math.min(added, Math.max(0, limits.current - firstEligible)) : 0;
  return { first: firstEligible * (mortgageRate / 1200), added: addedEligible * (addedRate / 1200) };
}

function totals(rows, fees, months) {
  const result = { fees, interest: 0, deductible: 0, addedDeductible: 0, savings: 0 };
  for (const row of rows.slice(0, months)) {
    result.interest += row.interest;
    result.deductible += row.deductible;
    result.addedDeductible += row.addedDeductible;
    result.savings += row.savings;
  }
  return {
    ...result,
    nonDeductible: Math.max(0, result.interest - result.deductible),
    cost: fees + result.interest - result.savings,
    balance: rows[months - 1].balance
  };
}

function interestRow(interest, split, balance, input) {
  const deductible = input.itemizing === 'yes' ? Math.min(interest, split.first + split.added) : 0;
  return {
    interest, deductible, balance,
    addedDeductible: input.itemizing === 'yes' ? Math.min(deductible, split.added) : 0,
    savings: deductible * (input.taxRate / 100)
  };
}

export function calculate(input) {
  validate(input);
  const months = years => Math.round(years * 12);
  const remaining = months(input.mortgageYears);
  const draw = months(input.drawYears);
  const principal = input.mortgageBalance + input.cashNeeded;
  const first = loanSchedule(input.mortgageBalance, input.mortgageRate, remaining);
  const heloc = loanSchedule(input.cashNeeded, input.helocRate, months(input.repayYears), draw);
  const refi = loanSchedule(principal, input.refiRate, months(input.refiYears));
  const keepFees = input.cashNeeded > 0 ? input.helocCosts : 0;
  const refiFees = principal * (input.refiCostsPct / 100);
  const qualifies = input.use === 'substantial_home_improvement';
  const limits = FILINGS.get(input.filing);
  const openingRoom = Math.max(0, limits.current - Math.min(input.mortgageBalance, limits.legacy ?? limits.current));

  const duration = Math.max(180, first.length, heloc.length, refi.length);
  const keepRows = [];
  const refiRows = [];
  const keepPayments = [];
  let addedBalance = input.cashNeeded;
  const higherFee = Math.abs(keepFees - refiFees) >= 0.005 ? (keepFees > refiFees ? 'keep' : 'refi') : null;
  let feeGap = Math.abs(keepFees - refiFees);
  let breakEvenMonth = null;

  for (let month = 0; month < duration; month++) {
    const one = first[month] ?? paidOff;
    const two = heloc[month] ?? paidOff;
    const replacement = refi[month] ?? paidOff;
    const legacyActive = limits.legacy !== null && month < remaining;
    const keepSplit = deductibleInterest(one.opening, two.opening, input.mortgageRate, input.helocRate, limits, legacyActive, qualifies);
    const addedOpening = Math.min(replacement.opening, addedBalance);
    const refiSplit = deductibleInterest(replacement.opening - addedOpening, addedOpening, input.refiRate, input.refiRate, limits, legacyActive, qualifies);
    const keepRow = interestRow(one.interest + two.interest, keepSplit, one.balance + two.balance, input);
    const refiRow = interestRow(replacement.interest, refiSplit, replacement.balance, input);
    keepRows.push(keepRow);
    refiRows.push(refiRow);
    keepPayments.push(one.payment + two.payment);

    // Publication 936 applies principal to nonqualifying proceeds first on mixed-use mortgages.
    const addedPrincipal = qualifies && replacement.opening > 0
      ? replacement.principalPaid * (addedOpening / replacement.opening)
      : replacement.principalPaid;
    addedBalance = Math.max(0, addedOpening - addedPrincipal);

    const keepNet = keepRow.interest - keepRow.savings;
    const refiNet = refiRow.interest - refiRow.savings;
    feeGap += higherFee === 'keep' ? keepNet - refiNet : refiNet - keepNet;
    if (higherFee && breakEvenMonth === null && feeGap <= 1e-8) breakEvenMonth = month + 1;
  }

  const borrowingLimit = input.homeValue * (input.maxCltv / 100);
  return {
    equity: {
      available: Math.max(0, borrowingLimit - input.mortgageBalance),
      cltv: principal / input.homeValue * 100,
      eligible: principal - borrowingLimit <= 1e-7,
      excess: Math.max(0, principal - borrowingLimit)
    },
    taxLimits: { ...limits, openingRoom },
    keep: {
      principal, fees: keepFees, payment: keepPayments[0],
      repaymentPayment: heloc.length ? keepPayments[draw] : keepPayments[0],
      noteRate: principal > 0 ? (input.mortgageBalance * input.mortgageRate + input.cashNeeded * input.helocRate) / principal : null,
      apr: cashFlowApr(principal, keepFees, keepPayments),
      yearOne: totals(keepRows, keepFees, 12)
    },
    refi: {
      principal, fees: refiFees, payment: refi[0]?.payment ?? 0,
      noteRate: principal > 0 ? input.refiRate : null,
      apr: cashFlowApr(principal, refiFees, refi.map(row => row.payment)),
      yearOne: totals(refiRows, refiFees, 12)
    },
    breakEven: { option: higherFee, month: breakEvenMonth },
    horizons: HORIZONS.map(years => {
      const keep = totals(keepRows, keepFees, years * 12);
      const refi = totals(refiRows, refiFees, years * 12);
      const difference = Math.abs(keep.cost - refi.cost);
      return { years, keep, refi, difference, winner: difference < 0.005 ? 'tie' : keep.cost < refi.cost ? 'keep' : 'refi' };
    })
  };
}
