export const PARAMETERS = Object.freeze({
  baseLimit: 13_598,
  serviceAmount: 6_801,
  etpCap: 270_000,
  incomeCap: 180_000,
  pensionAge: 67,
  preservationAge: 60,
  etpUnder60Rate: 32,
  etp60Rate: 17,
  topRate: 47,
  leaveRate: 32,
});

const cents = amount => Math.round(amount * 100);
const dollars = amount => amount / 100;
const nonnegative = amount => Math.max(0, amount);

// Resident tax in hundredths of a cent, using whole percentage rates and the standard Medicare levy.
function ordinaryTaxHundredths(income) {
  return income * 2
    + nonnegative(Math.min(income, 4_500_000) - 1_820_000) * 15
    + nonnegative(Math.min(income, 13_500_000) - 4_500_000) * 30
    + nonnegative(Math.min(income, 19_000_000) - 13_500_000) * 37
    + nonnegative(income - 19_000_000) * 45;
}

export function ordinaryTax(income) {
  if (!Number.isFinite(income) || income < 0 || income > 40_000_000) {
    throw new RangeError('Enter a valid taxable income.');
  }
  return dollars(Math.round(ordinaryTaxHundredths(cents(income)) / 100));
}

export function calculatePayout({
  years, age, reaches60, genuine, severance, notice, qualifyingNotice, leave, priorIncome,
}) {
  if (!Number.isFinite(years) || years < 0 || years > 40) {
    throw new RangeError('Enter years of service from 0 to 40.');
  }
  if (!Number.isInteger(age) || age < 18 || age > 75) {
    throw new RangeError('Enter an age in whole years from 18 to 75.');
  }
  if ([reaches60, genuine, qualifyingNotice].some(value => typeof value !== 'boolean')) {
    throw new RangeError('Select the applicable redundancy, notice and age options.');
  }
  if ([severance, notice, leave, priorIncome].some(amount =>
    !Number.isFinite(amount) || amount < 0 || amount > 10_000_000 || dollars(cents(amount)) !== amount
  )) {
    throw new RangeError('Enter each amount from A$0 to A$10,000,000, with up to two decimal places.');
  }

  const eligible = genuine && age < PARAMETERS.pensionAge;
  const taxFreeLimit = eligible ? PARAMETERS.baseLimit + PARAMETERS.serviceAmount * Math.floor(years) : 0;
  const redundancyCents = genuine ? cents(severance) + (qualifyingNotice ? cents(notice) : 0) : 0;
  const taxFreeCents = Math.min(redundancyCents, cents(taxFreeLimit));
  // Redundancy that fails only the age test can still be excluded for ETP cap purposes.
  const excludedCents = redundancyCents - taxFreeCents;
  const otherCents = cents(severance) + cents(notice) - redundancyCents;
  const leaveCents = cents(leave);
  const priorCents = cents(priorIncome);

  const etpCapCents = cents(PARAMETERS.etpCap);
  const excludedWithinCap = Math.min(excludedCents, etpCapCents);
  // Apply the excluded component first. Its taxable amount and taxable leave reduce the income cap.
  const otherCap = nonnegative(Math.min(
    etpCapCents - excludedCents,
    cents(PARAMETERS.incomeCap) - priorCents - leaveCents - excludedCents,
  ));
  const withinCap = excludedWithinCap + Math.min(otherCents, otherCap);
  const aboveCap = excludedCents + otherCents - withinCap;
  const etpRate = age >= PARAMETERS.preservationAge || (age === 59 && reaches60)
    ? PARAMETERS.etp60Rate
    : PARAMETERS.etpUnder60Rate;
  const etpTax = Math.round((withinCap * etpRate + aboveCap * PARAMETERS.topRate) / 100);
  const priorTax = ordinaryTaxHundredths(priorCents);
  const leaveTaxHundredths = eligible
    ? leaveCents * PARAMETERS.leaveRate
    : ordinaryTaxHundredths(priorCents + leaveCents) - priorTax;
  const leaveTax = Math.round(leaveTaxHundredths / 100);
  const gross = cents(severance) + cents(notice) + leaveCents;
  const totalTax = etpTax + leaveTax;
  const ordinaryPayoutTax = Math.round((ordinaryTaxHundredths(priorCents + gross) - priorTax) / 100);

  return {
    eligible,
    taxFreeLimit,
    taxFreePayout: dollars(taxFreeCents),
    excludedEtp: dollars(excludedCents),
    otherEtp: dollars(otherCents),
    taxableEtp: dollars(excludedCents + otherCents),
    otherEtpCap: dollars(otherCap),
    etpWithinCap: dollars(withinCap),
    etpAboveCap: dollars(aboveCap),
    etpRate: etpRate / 100,
    etpTax: dollars(etpTax),
    leaveTax: dollars(leaveTax),
    grossPayout: dollars(gross),
    totalTax: dollars(totalTax),
    netPayout: dollars(gross - totalTax),
    ordinaryPayoutTax: dollars(ordinaryPayoutTax),
    taxSaved: dollars(ordinaryPayoutTax - totalTax),
  };
}
