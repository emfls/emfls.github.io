const singleBrackets = [12400, 50400, 105700, 201775, 256225, 640600];
const jointBrackets = [24800, 100800, 211400, 403550, 512450, 768700];
const separateBrackets = [12400, 50400, 105700, 201775, 256225, 384350];
const rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];

// Publication 915 and Rev. Proc. 2025-32, sections 4.01 and 4.14.
const filings = {
  single: { tiers: [25000, 34000], standard: 16100, ageAdd: 2050, brackets: singleBrackets, phaseStart: 75000 },
  hoh: { tiers: [25000, 34000], standard: 24150, ageAdd: 2050, brackets: [17700, 67450, 105700, 201750, 256200, 640600], phaseStart: 75000 },
  mfj: { tiers: [32000, 44000], standard: 32200, ageAdd: 1650, brackets: jointBrackets, phaseStart: 150000 },
  qss: { tiers: [25000, 34000], standard: 32200, ageAdd: 1650, brackets: jointBrackets, phaseStart: 75000 },
  mfsApart: { tiers: [25000, 34000], standard: 16100, ageAdd: 1650, brackets: separateBrackets, phaseStart: null },
  mfsTogether: { tiers: [0, 0], standard: 16100, ageAdd: 1650, brackets: separateBrackets, phaseStart: null },
};

export const WITHDRAWAL = 1000;
export const MAX_DOLLARS = 1_000_000_000;

function filingRules(status) {
  if (!Object.hasOwn(filings, status)) throw new RangeError('Choose a supported filing status.');
  return filings[status];
}

export function taxableBenefits(status, benefits, provisionalIncome) {
  const [base, upper] = filingRules(status).tiers;
  if (provisionalIncome <= base) return 0;
  if (provisionalIncome <= upper) {
    return Math.min(0.50 * benefits, 0.50 * (provisionalIncome - base));
  }
  const tierOneAmount = Math.min(0.50 * benefits, 0.50 * (upper - base));
  return Math.min(0.85 * benefits, 0.85 * (provisionalIncome - upper) + tierOneAmount);
}

export function seniorDeduction(status, magi, eligibleSeniors) {
  const { phaseStart } = filingRules(status);
  if (phaseStart === null) return 0;
  return eligibleSeniors * Math.max(0, 6000 - 0.06 * Math.max(0, magi - phaseStart));
}

export function ordinaryIncomeTax(status, taxableIncome) {
  const { brackets } = filingRules(status);
  let tax = 0;
  let lower = 0;
  for (const [index, rate] of rates.entries()) {
    if (taxableIncome <= lower) break;
    const upper = brackets[index] ?? taxableIncome;
    tax += (Math.min(taxableIncome, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

function validateAmount(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Enter a valid ${label}.`);
  }
}

function validateAge(age, label) {
  validateAmount(age, 0, 120, label);
  if (!Number.isInteger(age)) throw new RangeError(`Enter a whole-number ${label}.`);
}

function calculate(input, extraOrdinaryIncome) {
  const {
    status, otherAgi, benefits, taxExemptInterest, age, spouseAge,
    validSsn, spouseValidSsn, deductionMethod, itemizedDeduction,
  } = input;
  const { standard, ageAdd, phaseStart, brackets } = filingRules(status);
  const joint = status === 'mfj';
  const taxpayerSenior = age >= 65;
  const spouseSenior = joint && spouseAge >= 65;
  const ageCount = Number(taxpayerSenior) + Number(spouseSenior);
  const eligibleSeniors = phaseStart === null ? 0
    : Number(taxpayerSenior && validSsn) + Number(spouseSenior && spouseValidSsn);
  const otherIncome = otherAgi + extraOrdinaryIncome;
  const provisionalIncome = otherIncome + taxExemptInterest + 0.50 * benefits;
  const taxableSS = taxableBenefits(status, benefits, provisionalIncome);
  const magi = otherIncome + taxableSS;
  const baseDeduction = deductionMethod === 'itemized' ? itemizedDeduction : standard + ageAdd * ageCount;
  const seniorBonus = seniorDeduction(status, magi, eligibleSeniors);
  const taxableIncomeBeforeBonus = Math.max(0, magi - baseDeduction);
  const taxableIncome = Math.max(0, taxableIncomeBeforeBonus - seniorBonus);
  const federalIncomeTax = ordinaryIncomeTax(status, taxableIncome);
  const nominalBracket = rates[brackets.filter(limit => taxableIncome >= limit).length];

  return {
    provisionalIncome, taxableSS, taxableBenefitShare: benefits > 0 ? taxableSS / benefits : 0,
    magi, baseDeduction, eligibleSeniors, seniorBonus, taxableIncomeBeforeBonus, taxableIncome,
    bonusUsed: taxableIncomeBeforeBonus - taxableIncome, nominalBracket, federalIncomeTax,
    bonusTaxSavings: ordinaryIncomeTax(status, taxableIncomeBeforeBonus) - federalIncomeTax,
  };
}

export function estimate(input) {
  filingRules(input.status);
  validateAmount(input.otherAgi, -MAX_DOLLARS, MAX_DOLLARS, 'other AGI');
  validateAmount(input.benefits, 0, MAX_DOLLARS, 'net benefit amount');
  validateAmount(input.taxExemptInterest, 0, MAX_DOLLARS, 'tax-exempt interest amount');
  validateAge(input.age, 'taxpayer age');
  if (input.status === 'mfj') validateAge(input.spouseAge, 'spouse age');
  if (input.deductionMethod === 'itemized') {
    validateAmount(input.itemizedDeduction, 0, MAX_DOLLARS, 'itemized deduction amount');
  } else if (input.deductionMethod !== 'standard') {
    throw new RangeError('Choose standard or itemized deductions.');
  }
  return calculate(input, 0);
}

export function compareWithdrawals(input) {
  const baseline = estimate(input);
  const traditional = calculate(input, WITHDRAWAL);
  // Qualified Roth distributions leave ordinary income and the baseline unchanged.
  function summarize(scenario) {
    const extraTax = scenario.federalIncomeTax - baseline.federalIncomeTax;
    return {
      extraTax,
      additionalTaxableSS: scenario.taxableSS - baseline.taxableSS,
      seniorBonusLost: baseline.seniorBonus - scenario.seniorBonus,
      rate: extraTax / WITHDRAWAL,
      afterTaxCash: WITHDRAWAL - extraTax,
    };
  }
  return { baseline, traditional: summarize(traditional), roth: summarize(baseline) };
}
