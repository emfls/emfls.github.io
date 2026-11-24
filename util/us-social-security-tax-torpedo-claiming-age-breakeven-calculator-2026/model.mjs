const RATES = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const SINGLE_BASES = [25000, 34000];
const SEPARATE = {
  standard: 16100, aged: 1650,
  limits: [12400, 50400, 105700, 201775, 256225, 384350],
};
const FILINGS = new Map(Object.entries({
  single: {
    bases: SINGLE_BASES, standard: 16100, aged: 2050, phaseStart: 75000,
    limits: [12400, 50400, 105700, 201775, 256225, 640600],
  },
  hoh: {
    bases: SINGLE_BASES, standard: 24150, aged: 2050, phaseStart: 75000,
    limits: [17700, 67450, 105700, 201750, 256200, 640600],
  },
  mfj: {
    bases: [32000, 44000], standard: 32200, aged: 1650, phaseStart: 150000,
    limits: [24800, 100800, 211400, 403550, 512450, 768700],
  },
  mfsApart: { ...SEPARATE, bases: SINGLE_BASES },
  mfsTogether: { ...SEPARATE, bases: [0, 0] },
}));

function filing(status) {
  const rules = FILINGS.get(status);
  if (!rules) throw new RangeError('Choose a supported filing status.');
  return rules;
}

function amount(value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Dollar amounts must be finite and nonnegative.');
  }
  return value;
}

function seniorCount(status, count) {
  if (!Number.isInteger(count) || count < 0 || count > (status === 'mfj' ? 2 : 1)) {
    throw new RangeError('Senior count must match the filing status.');
  }
}

export function apply2026Cola(priorYearPia) {
  return amount(priorYearPia) * 1.028;
}

export function claimingFactor(ageMonths) {
  const fra = 67 * 12;
  if (!Number.isInteger(ageMonths) || ageMonths < 62 * 12 || ageMonths > 70 * 12) {
    throw new RangeError('Enter a whole-month claiming age between 62 and 70.');
  }
  if (ageMonths >= fra) return 1 + (ageMonths - fra) / 150;
  const early = fra - ageMonths;
  return 1 - Math.min(early, 36) / 180 - Math.max(0, early - 36) / 240;
}

export function taxableSocialSecurity(status, annualBenefit, provisionalIncome) {
  const [lower, upper] = filing(status).bases;
  amount(annualBenefit);
  if (!Number.isFinite(provisionalIncome)) throw new RangeError('Provisional income must be finite.');
  const tier1 = Math.min(annualBenefit * 0.5, Math.max(0, Math.min(provisionalIncome, upper) - lower) * 0.5);
  const tier2 = Math.max(0, provisionalIncome - upper) * 0.85;
  return Math.min(annualBenefit * 0.85, tier1 + tier2);
}

export function seniorBonus(status, magi, eligibleCount) {
  const { phaseStart } = filing(status);
  seniorCount(status, eligibleCount);
  if (!Number.isFinite(magi)) throw new RangeError('MAGI must be finite.');
  if (phaseStart === undefined) return 0;
  const reductionPerPerson = Math.max(0, magi - phaseStart) * 0.06;
  return eligibleCount * Math.max(0, 6000 - reductionPerPerson);
}

