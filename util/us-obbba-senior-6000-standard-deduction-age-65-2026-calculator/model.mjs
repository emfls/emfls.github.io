// IRS Rev. Proc. 2025-32, §§ 4.01 and 4.14.
const RULES = {
  single: { base: 16100, additional: 2050, threshold: 75000, limits: [12400, 50400, 105700, 201775, 256225, 640600] },
  hoh: { base: 24150, additional: 2050, threshold: 75000, limits: [17700, 67450, 105700, 201750, 256200, 640600] },
  mfj: { base: 32200, additional: 1650, threshold: 150000, limits: [24800, 100800, 211400, 403550, 512450, 768700] },
  mfs: { base: 16100, additional: 1650, threshold: null, limits: [12400, 50400, 105700, 201775, 256225, 384350] },
};
const RATES = [.10, .12, .22, .24, .32, .35, .37];
const BONUS_PER_SENIOR = 6000;
const PHASE_OUT_RATE = .06;

function rulesFor(status) {
  if (!Object.hasOwn(RULES, status)) throw new RangeError('Choose a supported filing status.');
  return RULES[status];
}

export function ordinaryTax(taxableIncome, status) {
  const { limits } = rulesFor(status);
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0) {
    throw new RangeError('Taxable income must be a finite, nonnegative amount.');
  }
  let tax = 0;
  let lower = 0;
  for (const [index, rate] of RATES.entries()) {
    const upper = limits[index] ?? Infinity;
    tax += (Math.min(taxableIncome, upper) - lower) * rate;
    if (taxableIncome <= upper) break;
    lower = upper;
  }
  return tax;
}

function conditions(person) {
  return Number(person.ageEligible === true) + Number(person.blind === true);
}

function eligible(person) {
  return Number(person.ageEligible === true && person.validSsn === true);
}

export function calculate({
  status, agi, magiAddbacks = 0, method, itemized = 0, taxpayer = {}, spouse = {},
  spouseItemizes = false, mfsSpouseConditionsAllowed = false,
}) {
  const rules = rulesFor(status);
  const magi = agi + magiAddbacks;
  if (!Number.isFinite(agi) || !Number.isFinite(magiAddbacks) || magiAddbacks < 0 || !Number.isFinite(magi)) {
    throw new RangeError('Enter a valid AGI and nonnegative MAGI additions.');
  }
  if (method !== 'standard' && method !== 'itemized') {
    throw new RangeError('Choose a deduction method.');
  }

  const joint = status === 'mfj';
  const separate = status === 'mfs';
  const standardAvailable = !(separate && spouseItemizes);
  const useItemized = !standardAvailable || method === 'itemized';
  if (useItemized && (!Number.isFinite(itemized) || itemized < 0)) {
    throw new RangeError('Enter a nonnegative itemized deduction.');
  }

  const countSpouseConditions = joint || (separate && mfsSpouseConditionsAllowed);
  const traditionalAdditional = rules.additional * (conditions(taxpayer) + (countSpouseConditions ? conditions(spouse) : 0));
  const standardDeduction = standardAvailable ? rules.base + traditionalAdditional : 0;
  const deductionBeforeBonus = useItemized ? itemized : standardDeduction;

  const qualifyingSeniors = separate ? 0 : eligible(taxpayer) + (joint ? eligible(spouse) : 0);
  const maximumBonus = BONUS_PER_SENIOR * qualifyingSeniors;
  const phaseOutStart = rules.threshold;
  const phaseOutEnd = separate ? null : phaseOutStart + BONUS_PER_SENIOR / PHASE_OUT_RATE;
  const phaseOutSlope = PHASE_OUT_RATE * qualifyingSeniors;
  const phaseOutLoss = separate ? 0 : Math.min(maximumBonus, Math.max(0, magi - phaseOutStart) * phaseOutSlope);
  const bonus = maximumBonus - phaseOutLoss;
  let phase = 'ineligible';
  if (qualifyingSeniors > 0) {
    if (magi <= phaseOutStart) phase = 'full';
    else if (magi >= phaseOutEnd) phase = 'phased-out';
    else phase = 'reducing';
  }

  // The slope is measured immediately to the right of the current income.
  const nextDollarPhaseOutRate = magi >= phaseOutStart && magi < phaseOutEnd ? phaseOutSlope : 0;
  const totalDeduction = deductionBeforeBonus + bonus;
  const taxableWithoutBonus = Math.max(0, agi - deductionBeforeBonus);
  const taxableWithBonus = Math.max(0, agi - totalDeduction);
  const taxWithoutBonus = ordinaryTax(taxableWithoutBonus, status);
  const taxWithBonus = ordinaryTax(taxableWithBonus, status);
  const ordinaryMarginalRate = agi >= totalDeduction
    ? RATES[rules.limits.filter(limit => taxableWithBonus >= limit).length]
    : 0;

  return {
    magi, baseStandard: rules.base, traditionalAdditional, standardDeduction, standardAvailable, useItemized,
    deductionBeforeBonus, qualifyingSeniors, maximumBonus, phaseOutStart, phaseOutEnd, phaseOutSlope,
    phase, phaseOutLoss, bonus, nextDollarPhaseOutRate, totalDeduction, taxableWithoutBonus, taxableWithBonus,
    taxWithoutBonus, taxWithBonus, taxSaved: taxWithoutBonus - taxWithBonus, ordinaryMarginalRate,
    effectiveMarginalRate: ordinaryMarginalRate * (1 + nextDollarPhaseOutRate),
  };
}
