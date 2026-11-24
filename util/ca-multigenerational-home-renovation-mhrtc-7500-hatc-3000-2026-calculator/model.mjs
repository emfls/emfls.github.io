const federalPercent = 14;
const medicalIncomePercent = 3;

export const parameters = Object.freeze({
  rate: federalPercent / 100,
  suiteCap: 50000,
  accessibilityCap: 20000,
  medicalThresholdCap: 2890,
  medicalIncomeRate: medicalIncomePercent / 100,
  maxInput: 100000000,
});

function moneyInCents(amount) {
  if (!Number.isFinite(amount) || amount < 0 || amount > parameters.maxInput) {
    throw new RangeError('Enter an amount from $0 to $100,000,000.');
  }
  const cents = Math.round(amount * 100);
  if (amount !== cents / 100) throw new RangeError('Use up to two decimal places.');
  return cents;
}

function percentOf(cents, percent) {
  return Math.round(cents * percent / 100);
}

export function calculateCredits({
  individual, suiteCost, accessibilityCost, medicalEligible, netIncome, federalTax,
}) {
  if (individual !== 'senior' && individual !== 'dtc-adult') {
    throw new RangeError('Select a qualifying individual.');
  }
  const suite = moneyInCents(suiteCost);
  const accessibility = moneyInCents(accessibilityCost);
  const eligibleMedical = moneyInCents(medicalEligible);
  const income = moneyInCents(netIncome);
  const tax = moneyInCents(federalTax);
  if (eligibleMedical > accessibility) {
    throw new RangeError('The medical-eligible portion must fit within the separate accessibility cost.');
  }

  const suiteClaim = Math.min(suite, parameters.suiteCap * 100);
  const accessibilityClaim = Math.min(accessibility, parameters.accessibilityCap * 100);
  const medicalThreshold = Math.min(percentOf(income, medicalIncomePercent), parameters.medicalThresholdCap * 100);
  const suiteCredit = percentOf(suiteClaim, federalPercent);
  const accessibilityCredit = Math.min(tax, percentOf(accessibilityClaim, federalPercent));

  // Moving dollars already covered by HATC to METC cannot improve the
  // underlying federal credit: the base rates match and METC has a floor.
  const eligibleOverflow = Math.min(eligibleMedical, accessibility - accessibilityClaim);
  const potentialMedicalBase = Math.max(0, eligibleOverflow - medicalThreshold);
  const medicalCredit = Math.min(tax - accessibilityCredit, percentOf(potentialMedicalBase, federalPercent));
  const medicalClaim = medicalCredit > 0 ? eligibleOverflow : 0;
  const totalSavings = suiteCredit + accessibilityCredit + medicalCredit;

  return {
    suiteClaim: suiteClaim / 100,
    accessibilityClaim: accessibilityClaim / 100,
    medicalClaim: medicalClaim / 100,
    medicalThreshold: medicalThreshold / 100,
    medicalCreditBase: (medicalCredit > 0 ? potentialMedicalBase : 0) / 100,
    suiteCredit: suiteCredit / 100,
    accessibilityCredit: accessibilityCredit / 100,
    medicalCredit: medicalCredit / 100,
    totalSavings: totalSavings / 100,
    netCost: (suite + accessibility - totalSavings) / 100,
    unallocated: (suite + accessibility - suiteClaim - accessibilityClaim - medicalClaim) / 100,
  };
}
