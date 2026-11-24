// UK tax year 2026/27, with a full 12-month company accounting period.
const BASIC_LIMIT = 37700;
const ADDITIONAL_THRESHOLD = 125140;
const PERSONAL_ALLOWANCE = 12570;
const DIVIDEND_ALLOWANCE = 500;
const NI_UPPER_LIMIT = 50270;
const EMPLOYER_THRESHOLD = 5000;
const EMPLOYER_NI_RATE = 0.15;
export const STANDARD_ANNUAL_ALLOWANCE = 60000;
export const STANDARD_LUMP_SUM_ALLOWANCE = 268275;
export const MPAA = 10000;

function positive(amount) {
  return Math.max(0, amount);
}

export function corporationTax(profit, associates = 0, qualifyingDistributions = 0) {
  const lower = 50000 / (associates + 1);
  const upper = 250000 / (associates + 1);
  const augmented = profit + qualifyingDistributions;
  if (augmented <= lower) return profit * 0.19;
  if (augmented >= upper) return profit * 0.25;
  return profit * 0.25 - (3 / 200) * (upper - augmented) * (profit / augmented);
}

function taxThrough(income, basic, higher, additional) {
  return Math.min(income, BASIC_LIMIT) * basic
    + positive(Math.min(income, ADDITIONAL_THRESHOLD) - BASIC_LIMIT) * higher
    + positive(income - ADDITIONAL_THRESHOLD) * additional;
}

export function personalTax(ordinaryIncome, dividends) {
  const gross = ordinaryIncome + dividends;
  const allowance = Math.min(gross, positive(PERSONAL_ALLOWANCE - positive(gross - 100000) / 2));
  const taxable = gross - allowance;
  const minOrdinary = positive(ordinaryIncome - allowance);
  const maxOrdinary = Math.min(ordinaryIncome, taxable);
  const dividendTaxThrough = income => taxThrough(income, 0.1075, 0.3575, 0.3935);

  // Tax is piecewise linear as the allowance moves between income types.
  // Check each band edge and each edge reached by the dividend zero-rate slice.
  const candidates = [
    minOrdinary, maxOrdinary, taxable - DIVIDEND_ALLOWANCE,
    BASIC_LIMIT, ADDITIONAL_THRESHOLD,
    BASIC_LIMIT - DIVIDEND_ALLOWANCE, ADDITIONAL_THRESHOLD - DIVIDEND_ALLOWANCE
  ].filter(income => income >= minOrdinary && income <= maxOrdinary);

  let best = null;
  for (const ordinary of candidates) {
    const incomeTax = taxThrough(ordinary, 0.2, 0.4, 0.45);
    const dividendTax = dividendTaxThrough(taxable)
      - dividendTaxThrough(Math.min(taxable, ordinary + DIVIDEND_ALLOWANCE));
    const total = incomeTax + dividendTax;
    if (best === null || total < best.total) {
      best = { total, ordinary: incomeTax, dividend: dividendTax, allowance };
    }
  }
  return best;
}

export function employerNI(salary) {
  return positive(salary - EMPLOYER_THRESHOLD) * EMPLOYER_NI_RATE;
}

export function employeeNI(salary) {
  return positive(Math.min(salary, NI_UPPER_LIMIT) - PERSONAL_ALLOWANCE) * 0.08
    + positive(salary - NI_UPPER_LIMIT) * 0.02;
}

export function bonusFromBudget(budget, salary) {
  const noEmployerNI = Math.min(budget, positive(EMPLOYER_THRESHOLD - salary));
  return noEmployerNI + (budget - noEmployerNI) / (1 + EMPLOYER_NI_RATE);
}

export function pensionAllowance(contribution, alreadySaved, annual, carryForward, mpaaRemaining) {
  const standardRemaining = positive(annual + carryForward - alreadySaved);
  const available = mpaaRemaining === null ? standardRemaining : Math.min(standardRemaining, mpaaRemaining);
  return { available, remaining: positive(available - contribution), excess: positive(contribution - available) };
}

