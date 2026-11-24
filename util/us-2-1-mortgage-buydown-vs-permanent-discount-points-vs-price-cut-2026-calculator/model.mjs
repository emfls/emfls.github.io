export function calcMonthlyPayment(principal, annualRate, months) {
  if (principal <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const rm = annualRate / 12;
  return principal * (rm * Math.pow(1 + rm, months)) / (Math.pow(1 + rm, months) - 1);
}

export function compareMortgageOptions(inputs) {
  const {
    homePrice = 500000,
    downPaymentPct = 20,
    noteRate = 0.0675,
    termYears = 30,
    discountPoints = 2.0,
    pointsRateReductionPerPoint = 0.0025,
    sellerConcession = null
  } = inputs;

  if (homePrice <= 0 || isNaN(homePrice)) throw new RangeError('Home price must be positive');
  if (downPaymentPct < 0 || downPaymentPct >= 100 || isNaN(downPaymentPct)) throw new RangeError('Invalid down payment %');
  if (noteRate < 0 || isNaN(noteRate)) throw new RangeError('Note rate cannot be negative');
  if (termYears <= 0 || isNaN(termYears)) throw new RangeError('Term must be positive');
  if (discountPoints < 0 || isNaN(discountPoints)) throw new RangeError('Points cannot be negative');

  const downPayment = homePrice * (downPaymentPct / 100);
  const loanAmount = homePrice - downPayment;
  const termMonths = termYears * 12;

  // Base Standard Loan
  const baseMonthlyPayment = calcMonthlyPayment(loanAmount, noteRate, termMonths);

  // Strategy 1: 2-1 Buydown
  const yr1Rate = Math.max(0, noteRate - 0.02);
  const yr2Rate = Math.max(0, noteRate - 0.01);
  const yr1Payment = calcMonthlyPayment(loanAmount, yr1Rate, termMonths);
  const yr2Payment = calcMonthlyPayment(loanAmount, yr2Rate, termMonths);
  const yr3Payment = baseMonthlyPayment;

  const yr1MonthlySavings = baseMonthlyPayment - yr1Payment;
  const yr2MonthlySavings = baseMonthlyPayment - yr2Payment;
  const yr1TotalSavings = yr1MonthlySavings * 12;
  const yr2TotalSavings = yr2MonthlySavings * 12;
  const buydownEscrowCost = yr1TotalSavings + yr2TotalSavings;
  const buydown3YrSavings = buydownEscrowCost;
  const buydown5YrSavings = buydownEscrowCost;

  // Strategy 2: Permanent Discount Points
  const pointsCost = (discountPoints / 100) * loanAmount;
  const pointsRateReduction = discountPoints * pointsRateReductionPerPoint;
  const permanentRate = Math.max(0, noteRate - pointsRateReduction);
  const permanentMonthlyPayment = calcMonthlyPayment(loanAmount, permanentRate, termMonths);
  const pointsMonthlySavings = baseMonthlyPayment - permanentMonthlyPayment;
  const points1YrSavings = pointsMonthlySavings * 12;
  const points3YrSavings = pointsMonthlySavings * 36;
  const points5YrSavings = pointsMonthlySavings * 60;
  const pointsLifetimeSavings = pointsMonthlySavings * termMonths;
  const pointsBreakevenMonths = pointsMonthlySavings > 0 ? (pointsCost / pointsMonthlySavings) : Infinity;

  // Strategy 3: Equivalent Price Cut
  const concessionAmount = (sellerConcession !== null && sellerConcession !== undefined && !isNaN(sellerConcession)) 
    ? sellerConcession : buydownEscrowCost;
  const discountedPrice = Math.max(0, homePrice - concessionAmount);
  const priceCutDownPayment = discountedPrice * (downPaymentPct / 100);
  const priceCutLoan = discountedPrice - priceCutDownPayment;
  const priceCutMonthlyPayment = calcMonthlyPayment(priceCutLoan, noteRate, termMonths);
  const priceCutMonthlySavings = baseMonthlyPayment - priceCutMonthlyPayment;
  const priceCutDownPaymentSavings = downPayment - priceCutDownPayment;
  const priceCut1YrSavings = priceCutMonthlySavings * 12;
  const priceCut3YrSavings = priceCutMonthlySavings * 36;
  const priceCut5YrSavings = priceCutMonthlySavings * 60;
  const priceCutLifetimeSavings = priceCutMonthlySavings * termMonths;

  return {
    homePrice,
    downPayment,
    loanAmount,
    noteRate,
    termYears,
    baseMonthlyPayment,
    buydown: {
      yr1Rate,
      yr2Rate,
      yr1Payment,
      yr2Payment,
      yr3Payment,
      yr1MonthlySavings,
      yr2MonthlySavings,
      yr1TotalSavings,
      yr2TotalSavings,
      escrowCost: buydownEscrowCost,
      savings3Yr: buydown3YrSavings,
      savings5Yr: buydown5YrSavings
    },
    points: {
      discountPoints,
      cost: pointsCost,
      newRate: permanentRate,
      monthlyPayment: permanentMonthlyPayment,
      monthlySavings: pointsMonthlySavings,
      savings1Yr: points1YrSavings,
      savings3Yr: points3YrSavings,
      savings5Yr: points5YrSavings,
      lifetimeSavings: pointsLifetimeSavings,
      breakevenMonths: pointsBreakevenMonths
    },
    priceCut: {
      concession: concessionAmount,
      discountedPrice,
      newLoan: priceCutLoan,
      downPaymentSavings: priceCutDownPaymentSavings,
      monthlyPayment: priceCutMonthlyPayment,
      monthlySavings: priceCutMonthlySavings,
      savings1Yr: priceCut1YrSavings,
      savings3Yr: priceCut3YrSavings,
      savings5Yr: priceCut5YrSavings,
      lifetimeSavings: priceCutLifetimeSavings
    }
  };
}
