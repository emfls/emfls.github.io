export const RULES = Object.freeze({
  threshold: 250_000,
  generalCap: 32_500,
  carryForwardBalanceLimit: 500_000,
  sgRate: 0.12,
  div293Rate: 0.15,
  fundRate: 0.15,
  personalBenchmarkRate: 0.47,
  topBracketFloor: 190_000,
  maxInput: 1_000_000_000,
});

const cents = (dollars) => Math.round(dollars * 100);
const dollars = (minorUnits) => minorUnits / 100;
const tax = (minorUnits, rate) => Math.round(minorUnits * Math.round(rate * 100) / 100);

function readAmount(input, key, minimum = 0) {
  const value = input[key] === undefined ? 0 : input[key];
  if (!Number.isFinite(value) || value < minimum || value > RULES.maxInput ||
      dollars(cents(value)) !== value) {
    throw new RangeError(`${key} must be within range and have at most two decimal places.`);
  }
  return cents(value);
}

function assess(income, lowTaxContributions) {
  const combined = income + lowTaxContributions;
  const excess = Math.max(0, combined - cents(RULES.threshold));
  const taxable = Math.min(lowTaxContributions, excess);
  return { combined, excess, taxable, due: tax(taxable, RULES.div293Rate) };
}

/**
 * Estimates ordinary accumulation-super contributions for 2026–27.
 * Inputs and outputs are AUD. Internally, money is held in integer cents.
 * Taxable income is the entered scenario after salary sacrifice and deductions.
 */
export function calculateDivision293(input = {}) {
  const taxableIncome = readAmount(input, 'taxableIncome', -RULES.maxInput);
  const div293Income = taxableIncome +
    readAmount(input, 'reportableFringeBenefits') +
    readAmount(input, 'netFinancialInvestmentLosses') +
    readAmount(input, 'netRentalPropertyLosses') +
    readAmount(input, 'familyTrustDistributionAmount') -
    readAmount(input, 'assessableFhssRelease') -
    readAmount(input, 'zeroRatedSuperLumpSum');
  const employer = readAmount(input, 'employerContributions');
  const voluntary = readAmount(input, 'voluntaryContributions');
  const total = employer + voluntary;
  const unusedCap = readAmount(input, 'unusedCap');
  const balanceKnown = input.totalSuperBalance != null;
  const carryForwardEligible = balanceKnown &&
    readAmount(input, 'totalSuperBalance') < cents(RULES.carryForwardBalanceLimit);
  const generalCap = cents(RULES.generalCap);
  const applicableCap = generalCap + (carryForwardEligible ? unusedCap : 0);
  const lowTaxContrib = Math.min(total, applicableCap);
  const excessContributions = total - lowTaxContrib;
  const current = assess(div293Income, lowTaxContrib);
  const generalCapOnly = assess(div293Income, Math.min(total, generalCap));
  const fundTax = tax(lowTaxContrib, RULES.fundRate);
  const totalTax = fundTax + current.due;

  let voluntaryComparison = null;
  if (voluntary > 0 && excessContributions === 0 &&
      taxableIncome >= cents(RULES.topBracketFloor)) {
    // In the cash scenario, the voluntary amount returns to taxable income.
    const withoutVoluntary = assess(div293Income + voluntary, employer);
    const incrementalDiv293 = current.due - withoutVoluntary.due;
    const incrementalFundTax = fundTax - tax(employer, RULES.fundRate);
    const personalTax = tax(voluntary, RULES.personalBenchmarkRate);
    voluntaryComparison = {
      incomeTaxAt47: dollars(personalTax),
      incrementalFundTax: dollars(incrementalFundTax),
      incrementalDiv293Tax: dollars(incrementalDiv293),
      netTaxSaving: dollars(personalTax - incrementalFundTax - incrementalDiv293),
    };
  }

  return {
    div293Income: dollars(div293Income),
    totalConcessionalContributions: dollars(total),
    applicableConcessionalCap: dollars(applicableCap),
    lowTaxContrib: dollars(lowTaxContrib),
    excessConcessionalContributions: dollars(excessContributions),
    combined: dollars(current.combined),
    excessOver250k: dollars(current.excess),
    taxableContributions: dollars(current.taxable),
    div293Tax: dollars(current.due),
    fundTax: dollars(fundTax),
    totalTaxOnLowTaxContributions: dollars(totalTax),
    effectiveSuperTaxRate: lowTaxContrib ? totalTax / lowTaxContrib : null,
    carryForwardEligible,
    carryForwardUsed: dollars(lowTaxContrib - Math.min(total, generalCap)),
    carryForwardDiv293Increase: dollars(current.due - generalCapOnly.due),
    carryForwardCrossedThreshold: generalCapOnly.excess === 0 && current.excess > 0,
    cashPayment: { cashOutlay: dollars(current.due), superRetained: dollars(lowTaxContrib - fundTax) },
    superPayment: { cashOutlay: 0, superRetained: dollars(lowTaxContrib - totalTax) },
    voluntaryComparison,
  };
}
