export const RULES = Object.freeze({
  coLower: 49293,
  coUpper: 64293,
  coMax: 500,
  coRate: 0.5,
  coMinimum: 20,
  spouseLower: 37000,
  spouseUpper: 40000,
  spouseRate: 0.18,
  balanceLimit: 2100000,
  standardCap: 130000,
  years: 20
});

const toCents = (amount) => Math.round(amount * 100);
const incomeSpan = RULES.coUpper - RULES.coLower;
const spouseCap = RULES.spouseUpper - RULES.spouseLower;

function payment(entitlementUnits, contributionCents) {
  // One unit is 1/30 of a cent. Keep the five-cent ceiling exact at boundaries.
  const matchedUnits = Math.min(entitlementUnits, contributionCents * RULES.coRate * 30);
  return matchedUnits > 0
    ? Math.max(RULES.coMinimum, Math.ceil(matchedUnits / 150) / 20)
    : 0;
}

function ratio(benefit, contribution) {
  return contribution > 0 ? (benefit / contribution) * 100 : null;
}

export function calculate({
  income, personalContribution, age, workShare, balance, personalCapRoom, personalConditions,
  spouseIncome, spouseContribution, spouseAge, spouseBalance, spouseCapRoom, spouseConditions,
  taxLiability, annualReturn
}) {
  const values = [
    income, personalContribution, age, workShare, balance, personalCapRoom,
    spouseIncome, spouseContribution, spouseAge, spouseBalance, spouseCapRoom, taxLiability, annualReturn
  ];
  if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e12)
      || Math.min(personalContribution, age, workShare, balance, spouseContribution, spouseAge, spouseBalance, taxLiability) < 0
      || !Number.isInteger(age) || !Number.isInteger(spouseAge)
      || workShare > 100 || annualReturn < -100 || annualReturn > 100) {
    throw new RangeError('Enter valid amounts, ages and percentages.');
  }

  const personalCents = toCents(personalContribution);
  const spouseCents = toCents(spouseContribution);
  const personalRoom = toCents(personalCapRoom);
  const spouseRoom = toCents(spouseCapRoom);
  const entitlementUnits = Math.max(0, incomeSpan * 100 - Math.max(0, toCents(income) - toCents(RULES.coLower)));
  const maxEntitlement = entitlementUnits / 3000;
  const spouseIncomeCap = Math.max(0, toCents(spouseCap) - Math.max(0, toCents(spouseIncome) - toCents(RULES.spouseLower)));
  const eligibleCap = spouseIncomeCap / 100;

  const personalReasons = [];
  if (entitlementUnits === 0) personalReasons.push('income is at or above A$64,293');
  if (age >= 71) personalReasons.push('age at 30 June 2027 is 71 or older');
  if (workShare < 10) personalReasons.push('employment and business income is below 10%');
  if (balance >= RULES.balanceLimit) personalReasons.push('30 June 2026 balance is at or above A$2.1 million');
  if (personalConditions !== true) personalReasons.push('the other co-contribution conditions need confirmation');
  const personalMeetsOtherRules = personalReasons.length === 0;
  if (personalCents > personalRoom || personalRoom <= 0) personalReasons.push('the contribution exceeds available cap room or no cap room remains');

  const spouseReasons = [];
  if (spouseIncomeCap === 0) spouseReasons.push('spouse income is at or above A$40,000');
  if (spouseAge >= 75) spouseReasons.push('spouse is 75 or older when paid');
  if (spouseBalance >= RULES.balanceLimit) spouseReasons.push('spouse’s 30 June 2026 balance is at or above A$2.1 million');
  if (spouseConditions !== true) spouseReasons.push('the other spouse offset conditions need confirmation');
  const spouseMeetsOtherRules = spouseReasons.length === 0;
  if (spouseCents > spouseRoom || spouseRoom <= 0) spouseReasons.push('the contribution exceeds available spouse cap room or no cap room remains');

  const personalIncomeTarget = Math.min(RULES.coMax / RULES.coRate, maxEntitlement / RULES.coRate);
  // Round up to a payable cent so the amount reaches the full unrounded match.
  const personalTargetCents = !personalMeetsOtherRules
    ? 0 : Math.max(0, Math.min(personalRoom, Math.ceil(entitlementUnits / 15)));
  const spouseTargetCents = !spouseMeetsOtherRules
    ? 0 : Math.max(0, Math.min(spouseRoom, spouseIncomeCap));

  const rawCo = personalReasons.length ? 0 : Math.min(maxEntitlement, RULES.coRate * personalCents / 100);
  const coPayment = personalReasons.length ? 0 : payment(entitlementUnits, personalCents);
  const spouseOffset = spouseReasons.length ? 0 : Math.min(spouseIncomeCap, spouseCents) * RULES.spouseRate / 100;
  const usableOffset = Math.min(taxLiability, spouseOffset);
  const combined = coPayment + usableOffset;
  const targetBenefit = payment(entitlementUnits, personalTargetCents)
    + Math.min(taxLiability, spouseTargetCents * RULES.spouseRate / 100);
  const growth = (1 + annualReturn / 100) ** RULES.years;

  return {
    maxEntitlement, eligibleCap, rawCo, coPayment, spouseOffset, usableOffset, combined,
    personalReasons, spouseReasons, personalIncomeTarget,
    personalTarget: personalTargetCents / 100,
    spouseTarget: spouseTargetCents / 100,
    potentialIncrease: Math.max(0, targetBenefit - combined),
    personalRatio: ratio(coPayment, personalCents / 100),
    spouseRatio: ratio(usableOffset, spouseCents / 100),
    combinedRatio: ratio(combined, (personalCents + spouseCents) / 100),
    coFutureValue: coPayment * growth,
    combinedFutureValue: combined * growth
  };
}