export function retirementValue(contribution, taxableWithdrawalRate, lumpSumAllowance) {
  const taxFree = Math.min(contribution * 0.25, lumpSumAllowance);
  const tax = (contribution - taxFree) * taxableWithdrawalRate;
  return { taxFree, tax, net: contribution - tax };
}

export function compareExtraction({
  profit, slice, salary = 0, otherIncome = 0, dividends = 0, associates = 0, qualifyingDistributions = 0,
  otherPension = 0, annualAllowance = STANDARD_ANNUAL_ALLOWANCE, carryForward = 0, mpaaRemaining = null,
  retirementRate = 0.2, lumpSumAllowance = STANDARD_LUMP_SUM_ALLOWANCE
}) {
  const amounts = [profit, slice, salary, otherIncome, dividends, associates, qualifyingDistributions,
    otherPension, annualAllowance, carryForward, retirementRate, lumpSumAllowance, mpaaRemaining ?? 0];
  if (amounts.some(amount => !Number.isFinite(amount) || amount < 0 || amount > 1e9)) {
    throw new RangeError('Enter non-negative numbers up to 1 billion.');
  }
  if (slice > profit) throw new RangeError('The profit slice must be at or below taxable company profit.');
  if (!Number.isInteger(associates)) throw new RangeError('Enter a whole number of other associated companies.');
  if (retirementRate > 1) throw new RangeError('The retirement tax rate must be 0% to 100%.');
  if (mpaaRemaining > MPAA) throw new RangeError('Remaining money purchase annual allowance cannot exceed £10,000.');

  const corporationTaxBefore = corporationTax(profit, associates, qualifyingDistributions);
  const corporationTaxAfter = corporationTax(profit - slice, associates, qualifyingDistributions);
  const corporationTaxSaved = corporationTaxBefore - corporationTaxAfter;
  const ordinaryIncome = salary + otherIncome;
  const baseline = personalTax(ordinaryIncome, dividends).total;
  const dividendGross = positive(slice - corporationTaxSaved);
  const dividendPersonalTax = personalTax(ordinaryIncome, dividends + dividendGross).total - baseline;
  const dividend = {
    gross: dividendGross, corporationTax: corporationTaxSaved, personalTax: dividendPersonalTax,
    employerNI: 0, employeeNI: 0, net: dividendGross - dividendPersonalTax
  };

  const bonusGross = bonusFromBudget(slice, salary);
  const bonusEmployerNI = employerNI(salary + bonusGross) - employerNI(salary);
  const bonusEmployeeNI = employeeNI(salary + bonusGross) - employeeNI(salary);
  const bonusPersonalTax = personalTax(ordinaryIncome + bonusGross, dividends).total - baseline;
  const bonus = {
    gross: bonusGross, corporationTax: 0, personalTax: bonusPersonalTax, employerNI: bonusEmployerNI,
    employeeNI: bonusEmployeeNI, net: bonusGross - bonusEmployeeNI - bonusPersonalTax
  };

  const allowance = pensionAllowance(slice, otherPension, annualAllowance, carryForward, mpaaRemaining);
  const retirement = retirementValue(slice, retirementRate, lumpSumAllowance);
  const pension = {
    gross: slice, corporationTax: 0, personalTax: 0, employerNI: 0, employeeNI: 0, net: retirement.net
  };

  const ranked = Object.entries({ pension, dividend, bonus }).sort((a, b) => b[1].net - a[1].net);
  const [[first, best], [, second]] = ranked;
  const difference = best.net - second.net;
  const winner = allowance.excess > 0 ? null : {
    route: difference < 0.005 ? 'tie' : first,
    difference,
    boost: second.net > 0 ? difference / second.net : null
  };
  return {
    pension, dividend, bonus, retirement, allowance, winner,
    corporationTaxBefore, corporationTaxAfter, corporationTaxSaved,
    upfrontSaving: corporationTaxSaved + dividendPersonalTax
  };
}
