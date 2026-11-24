const MAX_CENTS = 100_000_000_000;
const round = (numerator, denominator) => Math.floor((numerator + denominator / 2) / denominator);

export function parseCents(value) {
  const match = typeof value === 'string' && /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError('Enter a nonnegative amount with up to two decimal places and no commas.');
  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  checkCents(cents);
  return cents;
}

function checkCents(...amounts) {
  if (amounts.some(amount => !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_CENTS)) {
    throw new RangeError('Amounts must be between zero and one billion.');
  }
}

export const LCT_LIMIT = 9166100;
export const GST_CAR_LIMIT = 6988300;

export function residentTax(income) {
  checkCents(income);
  const bands = [[1820000, 0], [4500000, 15], [13500000, 30], [19000000, 37], [income, 45]];
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of bands) {
    tax += Math.max(0, Math.min(income, upper) - lower) * rate;
    lower = upper;
  }
  return round(tax, 100);
}

function offset(income) {
  const scaledOffset = 70000 * 1000
    - 50 * Math.max(0, Math.min(income, 4500000) - 3750000)
    - 15 * Math.max(0, income - 4500000);
  return Math.max(0, round(scaledOffset, 1000));
}

export function rfbaEstimate(baseValue) {
  checkCents(baseValue);
  // 20% statutory value × 1.8868, rounded once to cents.
  return round(baseValue * 9434, 25000);
}

export function calculateNovatedEV({
  salary, lctValue, baseValue, financeNet, runningGst, otherCosts, privateAnnualCost,
  vehicle, conditionsMet, commitment, medicare,
}) {
  checkCents(salary, lctValue, baseValue, financeNet, runningGst, otherCosts, privateAnnualCost);
  if (baseValue === 0 || lctValue === 0 || !['bev', 'fcev', 'phev', 'other'].includes(vehicle) ||
      !['confirmed', 'unconfirmed'].includes(conditionsMet) ||
      !['jul-mar', 'apr-jun'].includes(commitment) || !['full', 'none'].includes(medicare)) {
    throw new RangeError('Check vehicle prices, eligibility, commitment timing and Medicare assumptions.');
  }
  const purchaseGstCredit = round(Math.min(lctValue, GST_CAR_LIMIT), 11);
  const rfba = rfbaEstimate(baseValue);
  const reportable = baseValue > 1000000;
  const thresholdPassed = lctValue <= LCT_LIMIT;
  const eligibility = !['bev', 'fcev'].includes(vehicle) || !thresholdPassed ? 'ineligible'
    : conditionsMet !== 'confirmed' || commitment === 'apr-jun' ? 'needs-review' : 'eligible';
  if (eligibility !== 'eligible') return {eligibility, thresholdPassed, rfba, reportable, purchaseGstCredit};

  const runningGstCredit = round(runningGst, 11);
  const sacrifice = financeNet + runningGst - runningGstCredit + otherCosts;
  if (sacrifice > salary) throw new RangeError('Annual packaged costs cannot exceed cash salary.');
  const taxableAfter = salary - sacrifice;
  const incomeTax = income => Math.max(0, residentTax(income) - offset(income));
  const levy = income => medicare === 'full' ? round(income * 2, 100) : 0;
  const incomeTaxSavings = incomeTax(salary) - incomeTax(taxableAfter);
  const levySavings = levy(salary) - levy(taxableAfter);
  const netAnnualCost = sacrifice - incomeTaxSavings - levySavings;
  return {
    eligibility, thresholdPassed, rfba, reportable, purchaseGstCredit, runningGstCredit, sacrifice, taxableAfter,
    incomeTaxSavings, levySavings, fbt: 0, netAnnualCost, privateAnnualCost,
    difference: privateAnnualCost - netAnnualCost,
  };
}
