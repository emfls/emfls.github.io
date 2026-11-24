// IRS Publication 590-B, Appendix B, Table I. Array indices are attained ages.
const singleLife = [
  84.6, 83.7, 82.8, 81.8, 80.8, 79.8, 78.8, 77.9, 76.9, 75.9,
  74.9, 73.9, 72.9, 71.9, 70.9, 69.9, 69.0, 68.0, 67.0, 66.0,
  65.0, 64.1, 63.1, 62.1, 61.1, 60.2, 59.2, 58.2, 57.3, 56.3,
  55.3, 54.4, 53.4, 52.5, 51.5, 50.5, 49.6, 48.6, 47.7, 46.7,
  45.7, 44.8, 43.8, 42.9, 41.9, 41.0, 40.0, 39.0, 38.1, 37.1,
  36.2, 35.3, 34.3, 33.4, 32.5, 31.6, 30.6, 29.8, 28.9, 28.0,
  27.1, 26.2, 25.4, 24.5, 23.7, 22.9, 22.0, 21.2, 20.4, 19.6,
  18.8, 18.0, 17.2, 16.4, 15.6, 14.8, 14.1, 13.3, 12.6, 11.9,
  11.2, 10.5, 9.9, 9.3, 8.7, 8.1, 7.6, 7.1, 6.6, 6.1,
  5.7, 5.3, 4.9, 4.6, 4.3, 4.0, 3.7, 3.4, 3.2, 3.0,
  2.8, 2.6, 2.5, 2.3, 2.2, 2.1, 2.1, 2.1, 2.0, 2.0,
  2.0, 2.0, 2.0, 1.9, 1.9, 1.8, 1.8, 1.6, 1.4, 1.1, 1.0,
];

const rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
// Rev. Proc. 2025-32, section 4.01. Lower bounds for ordinary taxable income.
const brackets = {
  single: [0, 12400, 50400, 105700, 201775, 256225, 640600],
  mfj: [0, 24800, 100800, 211400, 403550, 512450, 768700],
};

function requireRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
}

export function singleLifeDivisor(age) {
  requireRange(age, 0, Number.MAX_SAFE_INTEGER, 'Age');
  if (!Number.isInteger(age)) throw new RangeError('Use an age in whole years.');
  return singleLife[Math.min(age, 120)];
}

export function federalTax2026(taxableIncome, filingStatus) {
  requireRange(taxableIncome, 0, Number.MAX_SAFE_INTEGER, 'Taxable income');
  if (!Object.hasOwn(brackets, filingStatus)) throw new RangeError('Choose a filing status.');
  const bounds = brackets[filingStatus];
  return bounds.reduce((tax, lower, i) => {
    const taxableInBracket = Math.max(0, Math.min(taxableIncome, bounds[i + 1] ?? Infinity) - lower);
    return tax + taxableInBracket * rates[i];
  }, 0);
}

export function form5329Penalty(shortfall) {
  requireRange(shortfall, 0, 1e9, 'Missed RMD');
  const cents = Math.round((shortfall + Number.EPSILON) * 100);
  return { standard: Math.round(cents * 0.25) / 100, corrected: Math.round(cents * 0.10) / 100, fullWaiver: 0 };
}

export function simulateInheritedIra({
  accountType, beneficiaryType, edbType = 'other', ownerTiming,
  balance, age, ownerAgeAtDeath, annualReturn, otherTaxableIncome, filingStatus,
  shortfall = 0,
}) {
  if (!['traditional_ira', 'roth_ira'].includes(accountType)) throw new RangeError('Choose an account type.');
  if (!['non_edb', 'edb_stretch'].includes(beneficiaryType)) throw new RangeError('Choose a beneficiary type.');
  if (!['before_rbd', 'on_or_after_rbd'].includes(ownerTiming)) throw new RangeError('Choose the owner’s RBD timing.');
  requireRange(balance, 0, 1e9, 'Opening balance');
  requireRange(annualReturn, -99, 100, 'Annual return');
  requireRange(age, 1, 129, 'Beneficiary age');
  requireRange(otherTaxableIncome, 0, 1e9, 'Other taxable income');

  const roth = accountType === 'roth_ira';
  const edb = beneficiaryType === 'edb_stretch';
  if (edb && !['other', 'spouse', 'minor'].includes(edbType)) throw new RangeError('Choose an eligible beneficiary category.');
  const spouse = edb && edbType === 'spouse';
  const minor = edb && edbType === 'minor';
  if (minor && age > 21) throw new RangeError('For the minor-child rule, age in Year 1 must be 21 or younger.');
  const afterRbd = !roth && ownerTiming === 'on_or_after_rbd';
  const beneficiaryDivisor = singleLifeDivisor(age);
  let ownerDivisor = 0;
  if (afterRbd) {
    requireRange(ownerAgeAtDeath, 70, 129, 'Owner’s age at death');
    ownerDivisor = singleLifeDivisor(ownerAgeAtDeath);
  }

  // Year 1 is the calendar year after death. A child who reaches 21 in
  // Year 1 has a deadline in Year 11, with annual distributions continuing.
  const deadlineYear = edb ? (minor ? 32 - age : null) : 10;
  const horizon = 10;
  const growth = 1 + annualReturn / 100;
  const baselineTax = federalTax2026(otherTaxableIncome, filingStatus);
  // Discount ten end-of-year payments at the assumed return. Summing the
  // factors also handles a zero or near-zero rate without cancellation.
  const levelTarget = balance / Array.from({ length: horizon }, (_, i) => growth ** -(i + 1))
    .reduce((sum, factor) => sum + factor, 0);

  function runStrategy(smooth) {
    let remaining = balance;
    let totalTax = 0;
    let totalWithdrawn = 0;
    const rows = [];
    for (let year = 1; year <= horizon; year += 1) {
      const opening = remaining;
      const available = opening * growth;
      const beneficiaryRemaining = spouse ? singleLifeDivisor(age + year - 1) : beneficiaryDivisor - (year - 1);
      const divisor = edb || afterRbd ? Math.max(1, beneficiaryRemaining, ownerDivisor - year) : null;
      const fullPayout = year === deadlineYear;
      const required = fullPayout ? available : divisor === null ? 0 : opening / divisor;
      // In a loss year the entire available account can be less than the RMD.
      // Retain the computed requirement and show the amount actually available.
      const target = smooth ? levelTarget : 0;
      const planned = Math.max(required, target);
      const tolerance = 8 * Number.EPSILON * Math.max(balance, available);
      const finalLevelPayment = smooth && year === horizon && available - planned <= tolerance;
      const withdrawal = finalLevelPayment ? available : Math.min(available, planned);
      remaining = available - withdrawal;
      const tax = roth ? 0 : federalTax2026(otherTaxableIncome + withdrawal, filingStatus) - baselineTax;
      totalTax += tax;
      totalWithdrawn += withdrawal;
      rows.push({ year, opening, divisor: fullPayout ? null : divisor, required, withdrawal, tax, closing: remaining });
    }
    return { rows, totalTax, totalWithdrawn, endingBalance: remaining };
  }

  const minimum = runStrategy(false);
  const level = runStrategy(true);
  return {
    annualRmd: edb || afterRbd, deadlineYear, baselineTax, levelTarget, minimum, level,
    taxSaved: minimum.totalTax - level.totalTax,
    penalty: form5329Penalty(shortfall),
  };
}
