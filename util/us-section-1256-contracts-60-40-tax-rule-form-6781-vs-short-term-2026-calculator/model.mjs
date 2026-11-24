const ORDINARY_RATES = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const LONG_TERM_RATES = [0, 0.15, 0.20];

// IRS Rev. Procs. 2022-38, 2023-34, 2024-40 and 2025-32.
// Each row contains the ordinary bracket ceilings and the 0%/15% gain ceilings.
const TAX_SCHEDULES = {
  2023: {
    single: [[11000, 44725, 95375, 182100, 231250, 578125], [44625, 492300]],
    mfj: [[22000, 89450, 190750, 364200, 462500, 693750], [89250, 553850]],
    hoh: [[15700, 59850, 95350, 182100, 231250, 578100], [59750, 523050]],
    mfs: [[11000, 44725, 95375, 182100, 231250, 346875], [44625, 276900]]
  },
  2024: {
    single: [[11600, 47150, 100525, 191950, 243725, 609350], [47025, 518900]],
    mfj: [[23200, 94300, 201050, 383900, 487450, 731200], [94050, 583750]],
    hoh: [[16550, 63100, 100500, 191950, 243700, 609350], [63000, 551350]],
    mfs: [[11600, 47150, 100525, 191950, 243725, 365600], [47025, 291850]]
  },
  2025: {
    single: [[11925, 48475, 103350, 197300, 250525, 626350], [48350, 533400]],
    mfj: [[23850, 96950, 206700, 394600, 501050, 751600], [96700, 600050]],
    hoh: [[17000, 64850, 103350, 197300, 250500, 626350], [64750, 566700]],
    mfs: [[11925, 48475, 103350, 197300, 250525, 375800], [48350, 300000]]
  },
  2026: {
    single: [[12400, 50400, 105700, 201775, 256225, 640600], [49450, 545500]],
    mfj: [[24800, 100800, 211400, 403550, 512450, 768700], [98900, 613700]],
    hoh: [[17700, 67450, 105700, 201750, 256200, 640600], [66200, 579600]],
    mfs: [[12400, 50400, 105700, 201775, 256225, 384350], [49450, 306850]]
  }
};

const FILING_RULES = {
  single: { deduction: 16100, niitThreshold: 200000, lossCap: 3000 },
  mfj: { deduction: 32200, niitThreshold: 250000, lossCap: 3000 },
  hoh: { deduction: 24150, niitThreshold: 200000, lossCap: 3000 },
  mfs: { deduction: 16100, niitThreshold: 125000, lossCap: 1500 }
};
const CARRYBACK_YEARS = [2023, 2024, 2025];
export const MAX_AMOUNT = 100000000;

function filingRules(status) {
  if (!Object.hasOwn(FILING_RULES, status)) throw new RangeError('Choose a supported filing status.');
  return FILING_RULES[status];
}

function validateAmount(amount, minimum = 0) {
  if (!Number.isFinite(amount) || amount < minimum || amount > MAX_AMOUNT) {
    throw new RangeError('Enter a dollar amount within the supported range.');
  }
}

function bracketTax(start, end, ceilings, rates) {
  let lower = 0;
  let tax = 0;
  for (const [i, rate] of rates.entries()) {
    const upper = ceilings[i] ?? Infinity;
    tax += Math.max(0, Math.min(end, upper) - Math.max(start, lower)) * rate;
    if (end <= upper) break;
    lower = upper;
  }
  return tax;
}

export function regularIncomeTax(year, status, ordinaryAfterDeductions, longTerm = 0) {
  filingRules(status);
  if (!Object.hasOwn(TAX_SCHEDULES, year)) throw new RangeError('Choose a tax year from 2023 to 2026.');
  if (!Number.isFinite(ordinaryAfterDeductions) || !Number.isFinite(longTerm) || longTerm < 0) {
    throw new RangeError('Enter finite income amounts and a nonnegative long-term gain.');
  }
  const [ordinaryCeilings, longTermCeilings] = TAX_SCHEDULES[year][status];
  const ordinary = Math.max(0, ordinaryAfterDeductions);
  const taxable = Math.max(0, ordinaryAfterDeductions + longTerm);
  const preferential = bracketTax(0, ordinary, ordinaryCeilings, ORDINARY_RATES)
    + bracketTax(ordinary, taxable, longTermCeilings, LONG_TERM_RATES);
  // The IRS worksheet caps tax at what the ordinary schedule would charge.
  return Math.min(preferential, bracketTax(0, taxable, ordinaryCeilings, ORDINARY_RATES));
}

