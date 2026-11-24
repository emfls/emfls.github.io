// IRS Rev. Proc. 2025-32 §§ 4.01 and 4.03; Form 8960 for NIIT.
const status = (zeroMax, fifteenMax, niitThreshold, ordinaryLimits) => Object.freeze({
  zeroMax, fifteenMax, niitThreshold, ordinaryLimits: Object.freeze(ordinaryLimits),
});

export const TAX_2026 = Object.freeze({
  single: status(49450, 545500, 200000, [12400, 50400, 105700, 201775, 256225, 640600]),
  mfj: status(98900, 613700, 250000, [24800, 100800, 211400, 403550, 512450, 768700]),
  hoh: status(66200, 579600, 200000, [17700, 67450, 105700, 201750, 256200, 640600]),
  mfs: status(49450, 306850, 125000, [12400, 50400, 105700, 201775, 256225, 384350]),
});

const ordinaryRates = [.10, .12, .22, .24, .32, .35, .37];
const positive = value => Math.max(0, value);

function ordinaryTax(income, { ordinaryLimits }) {
  return ordinaryRates.reduce((tax, rate, i) => {
    const lower = ordinaryLimits[i - 1] ?? 0;
    const upper = ordinaryLimits[i] ?? Infinity;
    return tax + positive(Math.min(upper, income) - lower) * rate;
  }, 0);
}

function regularTax(ordinary, gain1250, regularGain, brackets) {
  // Pub. 505 Worksheet 2-8, for income with no 28% gains or other preferential income.
  const income = ordinary + gain1250 + regularGain;
  const ordinaryPortion = Math.max(ordinary, Math.min(ordinary + gain1250, brackets.ordinaryLimits[3]));
  const gainAtZero = Math.min(regularGain, positive(brackets.zeroMax - ordinary - gain1250));
  const gainAtFifteen = Math.min(regularGain - gainAtZero, positive(brackets.fifteenMax - ordinaryPortion - gainAtZero));
  const gainAtTwenty = regularGain - gainAtZero - gainAtFifteen;
  const gainAtTwentyFive = positive(gain1250 - (ordinaryPortion - ordinary));
  const preferentialTax = ordinaryTax(ordinaryPortion, brackets)
    + gainAtFifteen * .15 + gainAtTwenty * .20 + gainAtTwentyFive * .25;
  return Math.min(preferentialTax, ordinaryTax(income, brackets));
}

function netInvestmentTax(magi, nii, threshold) {
  return Math.min(nii, positive(magi - threshold)) * .038;
}

function cents(value, label, min = 0) {
  if (!Number.isFinite(value) || value < min || value > 100000000) {
    throw new RangeError(`${label} must be between $${min} and $100 million.`);
  }
  const rounded = Math.round(value * 100);
  if (Math.abs(value - rounded / 100) > 0.00000001) {
    throw new RangeError(`${label} must be in dollars and cents.`);
  }
  return rounded;
}

