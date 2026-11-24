export const TAX_YEAR = 2026;
export const CREDIT_CAP = 17_670;
export const REFUNDABLE_CAP = 5_120;
export const PHASE_START = 265_080;
export const PHASE_END = 305_080;
export const CARRY_YEARS = 5;
export const MAX_CHILDREN = 20;
const PHASE_WIDTH_CENTS = (PHASE_END - PHASE_START) * 100;

function cents(value, allowNegative = false) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e9 || (!allowNegative && value < 0)) {
    throw new RangeError('Enter a valid dollar amount.');
  }
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 0.00002) {
    throw new RangeError('Use no more than two decimal places.');
  }
  return rounded;
}

function phaseUnits(magiCents) {
  return Math.max(0, Math.min(PHASE_WIDTH_CENTS, PHASE_END * 100 - magiCents));
}

export function calculateAdoptionCredit({
  creditMagi, exclusionMagi, availableTax, children, priorCarry = Array(CARRY_YEARS).fill(0)
}) {
  if (!Array.isArray(children) || children.length < 1 || children.length > MAX_CHILDREN) {
    throw new RangeError('Enter between 1 and 20 child records.');
  }
  if (!Array.isArray(priorCarry) || priorCarry.length !== CARRY_YEARS) {
    throw new RangeError('Enter one carryforward balance per year from 2021 to 2025.');
  }

  const creditUnits = phaseUnits(cents(creditMagi, true));
  const exclusionUnits = phaseUnits(cents(exclusionMagi, true));
  const cap = CREDIT_CAP * 100;
  let remainingTax = cents(availableTax);
  let priorOffset = 0;
  let priorExpiring = 0;
  let priorCarried = 0;
  for (const [index, amount] of priorCarry.entries()) {
    const balance = cents(amount);
    const used = Math.min(remainingTax, balance);
    remainingTax -= used;
    priorOffset += used;
    if (index === 0) priorExpiring = balance - used;
    else priorCarried += balance - used;
  }

  let allowedCredit = 0;
  let refundableCredit = 0;
  let employerBenefits = 0;
  let exclusion = 0;
  let expenseReimbursements = 0;
  let netExpenses = 0;
  const byChild = Array.from(children, ({
    grossExpenses = 0, employerBenefit = 0, priorCreditBasis = 0, priorExclusionBasis = 0,
    specialNeeds = false, qualifiedPlan = false
  }) => {
    const gross = cents(grossExpenses);
    const benefits = cents(employerBenefit);
    const creditLimit = Math.max(0, cap - cents(priorCreditBasis));
    const exclusionLimit = Math.max(0, cap - cents(priorExclusionBasis));
    const reimbursed = Math.min(gross, benefits);
    const net = gross - reimbursed;
    const creditBeforePhase = specialNeeds ? creditLimit : Math.min(net, creditLimit);
    const exclusionBeforePhase = specialNeeds && qualifiedPlan
      ? exclusionLimit : Math.min(benefits, exclusionLimit);
    const credit = Math.round(creditBeforePhase * creditUnits / PHASE_WIDTH_CENTS);
    // Draft Form 8839 line 11b caps each child's credit after the MAGI reduction.
    const refundable = Math.min(credit, REFUNDABLE_CAP * 100);
    const excluded = Math.round(exclusionBeforePhase * exclusionUnits / PHASE_WIDTH_CENTS);
    allowedCredit += credit;
    refundableCredit += refundable;
    employerBenefits += benefits;
    exclusion += excluded;
    expenseReimbursements += reimbursed;
    netExpenses += net;
    return { credit: credit / 100, refundable: refundable / 100, excluded: excluded / 100 };
  });

  const taxOffset = Math.min(remainingTax, allowedCredit - refundableCredit);
  const carryforward = allowedCredit - refundableCredit - taxOffset;
  return {
    allowedCredit: allowedCredit / 100, refundableCredit: refundableCredit / 100,
    taxOffset: taxOffset / 100, carryforward: carryforward / 100,
    priorOffset: priorOffset / 100, priorExpiring: priorExpiring / 100, priorCarried: priorCarried / 100,
    employerBenefits: employerBenefits / 100, exclusion: exclusion / 100,
    taxableBenefitsAdjustment: (employerBenefits - exclusion) / 100,
    expenseReimbursements: expenseReimbursements / 100, netExpenses: netExpenses / 100,
    creditFactor: creditUnits / PHASE_WIDTH_CENTS, exclusionFactor: exclusionUnits / PHASE_WIDTH_CENTS, byChild
  };
}

export function projectCarryforward(balance, futureAvailableTax) {
  if (!Array.isArray(futureAvailableTax) || futureAvailableTax.length !== CARRY_YEARS) {
    throw new RangeError('Enter five annual tax capacities from 2027 to 2031.');
  }

  let remaining = cents(balance);
  return Array.from(futureAvailableTax, (capacity, index) => {
    const opening = remaining;
    const used = Math.min(opening, cents(capacity));
    const expires = index === CARRY_YEARS - 1 ? opening - used : 0;
    remaining = opening - used - expires;
    return {
      year: TAX_YEAR + index + 1, opening: opening / 100, used: used / 100,
      expires: expires / 100, remaining: remaining / 100
    };
  });
}
