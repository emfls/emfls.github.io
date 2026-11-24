export const BASE_YEAR = 2026;
export const QLAC_CAP_2026 = 210000;
export const UNIFORM_LIFETIME_DIVISORS = Object.freeze({
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
  79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
});

const MAX_AMOUNT = 1_000_000_000;
const SINGLE_LIMITS = [109000, 137000, 171000, 205000, 500000];
const JOINT_LIMITS = [218000, 274000, 342000, 410000, 750000];
const PART_B = [0, 81.2, 202.9, 324.6, 446.3, 487];
const PART_D = [0, 14.5, 37.5, 60.4, 83.3, 91];

function validateNumber(value, label, min, max, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${integer ? 'a whole number' : 'a number'} from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}.`);
  }
}

// In the supported 2026 age range, birth years are 1951–1971.
// Treasury and IRS proposed age 73 for the overlapping 1959 cohort.
export function rmdStartAge(birthYear) {
  validateNumber(birthYear, 'Birth year', 1951, 1971, true);
  return birthYear < 1960 ? 73 : 75;
}

export function irmaa2026(magi, filing) {
  if (!Number.isFinite(magi)) throw new RangeError('Medicare MAGI must be a finite number.');
  if (filing === 'separate') {
    const tier = magi <= 109000 ? 0 : magi < 391000 ? 4 : 5;
    return { tier, partB: PART_B[tier], partD: PART_D[tier] };
  }
  if (filing !== 'single' && filing !== 'joint') throw new RangeError('Select an IRMAA filing status.');
  const limits = filing === 'joint' ? JOINT_LIMITS : SINGLE_LIMITS;
  const band = limits.findIndex((limit, index) => index === 4 ? magi < limit : magi <= limit);
  const tier = band === -1 ? 5 : band;
  return { tier, partB: PART_B[tier], partD: PART_D[tier] };
}

export function projectQLAC({
  mode, currentAge, balance, premium, payoutAge, growthRate, federalRate, payoutRate,
  otherMAGI, filing = mode === 'married_couple' ? 'joint' : 'single',
  priorPremium = 0, spouseShare = 50, spousePriorPremium = 0,
}) {
  if (mode !== 'individual' && mode !== 'married_couple') throw new RangeError('Select a household mode.');
  const couple = mode === 'married_couple';
  if ((couple && filing !== 'joint') || (!couple && filing !== 'single' && filing !== 'separate')) {
    throw new RangeError('Select a filing status compatible with this projection.');
  }
  validateNumber(currentAge, 'Age at year-end', 55, 75, true);
  validateNumber(balance, 'Retirement balance', 0, MAX_AMOUNT);
  validateNumber(premium, 'Planned premium', 0, MAX_AMOUNT);
  validateNumber(payoutAge, 'Payout start age', 75, 85, true);
  validateNumber(growthRate, 'Annual IRA growth', -100, 100);
  validateNumber(federalRate, 'Marginal federal tax rate', 0, 100);
  validateNumber(payoutRate, 'Annual payout rate', 0, 100);
  validateNumber(otherMAGI, 'Other Medicare MAGI', -MAX_AMOUNT, MAX_AMOUNT);
  validateNumber(priorPremium, 'Prior QLAC premiums', 0, MAX_AMOUNT);

  const birthYear = BASE_YEAR - currentAge;
  const startAge = rmdStartAge(birthYear);
  const purchaseYearRMD = currentAge >= startAge ? 1 / UNIFORM_LIFETIME_DIVISORS[currentAge] : 0;
  const capacity = (ownerBalance, paid) =>
    Math.min(ownerBalance * (1 - purchaseYearRMD), Math.max(0, QLAC_CAP_2026 - paid));
  const ownerCapacities = [capacity(balance, priorPremium)];
  if (couple) {
    validateNumber(spouseShare, 'Spouse balance share', 0, 100);
    validateNumber(spousePriorPremium, 'Spouse prior QLAC premiums', 0, MAX_AMOUNT);
    const spouseBalance = balance * (spouseShare / 100);
    ownerCapacities[0] = capacity(balance - spouseBalance, priorPremium);
    ownerCapacities.push(capacity(spouseBalance, spousePriorPremium));
  }
  const availablePremium = ownerCapacities.reduce((sum, amount) => sum + amount, 0);
  const appliedPremium = Math.min(premium, availablePremium);
  const ownerPremiums = ownerCapacities.map(amount => availablePremium ? appliedPremium * (amount / availablePremium) : 0);
  const growthFactor = 1 + growthRate / 100;
  const annualIncome = appliedPremium * (payoutRate / 100);
  const taxFraction = federalRate / 100;
  let withoutBalance = balance;
  let withBalance = balance;
  let cumulativeRMDDeferred = 0;
  let federalTaxDeferred = 0;
  let netFederalTaxThrough84 = 0;
  const rows = [];

  for (let age = currentAge; age <= 84; age++) {
    const divisor = age >= startAge ? UNIFORM_LIFETIME_DIVISORS[age] : null;
    const withoutRMD = divisor ? withoutBalance / divisor : 0;
    const withRMD = divisor ? withBalance / divisor : 0;
    const purchase = age === currentAge ? appliedPremium : 0;
    withoutBalance = (withoutBalance - withoutRMD) * growthFactor;
    withBalance = Math.max(0, withBalance - withRMD - purchase) * growthFactor;
    if (!divisor) continue;

    const year = birthYear + age;
    const annuityIncome = age >= payoutAge ? annualIncome : 0;
    const rmdReduction = withoutRMD - withRMD;
    const netDistributionReduction = rmdReduction - annuityIncome;
    const withoutMAGI = otherMAGI + withoutRMD;
    const withMAGI = otherMAGI + withRMD + annuityIncome;
    const withoutIRMAA = irmaa2026(withoutMAGI, filing);
    const withIRMAA = irmaa2026(withMAGI, filing);
    const annualIRMAAReduction = 12 * (withoutIRMAA.partB + withoutIRMAA.partD - withIRMAA.partB - withIRMAA.partD);
    cumulativeRMDDeferred += rmdReduction;
    if (age < payoutAge) federalTaxDeferred += rmdReduction * taxFraction;
    netFederalTaxThrough84 += netDistributionReduction * taxFraction;

    rows.push({
      year, age, divisor, withoutRMD, withRMD, rmdReduction, annuityIncome,
      withoutMAGI, withMAGI, withoutIRMAA, withIRMAA, annualIRMAAReduction,
      benchmarkPremiumYear: year + 2,
    });
  }

  return {
    birthYear, startAge, payoutAge, appliedPremium, availablePremium, ownerPremiums, annualIncome,
    firstRMDReduction: rows[0].rmdReduction, cumulativeRMDDeferred, federalTaxDeferred,
    netFederalTaxThrough84, breakEvenAge: annualIncome > 0 ? payoutAge + appliedPremium / annualIncome : null,
    rows,
  };
}
