// AU Debt Consolidation & ASIC Moneysmart 30-Year Interest Trap Engine
export function calcMonthlyRepayment(principal, annualRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const rm = annualRate / 12;
  return principal * (rm * Math.pow(1 + rm, months)) / (Math.pow(1 + rm, months) - 1);
}

export function computeDebtConsolidation(inputs) {
  const {
    unsecuredDebt = 30000,
    creditCardRate = 0.2099, // RBA average ~20.99% p.a.
    personalLoanRate = 0.1030, // 3-year unsecured personal loan ~10.30%
    mortgageRate = 0.0620, // Refinance mortgage rate ~6.20%
    mortgageTermYears = 30
  } = inputs;

  if (unsecuredDebt <= 0 || isNaN(unsecuredDebt)) throw new RangeError('Debt must be positive');

  // Option A: Credit Card Fixed 3-Year Repayment (36 months)
  const cc3YrPmt = calcMonthlyRepayment(unsecuredDebt, creditCardRate, 36);
  const cc3YrTotal = cc3YrPmt * 36;
  const cc3YrInterest = cc3YrTotal - unsecuredDebt;

  // Option B: 3-Year Unsecured Debt Consolidation Personal Loan
  const loanPmt = calcMonthlyRepayment(unsecuredDebt, personalLoanRate, 36);
  const loanTotal = loanPmt * 36;
  const loanInterest = loanTotal - unsecuredDebt;

  // Option C: Home Loan Refinance Minimum Only Over 30 Years (The 30-Year Interest Trap!)
  const mortgageMonths = mortgageTermYears * 12;
  const trapMonthlyPmt = calcMonthlyRepayment(unsecuredDebt, mortgageRate, mortgageMonths);
  const trapTotalPaid = trapMonthlyPmt * mortgageMonths;
  const trapTotalInterest = trapTotalPaid - unsecuredDebt;
  const trapCostVsPersonalLoan = trapTotalInterest - loanInterest;

  // Option D: Home Loan Refinance WITH 3-Year "Shadow Repayment"
  // Paying the consolidated slice off in 36 months at the lower 6.20% mortgage rate
  const shadowMonthlyPmt = calcMonthlyRepayment(unsecuredDebt, mortgageRate, 36);
  const shadowTotalPaid = shadowMonthlyPmt * 36;
  const shadowTotalInterest = shadowTotalPaid - unsecuredDebt;
  const shadowSavingsVsPersonalLoan = loanInterest - shadowTotalInterest;
  const shadowSavingsVsTrap = trapTotalInterest - shadowTotalInterest;

  return {
    unsecuredDebt,
    creditCard: {
      monthlyPayment: cc3YrPmt,
      totalPaid: cc3YrTotal,
      totalInterest: cc3YrInterest
    },
    personalLoan: {
      monthlyPayment: loanPmt,
      totalPaid: loanTotal,
      totalInterest: loanInterest
    },
    mortgageTrap: {
      monthlyPayment: trapMonthlyPmt,
      totalPaid: trapTotalPaid,
      totalInterest: trapTotalInterest,
      trapCostVsPersonalLoan
    },
    shadowStrategy: {
      monthlyPayment: shadowMonthlyPmt,
      totalPaid: shadowTotalPaid,
      totalInterest: shadowTotalInterest,
      savingsVsPersonalLoan: shadowSavingsVsPersonalLoan,
      savingsVsTrap: shadowSavingsVsTrap
    }
  };
}