export function calculateInstallmentSale(input) {
  if (!Object.hasOwn(TAX_2026, input.filingStatus)) throw new RangeError('Choose a filing status.');
  const brackets = TAX_2026[input.filingStatus];
  const sellingPrice = cents(input.sellingPrice, 'Selling price', .01);
  const adjustedBasis = cents(input.adjustedBasis, 'Adjusted basis');
  const sellingExpenses = cents(input.sellingExpenses, 'Selling expenses');
  const assumedMortgage = cents(input.assumedMortgage, 'Assumed mortgage');
  const downPayment = cents(input.downPayment, 'Down payment');
  const recapture = cents(input.ordinaryRecapture, 'Ordinary recapture');
  const gain1250 = cents(input.unrecaptured1250, 'Unrecaptured §1250 gain');
  const baseIncome = cents(input.otherTaxableIncome, 'Other taxable income') / 100;
  const baseMagi = cents(input.otherMagi, 'Other modified AGI') / 100;
  const baseNii = cents(input.otherNii, 'Other net investment income') / 100;
  const { noteYears, annualInterestRate, saleSubjectToNiit } = input;

  if (!Number.isInteger(noteYears) || noteYears < 1 || noteYears > 30) {
    throw new RangeError('Note term must be a whole number from 1 to 30 years.');
  }
  if (!Number.isFinite(annualInterestRate) || annualInterestRate < 0 || annualInterestRate > 100) {
    throw new RangeError('Annual interest rate must be between 0% and 100%.');
  }
  if (typeof saleSubjectToNiit !== 'boolean') throw new RangeError('Choose whether sale gain enters net investment income.');
  if (assumedMortgage > sellingPrice) throw new RangeError('Assumed mortgage cannot exceed the selling price.');
  if (downPayment > sellingPrice - assumedMortgage) {
    throw new RangeError('Down payment cannot exceed the selling price less assumed mortgage.');
  }
  const totalGain = sellingPrice - sellingExpenses - adjustedBasis;
  if (totalGain < 0) throw new RangeError('This sale shows a loss. Form 6252 installment gain treatment is unavailable.');
  if (recapture > totalGain) throw new RangeError('Ordinary recapture cannot exceed total gain.');
  const deferredGrossProfit = Math.max(0, totalGain - recapture);
  if (gain1250 > deferredGrossProfit) {
    throw new RangeError('Unrecaptured §1250 gain cannot exceed gain left after ordinary recapture.');
  }

  const installmentBasis = adjustedBasis + sellingExpenses + recapture;
  const deemedPayment = positive(assumedMortgage - installmentBasis);
  const contractPrice = sellingPrice - Math.min(assumedMortgage, installmentBasis);
  const grossProfitRatio = contractPrice > 0 ? Math.min(1, deferredGrossProfit / contractPrice) : 0;
  const notePrincipal = sellingPrice - assumedMortgage - downPayment;
  const baseOrdinaryTax = ordinaryTax(baseIncome, brackets);
  const baseNiit = netInvestmentTax(baseMagi, baseNii, brackets.niitThreshold);

  function saleTax(recaptureDollars, interest, gain1250Dollars, regularGain) {
    const saleIncome = recaptureDollars + gain1250Dollars + regularGain;
    const ordinary = baseIncome + recaptureDollars + interest;
    const taxableInvestment = baseNii + interest + (saleSubjectToNiit ? saleIncome : 0);
    const niit = netInvestmentTax(baseMagi + saleIncome + interest, taxableInvestment, brackets.niitThreshold) - baseNiit;
    const incomeTax = regularTax(ordinary, gain1250Dollars, regularGain, brackets) - baseOrdinaryTax;
    return { niit, tax: incomeTax + niit };
  }

  const rows = [];
  let remainingNote = notePrincipal;
  let cumulativePayments = 0;
  let recognizedGain = 0;
  const term = notePrincipal > 0 ? noteYears : 0;
  const annualPrincipal = Math.floor(notePrincipal / noteYears);
  for (let offset = 0; offset <= term; offset += 1) {
    const isClosing = offset === 0;
    const cashPrincipal = isClosing ? downPayment : offset === term ? remainingNote : annualPrincipal;
    const interest = isClosing ? 0 : Math.round(remainingNote * annualInterestRate / 100) / 100;
    const deemedPrincipal = isClosing ? deemedPayment : 0;
    cumulativePayments += cashPrincipal + deemedPrincipal;
    // Use the unrounded ratio and settle any display-cent remainder in the final payment.
    const cumulativeGain = offset === term ? deferredGrossProfit : Math.round(cumulativePayments * grossProfitRatio);
    const gain = cumulativeGain - recognizedGain;
    const gain1250ThisYear = Math.min(gain, positive(gain1250 - recognizedGain));
    const regularGain = (gain - gain1250ThisYear) / 100;
    const recaptureThisYear = isClosing ? recapture / 100 : 0;
    rows.push({
      year: 2026 + offset,
      cashPrincipal: cashPrincipal / 100,
      deemedPrincipal: deemedPrincipal / 100,
      interest,
      capitalGain: gain / 100,
      gain1250: gain1250ThisYear / 100,
      regularGain,
      recapture: recaptureThisYear,
      ...saleTax(recaptureThisYear, interest, gain1250ThisYear / 100, regularGain),
    });

    if (!isClosing) remainingNote -= cashPrincipal;
    recognizedGain = cumulativeGain;
  }

  const lumpSum = saleTax(recapture / 100, 0, gain1250 / 100, (deferredGrossProfit - gain1250) / 100);
  const installmentTax = rows.reduce((total, row) => total + row.tax, 0);
  return {
    totalGain: totalGain / 100,
    deferredGrossProfit: deferredGrossProfit / 100,
    contractPrice: contractPrice / 100,
    grossProfitRatio,
    deemedPayment: deemedPayment / 100,
    notePrincipal: notePrincipal / 100,
    recaptureTaxShock: ordinaryTax(baseIncome + recapture / 100, brackets) - baseOrdinaryTax,
    installmentTax,
    lumpSumTax: lumpSum.tax,
    lumpSumNiit: lumpSum.niit,
    taxSaved: lumpSum.tax - installmentTax,
    rows,
  };
}
