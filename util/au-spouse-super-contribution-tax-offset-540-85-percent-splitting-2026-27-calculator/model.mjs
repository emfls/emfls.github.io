export const RULES = Object.freeze({
  offsetRate: 0.18,
  offsetBase: 3000,
  fullOffsetIncome: 37000,
  zeroOffsetIncome: 40000,
  nonConcessionalCap: 130000,
  concessionalCap: 32500,
  carryForwardBalanceLimit: 500000,
  splitRate: 0.85,
  generalTbc: 2100000,
  div296: 3000000
});

function cents(amount) {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) {
    throw new RangeError('Enter a non-negative amount up to A$1 trillion.');
  }
  return Math.round(amount * 100);
}

function whole(value, max, label) {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`Enter a whole number from 0 to ${max} for ${label}.`);
  }
  return value;
}

export function calculateOffset({
  assessableIncome, fringeBenefits, reportableSuper, contribution, age, priorBalance,
  otherNonConcessional, nonConcessionalCap = RULES.nonConcessionalCap,
  bothResidents, qualifyingPayment
}) {
  const income = cents(assessableIncome) + cents(fringeBenefits) + cents(reportableSuper);
  const paid = cents(contribution);
  const balance = cents(priorBalance);
  const totalNonConcessional = paid + cents(otherNonConcessional);
  const cap = cents(nonConcessionalCap);
  whole(age, 120, 'age');

  const maxBase = Math.max(0, RULES.offsetBase * 100 - Math.max(0, income - RULES.fullOffsetIncome * 100));
  const reasons = [];
  if (bothResidents !== true) reasons.push('Both spouses must be Australian tax residents when the contribution is made.');
  if (qualifyingPayment !== true) reasons.push('The payment must meet the spouse and complying fund conditions.');
  if (age >= 75) reasons.push('Age 75 or older is outside this estimate. Check the fund’s 75th birthday acceptance window.');
  if (balance >= RULES.generalTbc * 100) reasons.push('The receiving spouse’s prior 30 June total super balance meets or exceeds A$2.1 million.');
  if (totalNonConcessional > cap) reasons.push('The receiving spouse’s total after-tax contributions exceed the cap entered.');
  if (maxBase === 0) reasons.push('The receiving spouse’s income for the offset is A$40,000 or more.');

  const qualifying = reasons.length === 0 ? Math.min(paid, maxBase) : 0;
  const offset = Math.round(qualifying * RULES.offsetRate);
  return {
    spouseIncome: income / 100,
    maxEligibleContribBase: maxBase / 100,
    qualifyingContrib: qualifying / 100,
    taxOffset: offset / 100,
    offsetPercent: paid > 0 ? qualifying / paid * RULES.offsetRate * 100 : null,
    reasons
  };
}

export function calculateSplit({gross, age, notRetired, priorBalance, unusedCap, fundAllows}) {
  const paid = cents(gross);
  const balance = cents(priorBalance);
  const unused = cents(unusedCap);
  whole(age, 120, 'age at application');

  const standardCap = RULES.concessionalCap * 100;
  const carryForwardUsed = balance < RULES.carryForwardBalanceLimit * 100
    ? Math.min(unused, Math.max(0, paid - standardCap))
    : 0;
  const applicableCap = standardCap + carryForwardUsed;
  const net = paid * RULES.splitRate;
  const ageEligible = age < 60 || (age < 65 && notRetired === true);
  const eligible = ageEligible && fundAllows === true;
  return {
    ageEligible,
    eligible,
    netAfter15PctTax: Math.round(net) / 100,
    applicableCap: applicableCap / 100,
    carryForwardUsed: carryForwardUsed / 100,
    excessConcessional: Math.max(0, paid - applicableCap) / 100,
    maxSplittableAmount: eligible ? Math.min(Math.floor(net), applicableCap) / 100 : 0
  };
}

function thresholdStatus(balance, threshold) {
  if (balance < threshold) return 'below';
  return balance > threshold ? 'above' : 'at';
}

function partnerBalances(withSplit, withoutSplit) {
  return {
    withSplit: withSplit / 100,
    withoutSplit: withoutSplit / 100,
    tbcStatus: thresholdStatus(withSplit, RULES.generalTbc * 100),
    div296Status: thresholdStatus(withSplit, RULES.div296 * 100)
  };
}

export function projectBalances(splitInputs, {higher, lower, years}) {
  const senderStart = cents(higher);
  const recipientStart = cents(lower);
  if (senderStart < recipientStart) throw new RangeError('The sender’s starting balance must be at least the recipient’s.');
  whole(years, 75, 'years to retirement');

  const initial = calculateSplit(splitInputs);
  let transferred = 0;
  let yearsWithSplit = 0;
  for (let year = 0; year < years && splitInputs.age + year < 65; year++) {
    const annual = year === 0 ? initial : calculateSplit({
      ...splitInputs, age: splitInputs.age + year, unusedCap: 0
    });
    if (annual.maxSplittableAmount === 0) break;
    transferred += cents(annual.maxSplittableAmount);
    yearsWithSplit++;
  }

  const senderBaseline = senderStart + years * cents(initial.netAfter15PctTax);
  return {
    sender: partnerBalances(senderBaseline - transferred, senderBaseline),
    recipient: partnerBalances(recipientStart + transferred, recipientStart),
    totalSplit: transferred / 100,
    yearsWithSplit
  };
}
