// Thresholds are in pounds. Monetary arithmetic uses integer pence.
export const RATES = Object.freeze({
  smallProfitsThreshold: 7105,
  lowerProfitsLimit: 12570,
  upperProfitsLimit: 50270,
  class4MainPercent: 6,
  class4UpperPercent: 2,
  class2WeeklyPence: 365,
  class3WeeklyPence: 1840,
  comparisonWeeks: 52,
  personalAllowance: 12570,
  taperStarts: 100000,
  basicBand: 37700,
  additionalBandStarts: 125140,
  basicPercent: 20,
  higherPercent: 40,
  additionalPercent: 45,
  paymentMinimum: 1000,
  sourceExemptionPercent: 80,
});

const maxInput = 100_000_000;
const pounds = pence => pence / 100;

function toPence(value, minimum = 0, maximum = maxInput) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError('Amount is outside the supported range.');
  }
  const pence = Math.round(value * 100);
  if (pounds(pence) !== value) {
    throw new RangeError('Enter amounts to the nearest penny.');
  }
  return pence;
}

function splitAdvances(assessed, withheld) {
  const unpaid = assessed - withheld;
  const minimumUnpaidPercent = 100 - RATES.sourceExemptionPercent;
  if (unpaid < RATES.paymentMinimum * 100 || unpaid * 100 < assessed * minimumUnpaidPercent) {
    return [0, 0];
  }
  const first = Math.floor(unpaid / 2);
  return [first, unpaid - first];
}

export function calculatePaymentsOnAccount(assessedTaxAndClass4, taxAtSource = 0) {
  const [first, second] = splitAdvances(toPence(assessedTaxAndClass4), toPence(taxAtSource));
  return { firstPayment: pounds(first), secondPayment: pounds(second) };
}

export function calculate({ profit, taxAtSource = 0, priorPayments = 0, voluntaryClass2 = false }) {
  const profitPence = toPence(profit, -maxInput);
  const withheld = toPence(taxAtSource);
  const paid = toPence(priorPayments);
  if (typeof voluntaryClass2 !== 'boolean') {
    throw new RangeError('Choose whether to include voluntary Class 2.');
  }

  const taper = Math.max(0, profitPence - RATES.taperStarts * 100) / 2;
  const allowance = Math.max(0, RATES.personalAllowance * 100 - taper);
  const taxable = Math.max(0, profitPence - allowance);
  const basicLimit = RATES.basicBand * 100;
  const additionalLimit = RATES.additionalBandStarts * 100;
  const basic = Math.min(taxable, basicLimit);
  const higher = Math.max(0, Math.min(taxable, additionalLimit) - basicLimit);
  const additional = Math.max(0, taxable - additionalLimit);
  const incomeTax = Math.round(
    (basic * RATES.basicPercent + higher * RATES.higherPercent + additional * RATES.additionalPercent) / 100
  );

  const lowerLimit = RATES.lowerProfitsLimit * 100;
  const upperLimit = RATES.upperProfitsLimit * 100;
  const mainProfit = Math.max(0, Math.min(profitPence, upperLimit) - lowerLimit);
  const upperProfit = Math.max(0, profitPence - upperLimit);
  const class4Main = Math.round(mainProfit * RATES.class4MainPercent / 100);
  const class4Upper = Math.round(upperProfit * RATES.class4UpperPercent / 100);
  const class4 = class4Main + class4Upper;

  const treatedAsPaid = profitPence >= RATES.smallProfitsThreshold * 100;
  const class2 = !treatedAsPaid && voluntaryClass2 ? RATES.class2WeeklyPence * RATES.comparisonWeeks : 0;
  const class2Status = treatedAsPaid ? 'treated-as-paid' : class2 > 0 ? 'voluntary' : 'eligible';

  const totalBill = incomeTax + class4 + class2;
  const balance = totalBill - withheld - paid;
  const [first, second] = splitAdvances(incomeTax + class4, withheld);
  const januaryNet = balance + first;

  return {
    personalAllowance: pounds(Math.round(allowance)),
    incomeTax: pounds(incomeTax),
    class4Main: pounds(class4Main),
    class4Upper: pounds(class4Upper),
    class4: pounds(class4),
    class2: pounds(class2),
    class2Status,
    totalBill: pounds(totalBill),
    takeHome: pounds(profitPence - totalBill),
    balance: pounds(balance),
    firstPayment: pounds(first),
    januaryDue: pounds(Math.max(0, januaryNet)),
    julyDue: pounds(second),
    estimatedCredit: pounds(Math.max(0, -januaryNet)),
  };
}