function ordinaryTax(taxableIncome, limits) {
  let tax = 0;
  let lower = 0;
  for (const [i, rate] of RATES.entries()) {
    const upper = limits[i] ?? Infinity;
    tax += Math.max(0, Math.min(taxableIncome, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

export function estimateTax({
  status, annualSocialSecurity, otherIncome, traditionalIra = 0, muniInterest = 0,
  age65Count = 0, eligibleSeniorCount = age65Count, itemizedDeduction = null,
}) {
  const rules = filing(status);
  seniorCount(status, age65Count);
  seniorCount(status, eligibleSeniorCount);
  if (eligibleSeniorCount > age65Count) throw new RangeError('Eligible seniors must be age 65 or older.');
  const nonBenefitIncome = amount(otherIncome) + amount(traditionalIra);
  const provisionalIncome = nonBenefitIncome + amount(muniInterest) + amount(annualSocialSecurity) * 0.5;
  const taxableBenefit = taxableSocialSecurity(status, annualSocialSecurity, provisionalIncome);
  const magi = nonBenefitIncome + taxableBenefit;
  const bonus = seniorBonus(status, magi, eligibleSeniorCount);
  const deduction = itemizedDeduction === null
    ? rules.standard + rules.aged * age65Count
    : amount(itemizedDeduction);
  const taxableIncome = Math.max(0, magi - deduction - bonus);
  return {
    provisionalIncome, taxableSocialSecurity: taxableBenefit, magi, deduction, seniorBonus: bonus,
    taxableIncome, federalTax: ordinaryTax(taxableIncome, rules.limits),
  };
}

export function withdrawalImpact(scenario) {
  const base = estimateTax(scenario);
  const next = estimateTax({ ...scenario, traditionalIra: (scenario.traditionalIra ?? 0) + 1000 });
  const additionalTax = next.federalTax - base.federalTax;
  return {
    base, additionalTax, traditionalRate: additionalTax / 1000, qualifiedRothRate: 0,
    additionalTaxableBenefit: next.taxableSocialSecurity - base.taxableSocialSecurity,
    lostSeniorBonus: base.seniorBonus - next.seniorBonus,
  };
}

const START_AGE = 62;
const LAST_AGE = 120;
const CLAIM_AGES = [62, 67, 70];
const AGE_PAIRS = [[62, 67], [67, 70], [62, 70]];

export function compareClaiming({ pia2026, futureCola = 0, discountRate = 0, totalAge = 90 }) {
  amount(pia2026);
  if (!Number.isFinite(futureCola) || futureCola < 0 || futureCola > 0.20 ||
      !Number.isFinite(discountRate) || discountRate < 0 || discountRate > 0.20 ||
      !Number.isInteger(totalAge) || totalAge < 70 || totalAge > LAST_AGE) {
    throw new RangeError('Use rates from 0% to 20% and a whole comparison age from 70 to 120.');
  }
  const monthly = new Map(CLAIM_AGES.map(age => [age, pia2026 * claimingFactor(age * 12)]));
  const weight = Array.from({ length: (LAST_AGE - START_AGE) * 12 }, (_, i) =>
    (1 + futureCola) ** Math.floor(i / 12) / (1 + discountRate) ** ((i + 1) / 12));
  const benefits = CLAIM_AGES.map(age => {
    const firstMonth = (age - START_AGE) * 12;
    const throughAge = (totalAge - START_AGE) * 12;
    const cumulative = weight.slice(firstMonth, throughAge).reduce((sum, value) => sum + value, 0);
    return { age, monthly: monthly.get(age), cumulative: cumulative * monthly.get(age) };
  });

  const crossings = AGE_PAIRS.map(([earlier, later]) => {
    const firstMonth = (earlier - START_AGE) * 12;
    const laterMonth = (later - START_AGE) * 12;
    // Work in units of PIA so the crossing is independent of the benefit amount.
    const earlyFactor = claimingFactor(earlier * 12);
    const gainFactor = claimingFactor(later * 12) - earlyFactor;
    let lead = weight.slice(firstMonth, laterMonth).reduce((sum, value) => sum + value * earlyFactor, 0);
    for (let i = laterMonth; pia2026 > 0 && i < weight.length; i++) {
      const gain = weight[i] * gainFactor;
      if (lead <= gain + 1e-10) {
        const fraction = Math.min(1, lead / gain);
        return { earlier, later, age: START_AGE + (i + fraction) / 12, paymentAge: START_AGE + (i + 1) / 12 };
      }
      lead -= gain;
    }
    return { earlier, later, age: null, paymentAge: null };
  });
  return { benefits, crossings };
}
