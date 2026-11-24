export const RULES = Object.freeze({
  grantIncomeThreshold: 117045,
  fullBondIncome: 38237,
  zeroBondIncome: 58523,
  contributionLimit: 200000,
  grantLimit: 70000,
  bondLimit: 20000,
  grantPaymentLimit: 10500,
  bondPaymentLimit: 11000,
  assistanceAgeLimit: 49,
  contributionAgeLimit: 59,
});

const cents = (dollars) => Math.round(dollars * 100);
const dollars = (amount) => amount / 100;

function number(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

function age(value, label) {
  number(value, 0, 120, label);
  if (!Number.isInteger(value)) throw new RangeError(`${label} must be a whole number.`);
  return value;
}

function annualGrantTiers(afni) {
  // Entries describe grant dollars available at each rate, in descending order.
  return afni <= RULES.grantIncomeThreshold ? [1500, 2000, 0] : [0, 0, 1000];
}

export function annualBond(afni) {
  number(afni, 0, Number.MAX_SAFE_INTEGER, 'Adjusted family net income');
  const { fullBondIncome, zeroBondIncome } = RULES;
  const fraction = (zeroBondIncome - afni) / (zeroBondIncome - fullBondIncome);
  return dollars(cents(1000 * Math.max(0, Math.min(1, fraction))));
}

function matchGrant(contribution, tiers, limit) {
  let grant = 0;
  let used = 0;
  for (const [index, rate] of [3, 2, 1].entries()) {
    const available = Math.min(tiers[index], limit - grant);
    const matched = Math.min(contribution - used, Math.ceil(available / rate));
    grant += Math.min(matched * rate, available);
    used += matched;
  }
  return { grant, used };
}

export function calculateRDSP({
  beneficiaryAge = 30, eligible = true, afni = 35000,
  contribution = 1500, contributed = 0, grantsReceived = 0, bondsReceived = 0,
  carry300 = 0, carry200 = 0, carry100 = 0, carryBond = 0,
  balance = 0, annualReturn = 5,
} = {}) {
  age(beneficiaryAge, '2026 beneficiary age');
  number(afni, 0, Number.MAX_SAFE_INTEGER, 'Adjusted family net income');
  number(contribution, 0, RULES.contributionLimit, 'Planned annual contribution');
  number(contributed, 0, RULES.contributionLimit, 'Past contributions and rollovers');
  number(grantsReceived, 0, RULES.grantLimit, 'Grants received');
  number(bondsReceived, 0, RULES.bondLimit, 'Bonds received');
  number(balance, 0, 1e9, 'Opening balance');
  number(annualReturn, -100, 20, 'Annual return');

  const carryTiers = [
    number(carry300, 0, 15000, 'Unused 300% grant'),
    number(carry200, 0, 20000, 'Unused 200% grant'),
    number(carry100, 0, 10000, 'Unused 100% grant'),
  ];
  number(carryBond, 0, 10000, 'Unused bond');

  const canContribute = eligible && beneficiaryAge <= RULES.contributionAgeLimit;
  const canReceive = eligible && beneficiaryAge <= RULES.assistanceAgeLimit;
  let contributionRoom = cents(RULES.contributionLimit) - cents(contributed);
  let grantRoom = cents(RULES.grantLimit) - cents(grantsReceived);
  let bondRoom = cents(RULES.bondLimit) - cents(bondsReceived);
  const requested = cents(contribution);
  const contribution2026 = canContribute ? Math.min(requested, contributionRoom) : 0;
  const baseTiers = canReceive ? annualGrantTiers(afni).map(cents) : [0, 0, 0];
  const combinedTiers = baseTiers.map((base, i) => base + (canReceive ? cents(carryTiers[i]) : 0));
  const baseBond = canReceive ? cents(annualBond(afni)) : 0;
  const annualGrant = matchGrant(contribution2026, baseTiers, grantRoom).grant;
  const annualBondAmount = Math.min(baseBond, bondRoom);
  const grantLimit2026 = Math.min(grantRoom, cents(RULES.grantPaymentLimit));
  const grant2026 = matchGrant(contribution2026, combinedTiers, grantLimit2026).grant;
  const bond2026 = canReceive
    ? Math.min(baseBond + cents(carryBond), bondRoom, cents(RULES.bondPaymentLimit))
    : 0;
  const optimal = matchGrant(canContribute ? contributionRoom : 0, combinedTiers, grantLimit2026);

  // Start with the balance before 2026, grow it annually, then add year-end deposits.
  // The projection holds 2026 income and rules constant and applies carry-forward once.
  let projectedBalance = balance;
  for (let yearAge = beneficiaryAge; yearAge < 60; yearAge += 1) {
    const firstYear = yearAge === beneficiaryAge;
    const deposit = canContribute ? Math.min(requested, contributionRoom) : 0;
    const grant = firstYear ? grant2026
      : yearAge <= RULES.assistanceAgeLimit ? matchGrant(deposit, baseTiers, grantRoom).grant : 0;
    const bond = firstYear ? bond2026
      : yearAge <= RULES.assistanceAgeLimit ? Math.min(baseBond, bondRoom) : 0;
    projectedBalance = projectedBalance * (1 + annualReturn / 100) + dollars(deposit + grant + bond);
    contributionRoom -= deposit;
    grantRoom -= grant;
    bondRoom -= bond;
  }

  const lifetimeGrant = cents(RULES.grantLimit) - grantRoom;
  const lifetimeBond = cents(RULES.bondLimit) - bondRoom;
  return {
    canContribute, canReceive, contribution2026: dollars(contribution2026),
    annualGrant: dollars(annualGrant), annualBond: dollars(annualBondAmount),
    grant2026: dollars(grant2026), bond2026: dollars(bond2026),
    optimalContribution: dollars(optimal.used), maximumGrant2026: dollars(optimal.grant),
    lifetimeGrant: dollars(lifetimeGrant), lifetimeBond: dollars(lifetimeBond),
    lifetimeAssistance: dollars(lifetimeGrant + lifetimeBond),
    projectedBalance: beneficiaryAge > 60 ? null : dollars(cents(projectedBalance)),
  };
}

export function calculateRepayment({ withdrawalAge, withdrawal, holdback }) {
  age(withdrawalAge, 'Age in the withdrawal year');
  number(withdrawal, 0, 1e9, 'Withdrawal');
  number(holdback, 0, RULES.grantLimit + RULES.bondLimit, 'Assistance holdback amount');
  const payment = cents(withdrawal);
  const repayment = withdrawalAge < 60 ? Math.min(payment * 3, cents(holdback)) : 0;
  return { repayment: dollars(repayment), planReduction: dollars(payment + repayment) };
}
