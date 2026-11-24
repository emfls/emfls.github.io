// SBA 7(a) Loan Calculation Engine (SOP 50 10 & FY2026/27)
export function calcMonthlyPayment(principal, annualRate, months) {
  if (principal <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const rm = annualRate / 12;
  return principal * (rm * Math.pow(1 + rm, months)) / (Math.pow(1 + rm, months) - 1);
}

export function calcSBAGuaranteeFee(loanAmount, maturityMonths = 120, isManufacturerWaiver = false) {
  if (loanAmount <= 0 || isNaN(loanAmount)) throw new RangeError('Loan amount must be positive');
  if (loanAmount > 5000000) throw new RangeError('Maximum SBA 7(a) loan amount is $5,000,000');
  
  if (isManufacturerWaiver && loanAmount <= 950000) {
    return { guaranteedAmount: loanAmount <= 150000 ? loanAmount * 0.85 : loanAmount * 0.75, fee: 0, feePct: 0 };
  }

  const guaranteePct = loanAmount <= 150000 ? 0.85 : 0.75;
  const guaranteedAmount = loanAmount * guaranteePct;

  if (maturityMonths <= 12) {
    return { guaranteedAmount, fee: guaranteedAmount * 0.0025, feePct: 0.25 };
  }

  // Tiered statutory fee on guaranteed portion
  let fee = 0;
  if (guaranteedAmount <= 150000) {
    fee = guaranteedAmount * 0.02;
  } else if (guaranteedAmount <= 700000) {
    fee = guaranteedAmount * 0.03;
  } else if (guaranteedAmount <= 1000000) {
    fee = guaranteedAmount * 0.035;
  } else {
    // Over $1,000,000 guaranteed: 3.5% on first $1M + 3.75% on remainder
    fee = (1000000 * 0.035) + ((guaranteedAmount - 1000000) * 0.0375);
  }

  return { guaranteedAmount, fee, feePct: (fee / guaranteedAmount) * 100 };
}

export function getMaxSBASpread(loanAmount) {
  if (loanAmount <= 50000) return 0.045; // Prime + 4.5%
  if (loanAmount <= 250000) return 0.035; // Prime + 3.5%
  if (loanAmount <= 350000) return 0.030; // Prime + 3.0%
  return 0.030; // Prime + 3.0%
}

export function computeSBA7aLoan(inputs) {
  const {
    loanAmount = 1000000,
    wsjPrimeRate = 0.0775,
    lenderSpread = 0.0300,
    termYears = 10,
    annualNOI = 250000,
    existingAnnualDebt = 20000,
    isManufacturerWaiver = false
  } = inputs;

  if (loanAmount <= 0 || isNaN(loanAmount)) throw new RangeError('Loan amount must be positive');
  if (loanAmount > 5000000) throw new RangeError('Maximum SBA 7(a) loan is $5,000,000');

  const maxSpread = getMaxSBASpread(loanAmount);
  const actualSpread = Math.min(lenderSpread, maxSpread);
  const noteRate = wsjPrimeRate + actualSpread;
  const totalMonths = termYears * 12;

  const monthlyPayment = calcMonthlyPayment(loanAmount, noteRate, totalMonths);
  const annualDebtService = monthlyPayment * 12;
  const totalAnnualDebt = annualDebtService + existingAnnualDebt;
  const dscr = totalAnnualDebt > 0 ? (annualNOI / totalAnnualDebt) : 0;
  const dscrPass = dscr >= 1.25;

  // NOI shortfall calculation
  const targetNOI = totalAnnualDebt * 1.25;
  const noiShortfall = Math.max(0, targetNOI - annualNOI);

  const feeData = calcSBAGuaranteeFee(loanAmount, totalMonths, isManufacturerWaiver);
  const totalRepayment = monthlyPayment * totalMonths;
  const totalInterest = totalRepayment - loanAmount;

  return {
    loanAmount,
    noteRate,
    interestRate: noteRate,
    maxAllowedSpread: maxSpread,
    actualSpread,
    monthlyPayment,
    annualDebtService,
    totalAnnualDebt,
    dscr,
    dscrPass,
    noiShortfall,
    guaranteedAmount: feeData.guaranteedAmount,
    guaranteeFee: feeData.fee,
    guaranteeFeePct: feeData.feePct,
    totalRepayment,
    totalInterest
  };
}
