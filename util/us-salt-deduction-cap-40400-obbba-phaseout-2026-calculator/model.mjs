function parameters(standardDeduction, threshold = 505000, capShare = 1) {
  const maxCap = 40400 * capShare;
  const floor = 10000 * capShare;
  // Section 164(b)(6) halves the applicable limitation after the 30% reduction for MFS.
  const phaseRate = 0.30 * capShare;
  return Object.freeze({
    maxCap, threshold, floor, phaseRate, standardDeduction,
    floorMagi: threshold + (maxCap - floor) / phaseRate
  });
}

export const SALT_PARAMETERS = Object.freeze({
  single: parameters(16100),
  mfj: parameters(32200),
  hoh: parameters(24150),
  mfs: parameters(16100, 252500, 0.5)
});

const FEDERAL_RATES = [10, 12, 22, 24, 32, 35, 37];

function capAt(magi, { maxCap, threshold, floor, phaseRate, floorMagi }) {
  if (magi >= floorMagi) return floor;
  return maxCap - phaseRate * Math.max(0, magi - threshold);
}

/** Compares deductions at a constant user-selected rate, holding other deductions fixed. */
export function calculateSalt({
  filingStatus, magi, incomeTaxes, propertyTaxes, mortgageInterest,
  charitableDeduction, marginalRate, magiReduction = 0, spouseItemizes = false
}) {
  if (!Object.hasOwn(SALT_PARAMETERS, filingStatus)) throw new RangeError('Select a filing status.');
  if (!Number.isFinite(magi)) throw new RangeError('Enter a valid MAGI.');
  const expenses = [incomeTaxes, propertyTaxes, mortgageInterest, charitableDeduction, magiReduction];
  if (!expenses.every(amount => Number.isFinite(amount) && amount >= 0 && amount <= Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Enter valid nonnegative dollar amounts.');
  }
  if (!FEDERAL_RATES.includes(marginalRate)) throw new RangeError('Select a federal marginal bracket.');

  const limits = SALT_PARAMETERS[filingStatus];
  const standardDeduction = limits.standardDeduction;
  const standardAvailable = filingStatus !== 'mfs' || !spouseItemizes;
  const standardOption = standardAvailable ? standardDeduction : 0;
  const saltPaid = incomeTaxes + propertyTaxes;
  const saltCap = capAt(magi, limits);
  const allowableSalt = Math.min(saltPaid, saltCap);
  const otherItemized = mortgageInterest + charitableDeduction;
  const itemized = otherItemized + allowableSalt;
  const bestDeduction = Math.max(itemized, standardOption);
  const verdict = !standardAvailable || itemized > standardOption ? 'itemize'
    : itemized < standardOption ? 'standard' : 'tie';
  const oldBestDeduction = Math.max(standardOption, otherItemized + Math.min(saltPaid, limits.floor));
  const taxable = (income, deduction) => Math.max(0, income - deduction);
  const currentTaxable = taxable(magi, bestDeduction);
  const rate = marginalRate / 100;
  const taxSavedVsOldCap = (taxable(magi, oldBestDeduction) - currentTaxable) * rate;

  // Right-hand slope for an increase in MAGI, holding taxes paid and other deductions constant.
  const torpedoActive = magi >= limits.threshold && magi < limits.floorMagi
    && saltPaid >= saltCap && verdict === 'itemize' && magi >= bestDeduction;
  const effectiveMarginalRate = torpedoActive ? marginalRate * (1 + limits.phaseRate) : marginalRate;

  const scenarioMagi = magi - Math.min(Math.max(0, magi), magiReduction);
  const scenarioCap = capAt(scenarioMagi, limits);
  const scenarioSalt = Math.min(saltPaid, scenarioCap);
  const scenarioDeduction = Math.max(standardOption, otherItemized + scenarioSalt);
  const scenarioTaxable = taxable(scenarioMagi, scenarioDeduction);

  return {
    saltPaid, saltCap, allowableSalt, itemized, standardDeduction, standardAvailable,
    verdict, oldBestDeduction, taxSavedVsOldCap, effectiveMarginalRate, torpedoActive,
    rescue: {
      scenarioMagi,
      saltCap: scenarioCap,
      saltRestored: scenarioSalt - allowableSalt,
      saltTaxSavings: (taxable(scenarioMagi, bestDeduction) - scenarioTaxable) * rate,
      totalTaxSavings: (currentTaxable - scenarioTaxable) * rate,
      toFullCap: Math.max(0, magi - limits.threshold)
    }
  };
}
