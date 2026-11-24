const exemption = 30_000;
const taxBands = {
  restOfUK: [[37_700, 20], [125_140, 40], [Infinity, 45]],
  scotland: [[3_967, 19], [16_956, 20], [31_092, 21], [62_430, 42],
    [125_140, 45], [Infinity, 48]],
};
const niThresholds = {
  weekly: [242, 967, 96],
  fortnightly: [484, 1934, 192],
  fourWeekly: [968, 3868, 384],
  monthly: [1048, 4189, 417],
};

const roundMoney = value => Math.round((value + Number.EPSILON * Math.abs(value)) * 100) / 100;
const positive = value => Math.max(0, value);

function annualIncomeTax(income, bands) {
  // Half-penny units preserve the taper before rounding the incremental tax.
  const incomePence = Math.round(income * 100);
  const allowance = positive(12_570 * 200 - positive(incomePence - 100_000 * 100));
  const taxable = positive(incomePence * 2 - allowance);
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of bands) {
    tax += positive(Math.min(taxable, upper * 200) - lower) * rate;
    lower = upper * 200;
  }
  return tax;
}

function class1(earnings, thresholds) {
  const [primary, upper, secondary] = thresholds;
  const penceAbove = (amount, floor) => Math.round(positive(amount - floor) * 100);
  const mainBand = penceAbove(Math.min(earnings, upper), primary);
  const upperBand = penceAbove(earnings, upper);
  // Exact percentage method rounds a half penny down.
  return {
    employee: Math.floor((mainBand * 8 + upperBand * 2 + 49) / 100) / 100,
    employer: Math.floor((penceAbove(earnings, secondary) * 15 + 49) / 100) / 100,
  };
}

export function calculateSettlement({
  basicPay, noticeUnits, payPeriodDays, method, taxablePilon,
  includePilon = false, relevantAward, statutoryRedundancy, priorQualifyingAwards = 0,
  annualIncome, periodEarnings, niPeriod, region, payeWithheld = null,
}) {
  const amounts = [basicPay, taxablePilon, relevantAward, statutoryRedundancy,
    priorQualifyingAwards, annualIncome, periodEarnings];
  if (payeWithheld !== null) amounts.push(payeWithheld);
  if (amounts.some(value => !Number.isFinite(value) || value < 0 || value > 1e9)) {
    throw new RangeError('Enter each cash amount from £0 to £1 billion.');
  }
  if (amounts.some(value => value !== roundMoney(value))) {
    throw new RangeError('Enter each cash amount to the nearest penny.');
  }
  if (!Number.isSafeInteger(noticeUnits) || noticeUnits < 0 ||
      noticeUnits > (method === 'months' ? 1200 : 36525)) {
    throw new RangeError('Enter a valid whole number of unworked notice days or months.');
  }
  if (!Object.hasOwn(taxBands, region) || !Object.hasOwn(niThresholds, niPeriod)) {
    throw new RangeError('Select a tax region and a Class 1 NI earnings period.');
  }
  if (!['days', 'months', 'averageDays'].includes(method)) {
    throw new RangeError('Select a PENP calculation method.');
  }
  if (method === 'days' && (!Number.isSafeInteger(payPeriodDays) || payPeriodDays < 1 || payPeriodDays > 36525)) {
    throw new RangeError('Enter the last pay period length in whole days, greater than zero.');
  }

  const denominator = { days: payPeriodDays, months: 1, averageDays: 30.42 }[method];
  const rawPenp = basicPay * noticeUnits / denominator - taxablePilon;
  const penp = roundMoney(Math.min(relevantAward, positive(rawPenp)));
  const qualifyingAward = roundMoney(statutoryRedundancy + relevantAward - penp);
  const taxFree = roundMoney(Math.min(qualifyingAward, positive(exemption - priorQualifyingAwards)));
  const taxableExcess = roundMoney(qualifyingAward - taxFree);
  const pilonInSettlement = includePilon ? taxablePilon : 0;
  const taxableEarnings = roundMoney(penp + pilonInSettlement);
  const bands = taxBands[region];
  const annualTaxDifference = annualIncomeTax(annualIncome + taxableEarnings + taxableExcess, bands)
    - annualIncomeTax(annualIncome, bands);
  const incomeTax = Math.round(annualTaxDifference / 200) / 100;

  const thresholds = niThresholds[niPeriod];
  const baseNI = class1(periodEarnings, thresholds);
  const totalNI = class1(periodEarnings + taxableEarnings, thresholds);
  const employeeNI = roundMoney(totalNI.employee - baseNI.employee);
  const employerClass1 = roundMoney(totalNI.employer - baseNI.employer);
  const employerClass1A = roundMoney(taxableExcess * 0.15);
  const totalDeductions = roundMoney(incomeTax + employeeNI);
  const gross = roundMoney(relevantAward + statutoryRedundancy + pilonInSettlement);
  const payrollDeductions = payeWithheld === null ? null : roundMoney(payeWithheld + employeeNI);

  return {
    rawPenp, penp, qualifyingAward, taxFree, taxableExcess, pilonInSettlement,
    gross, incomeTax, employeeNI, totalDeductions, net: roundMoney(gross - totalDeductions),
    employerClass1, employerClass1A, payrollDeductions,
    payrollNet: payrollDeductions === null ? null : roundMoney(gross - payrollDeductions),
  };
}
