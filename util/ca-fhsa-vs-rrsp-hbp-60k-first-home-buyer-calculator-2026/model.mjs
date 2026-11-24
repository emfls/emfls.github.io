export const LIMITS = Object.freeze({
  startYear: 2026,
  fhsaAnnual: 8000,
  fhsaCarry: 8000,
  fhsaLifetime: 40000,
  hbpWithdrawal: 60000,
  repaymentYears: 15,
  reliefStart: 2022,
  reliefEnd: 2028,
});

export function firstRepaymentYear(withdrawalYear) {
  const relief = withdrawalYear >= LIMITS.reliefStart && withdrawalYear <= LIMITS.reliefEnd;
  return withdrawalYear + (relief ? 5 : 2);
}

export function deductibleRRSP(contribution, balanceAfterWithdrawal, daysBeforeWithdrawal) {
  return daysBeforeWithdrawal < 90 ? Math.min(contribution, balanceAfterWithdrawal) : contribution;
}

// One schedule per buyer. Calculate minimums in cents from the remaining balance.
export function hbpSchedule(withdrawal, withdrawalYear, taxRate, missedYears) {
  let balance = Math.round(withdrawal * 100);
  if (balance === 0) return [];

  const start = firstRepaymentYear(withdrawalYear);
  return Array.from({ length: LIMITS.repaymentYears }, (_, index) => {
    const minimum = Math.round(balance / (LIMITS.repaymentYears - index));
    const missed = index < missedYears;
    const included = missed ? minimum : 0;
    balance -= minimum;
    return {
      year: start + index,
      minimum: minimum / 100,
      repaid: missed ? 0 : minimum / 100,
      included: included / 100,
      tax: Math.round(included * taxRate / 100) / 100,
      balance: balance / 100,
    };
  });
}

function validate(input) {
  const ranges = {
    years: [1, 10, true],
    buyers: [1, 2, true],
    savings: [0, 1000000],
    existingRRSP: [0, 10000000],
    rrspRoom: [0, 1000000],
    fhsaUsed: [0, LIMITS.fhsaLifetime],
    carry: [0, LIMITS.fhsaCarry],
    rate: [-50, 30],
    taxRate: [0, 100],
    repaymentTaxRate: [0, 100],
    rrspDays: [0, 365, true],
    missedYears: [0, LIMITS.repaymentYears, true],
  };
  for (const [name, [min, max, whole]] of Object.entries(ranges)) {
    const value = input[name];
    if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
      throw new RangeError(`Invalid value for ${name}`);
    }
  }
  if (typeof input.reinvest !== 'boolean') throw new RangeError('Invalid refund reinvestment choice');
}

function hbpWithdrawal(balance) {
  return Math.floor(Math.min(balance, LIMITS.hbpWithdrawal) * 100 + 1e-8) / 100;
}

function project(input, purchaseYear, useFHSA, useHBP) {
  const growth = 1 + input.rate / 100;
  const initialRRSP = useHBP ? input.existingRRSP : 0;
  let rrsp = initialRRSP;
  let rrspRoom = input.rrspRoom;
  let fhsa = 0;
  let fhsaPrincipal = 0;
  let carry = input.carry;
  let otherSavings = 0;
  let refundAtClosing = 0;
  let pendingRefund = 0;
  let refundTotal = 0;

  for (let year = LIMITS.startYear; year <= purchaseYear; year++) {
    const yearsRemaining = purchaseYear - year + 1;
    const isClosingYear = year === purchaseYear;
    const fhsaRoom = LIMITS.fhsaAnnual + carry;
    const fhsaContribution = useFHSA
      ? Math.min(input.savings, fhsaRoom, LIMITS.fhsaLifetime - input.fhsaUsed - fhsaPrincipal)
      : 0;
    fhsaPrincipal += fhsaContribution;
    carry = Math.min(LIMITS.fhsaCarry, fhsaRoom - fhsaContribution);
    fhsa = (fhsa + fhsaContribution) * growth;

    // Put new RRSP contributions only toward the projected closing HBP capacity.
    const rrspYears = isClosingYear ? input.rrspDays / 365 : 1;
    const rrspGrowth = growth ** rrspYears;
    const projectedHeadroom = Math.max(0, LIMITS.hbpWithdrawal - rrsp * growth ** yearsRemaining);
    const closingGrowth = rrspGrowth * growth ** (yearsRemaining - 1);
    const rrspContribution = useHBP
      ? Math.min(input.savings - fhsaContribution, rrspRoom, projectedHeadroom / closingGrowth)
      : 0;
    rrspRoom -= rrspContribution;
    rrsp = rrsp * growth + rrspContribution * rrspGrowth;
    otherSavings = (otherSavings + input.savings - fhsaContribution - rrspContribution) * growth;
    refundAtClosing = (refundAtClosing + pendingRefund) * (input.reinvest ? growth : 1);

    const afterWithdrawal = Math.max(0, rrsp - hbpWithdrawal(rrsp));
    const deductible = isClosingYear
      ? deductibleRRSP(rrspContribution, afterWithdrawal, input.rrspDays)
      : rrspContribution;
    pendingRefund = (fhsaContribution + deductible) * input.taxRate / 100;
    refundTotal += pendingRefund;
  }

  const hbp = hbpWithdrawal(rrsp);
  const oneSchedule = hbpSchedule(hbp, purchaseYear, input.repaymentTaxRate, input.missedYears);
  const schedule = oneSchedule.map(({ year, ...amounts }) => {
    const householdAmounts = Object.fromEntries(
      Object.entries(amounts).map(([key, value]) => [key, value * input.buyers]),
    );
    return { year, ...householdAmounts };
  });
  const start = firstRepaymentYear(purchaseYear);
  const end = start + LIMITS.repaymentYears - 1;
  const hypotheticalGrowth = hbp * (growth ** (end - purchaseYear) - 1);
  const repaymentGrowth = oneSchedule.reduce(
    (total, row) => total + row.repaid * (growth ** (end - row.year) - 1), 0,
  );
  const household = amount => amount * input.buyers;

  return {
    fhsa: household(fhsa),
    fhsaGrowth: household(fhsa - fhsaPrincipal),
    hbp: household(hbp),
    rrspRemaining: household(Math.max(0, rrsp - hbp)),
    otherSavings: household(otherSavings),
    refundTotal: household(refundTotal),
    refundAtClosing: household(refundAtClosing),
    refundAfterClosing: household(pendingRefund),
    downPayment: household(fhsa + hbp + otherSavings + refundAtClosing),
    schedule,
    missedTax: schedule.reduce((total, row) => total + row.tax, 0),
    graceGrowth: household(hbp * (growth ** (start - purchaseYear) - 1)),
    foregoneGrowth: household(hypotheticalGrowth - repaymentGrowth),
  };
}

export function compareStrategies(input) {
  validate(input);
  const purchaseYear = LIMITS.startYear + input.years - 1;
  return {
    purchaseYear,
    repaymentYear: firstRepaymentYear(purchaseYear),
    combined: project(input, purchaseYear, true, true),
    rrsp: project(input, purchaseYear, false, true),
    tfsa: project(input, purchaseYear, false, false),
  };
}
