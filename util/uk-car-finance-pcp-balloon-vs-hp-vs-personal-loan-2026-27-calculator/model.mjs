// UK Car Finance Engine: PCP vs HP vs Personal Loan (2026/27 Standards)
export function calcPCPMonthlyPayment(financedAmount, gmfv, annualRate, months) {
  if (months <= 0) return 0;
  if (annualRate <= 0) {
    return (financedAmount - gmfv) / months;
  }
  const r = annualRate / 12;
  // PCP exact formula: (financed - gmfv / (1 + r)^n) * r / (1 - (1 + r)^(-n))
  const pvBalloon = gmfv / Math.pow(1 + r, months);
  return (financedAmount - pvBalloon) * r / (1 - Math.pow(1 + r, -months));
}

export function calcAmortizingPayment(principal, annualRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const r = annualRate / 12;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export function computeCarFinance(inputs) {
  const {
    carPrice = 32000,
    deposit = 4000,
    termMonths = 48,
    pcpApr = 0.079,
    gmfvBalloon = 14400, // 45% of car price
    personalLoanApr = 0.059,
    annualMileageContract = 10000,
    actualAnnualMileage = 12000,
    excessMileagePence = 0.10 // 10p per mile
  } = inputs;

  if (carPrice <= 0 || isNaN(carPrice)) throw new RangeError('Car price must be positive');
  if (deposit < 0 || deposit >= carPrice) throw new RangeError('Invalid deposit amount');
  if (gmfvBalloon < 0 || gmfvBalloon >= carPrice) throw new RangeError('Invalid balloon amount');

  const financedAmount = carPrice - deposit;

  // 1. PCP (Personal Contract Purchase)
  const pcpMonthly = calcPCPMonthlyPayment(financedAmount, gmfvBalloon, pcpApr, termMonths);
  const pcpTotalPayments = pcpMonthly * termMonths;
  const pcpTotalInterest = (pcpTotalPayments + gmfvBalloon) - financedAmount;
  const pcpTotalCostToOwn = deposit + pcpTotalPayments + gmfvBalloon;

  // Excess mileage penalty on hand back
  const termYears = termMonths / 12;
  const totalContractMiles = annualMileageContract * termYears;
  const totalActualMiles = actualAnnualMileage * termYears;
  const excessMiles = Math.max(0, totalActualMiles - totalContractMiles);
  const excessMileagePenalty = excessMiles * excessMileagePence;
  const pcpTotalCostHandBack = deposit + pcpTotalPayments + excessMileagePenalty;

  // 2. HP (Hire Purchase) - same APR but zero balloon
  const hpMonthly = calcAmortizingPayment(financedAmount, pcpApr, termMonths);
  const hpTotalPayments = hpMonthly * termMonths;
  const hpTotalInterest = hpTotalPayments - financedAmount;
  const hpTotalCost = deposit + hpTotalPayments;

  // 3. Unsecured Personal Loan - typical lower rate, zero balloon, day 1 ownership
  const loanMonthly = calcAmortizingPayment(financedAmount, personalLoanApr, termMonths);
  const loanTotalPayments = loanMonthly * termMonths;
  const loanTotalInterest = loanTotalPayments - financedAmount;
  const loanTotalCost = deposit + loanTotalPayments;

  const pcpInterestPremiumVsHP = pcpTotalInterest - hpTotalInterest;
  const loanSavingsVsPCPToOwn = pcpTotalCostToOwn - loanTotalCost;

  return {
    carPrice,
    deposit,
    financedAmount,
    termMonths,
    gmfvBalloon,
    pcp: {
      monthlyPayment: pcpMonthly,
      totalInterest: pcpTotalInterest,
      totalCostToOwn: pcpTotalCostToOwn,
      excessMileagePenalty,
      totalCostHandBack: pcpTotalCostHandBack
    },
    hp: {
      monthlyPayment: hpMonthly,
      totalInterest: hpTotalInterest,
      totalCost: hpTotalCost
    },
    loan: {
      monthlyPayment: loanMonthly,
      totalInterest: loanTotalInterest,
      totalCost: loanTotalCost
    },
    pcpInterestPremiumVsHP,
    loanSavingsVsPCPToOwn
  };
}
