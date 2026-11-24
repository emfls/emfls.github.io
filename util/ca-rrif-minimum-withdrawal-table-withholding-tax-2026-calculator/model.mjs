export const TAX_YEAR = 2026;
export const OAS_THRESHOLD = 95323;

const FACTOR_BASIS_POINTS = [
  528, 540, 553, 567, 582, 598, 617, 636, 658, 682, 708, 738, 771,
  808, 851, 899, 955, 1021, 1099, 1192, 1306, 1449, 1634, 1879, 2000,
];

export function minimumFactor(age) {
  if (!Number.isSafeInteger(age) || age < 0) throw new RangeError('Use an age in whole years.');
  return age < 71 ? 1 / (90 - age) : FACTOR_BASIS_POINTS[Math.min(age, 95) - 71] / 10000;
}

function cents(amount, label, minimum = 0) {
  const rounded = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < minimum || Math.abs(amount) > 1e9 || rounded / 100 !== amount) {
    throw new RangeError(`${label} must be within the allowed range and have at most two decimal places.`);
  }
  return rounded;
}

function minimumCents(balance, age) {
  return age < 71
    ? Math.round(balance / (90 - age))
    : Math.round(balance * FACTOR_BASIS_POINTS[Math.min(age, 95) - 71] / 10000);
}

export function withholding(excess, province) {
  if (province !== 'qc' && province !== 'other') throw new RangeError('Choose a province.');
  const amount = cents(excess, 'Excess withdrawal');
  const tier = amount === 0 ? 0 : amount <= 500000 ? 1 : amount <= 1500000 ? 2 : 3;
  const federalPercent = tier * (province === 'qc' ? 5 : 10);
  const quebecPercent = province === 'qc' && tier > 0 ? 14 : 0;
  const federal = Math.round(amount * federalPercent / 100);
  const quebec = Math.round(amount * quebecPercent / 100);
  return {
    federalRate: federalPercent / 100,
    quebecRate: quebecPercent / 100,
    rate: (federalPercent + quebecPercent) / 100,
    federal: federal / 100,
    quebec: quebec / 100,
    total: (federal + quebec) / 100,
  };
}

export function calculate({
  balance, age, electSpouse, spouseAge, planned, province, otherIncome, annualReturn,
  openingYear = false, turns65 = false,
}) {
  if (!Number.isInteger(age) || age < 55 || age > 95) throw new RangeError('Use a holder age from 55 to 95.');
  if (electSpouse && (!Number.isInteger(spouseAge) || spouseAge < 50 || spouseAge > age
    || (spouseAge === age && age !== 95))) {
    throw new RangeError('Enter a younger spouse age of at least 50. Use 95 for ages 95 and older.');
  }
  if (!Number.isFinite(annualReturn) || annualReturn < -100 || annualReturn > 100) {
    throw new RangeError('Enter an annual return from −100% to 100%.');
  }

  const startingBalance = cents(balance, 'Starting balance');
  const withdrawal = cents(planned, 'Planned withdrawal');
  const other = cents(otherIncome, 'Other income', -1e9);
  const factorAge = electSpouse ? spouseAge : age;
  const required = openingYear ? 0 : minimumCents(startingBalance, factorAge);
  const holderRequired = openingYear ? 0 : minimumCents(startingBalance, age);
  const excess = Math.max(0, withdrawal - required) / 100;
  const tax = withholding(excess, province);
  const eligibleByAge = age >= 65 || (age === 64 && turns65);

  // This is the threshold calculation before the cap based on actual OAS received.
  const threshold = OAS_THRESHOLD * 100;
  const oasExcess = Math.max(0, other + withdrawal - threshold);
  const recovery = Math.round(oasExcess * 15 / 100);
  const recoveryBeforeWithdrawal = Math.round(Math.max(0, other - threshold) * 15 / 100);

  let selectedOpening = startingBalance;
  let holderOpening = startingBalance;
  let extraGrowth = 0;
  let extraGrowth10 = 0;
  const schedule = Array.from({ length: 15 }, (_, index) => {
    const noMinimum = openingYear && index === 0;
    const selectedMinimum = noMinimum ? 0 : minimumCents(selectedOpening, factorAge + index);
    const holderMinimum = noMinimum ? 0 : minimumCents(holderOpening, age + index);
    // Apply the return to each scenario's own balance after its minimum withdrawal.
    const selectedRemaining = selectedOpening - selectedMinimum;
    const holderRemaining = holderOpening - holderMinimum;
    const selectedGrowth = Math.round(selectedRemaining * annualReturn / 100);
    const holderGrowth = Math.round(holderRemaining * annualReturn / 100);
    extraGrowth += selectedGrowth - holderGrowth;
    if (index === 9) extraGrowth10 = extraGrowth / 100;

    const row = {
      year: TAX_YEAR + index,
      age: age + index,
      factorAge: factorAge + index,
      opening: selectedOpening / 100,
      minimum: selectedMinimum / 100,
      ending: (selectedRemaining + selectedGrowth) / 100,
      holderMinimum: holderMinimum / 100,
      holderEnding: (holderRemaining + holderGrowth) / 100,
    };
    selectedOpening = selectedRemaining + selectedGrowth;
    holderOpening = holderRemaining + holderGrowth;
    return row;
  });

  return {
    factor: openingYear ? 0 : minimumFactor(factorAge),
    factorAge,
    minimum: required / 100,
    holderMinimum: holderRequired / 100,
    minimumReduction: (holderRequired - required) / 100,
    shortfall: Math.max(0, required - withdrawal) / 100,
    excess,
    tax,
    netCash: (withdrawal - Math.round(tax.total * 100)) / 100,
    incomeEstimate: (other + withdrawal) / 100,
    oasRecovery: eligibleByAge ? recovery / 100 : null,
    oasFromWithdrawal: eligibleByAge ? (recovery - recoveryBeforeWithdrawal) / 100 : null,
    eligibleByAge,
    pensionAmount: eligibleByAge ? Math.min(planned, 2000) : 0,
    schedule,
    extraBalance10: Math.round((schedule[9].ending - schedule[9].holderEnding) * 100) / 100,
    extraGrowth10,
  };
}