export function netInvestmentIncomeTax(status, magi, nii) {
  const { niitThreshold } = filingRules(status);
  if (!Number.isFinite(magi) || !Number.isFinite(nii)) throw new RangeError('Enter finite NIIT amounts.');
  return 0.038 * Math.min(Math.max(0, nii), Math.max(0, magi - niitThreshold));
}

export function compareGain({ status, income, gain, otherNii = 0 }) {
  const { deduction, niitThreshold } = filingRules(status);
  validateAmount(income);
  validateAmount(gain);
  validateAmount(otherNii);
  const ordinary = income - deduction;
  const baseline = regularIncomeTax(2026, status, ordinary);
  const baselineNiit = netInvestmentIncomeTax(status, income, otherNii);
  const magi = income + gain;
  const nii = otherNii + gain;
  const totalNiit = netInvestmentIncomeTax(status, magi, nii);
  const niit = totalNiit - baselineNiit;
  const shortTerm = gain * 0.4;
  const longTerm = gain - shortTerm;
  const sectionRegular = regularIncomeTax(2026, status, ordinary + shortTerm, longTerm) - baseline;
  const equityRegular = regularIncomeTax(2026, status, ordinary + gain) - baseline;
  const section1256 = { regular: sectionRegular, niit, total: sectionRegular + niit };
  const equity = { regular: equityRegular, niit, total: equityRegular + niit };
  const savings = equityRegular - sectionRegular;
  return {
    section1256, equity, shortTerm, longTerm, savings, deduction, magi, nii,
    baselineNiit, totalNiit, niitThreshold,
    sectionRate: gain ? section1256.total / gain : null,
    equityRate: gain ? equity.total / gain : null,
    rateDrop: gain ? savings / gain : null
  };
}

export function simulateCarryback({ status, income, loss, history = [], otherNii = 0 }) {
  const { deduction, lossCap } = filingRules(status);
  validateAmount(income);
  validateAmount(loss);
  validateAmount(otherNii);
  if (!Array.isArray(history) || history.length > CARRYBACK_YEARS.length) {
    throw new RangeError('Enter up to three carryback years in chronological order.');
  }

  const ordinary = income - deduction;
  const taxableBeforeLoss = Math.max(0, ordinary);
  const currentAbsorbed = Math.min(loss, lossCap, taxableBeforeLoss);
  const eligibleLoss = loss - currentAbsorbed;
  let remaining = eligibleLoss;
  const years = CARRYBACK_YEARS.map((year, i) => {
    const { gain = 0, ordinary: earlierOrdinary = 0, eligibleLimit = gain } = history[i] ?? {};
    validateAmount(gain);
    validateAmount(earlierOrdinary, -MAX_AMOUNT);
    validateAmount(eligibleLimit);
    const applied = Math.min(remaining, gain, eligibleLimit);
    remaining -= applied;
    const after = gain - applied;
    const beforeTax = regularIncomeTax(year, status, earlierOrdinary + 0.4 * gain, 0.6 * gain);
    const afterTax = regularIncomeTax(year, status, earlierOrdinary + 0.4 * after, 0.6 * after);
    return { year, applied, refund: Math.max(0, beforeTax - afterTax) };
  });
  const carriedBack = eligibleLoss - remaining;
  const refund = years.reduce((sum, row) => sum + row.refund, 0);

  function currentYear(availableLoss) {
    const deductionAgainstIncome = Math.min(availableLoss, lossCap);
    const absorbed = Math.min(deductionAgainstIncome, taxableBeforeLoss);
    const regular = regularIncomeTax(2026, status, ordinary)
      - regularIncomeTax(2026, status, ordinary - deductionAgainstIncome);
    const niit = netInvestmentIncomeTax(status, income, otherNii)
      - netInvestmentIncomeTax(status, income - deductionAgainstIncome, otherNii - deductionAgainstIncome);
    return {
      deduction: deductionAgainstIncome,
      carryforward: availableLoss - absorbed,
      currentBenefit: regular + niit,
      niitBenefit: niit
    };
  }

  return {
    years, carriedBack, eligibleLoss, refund, lossCap,
    section1256: currentYear(loss - carriedBack), equity: currentYear(loss)
  };
}
