const DEPENDENT_MINIMUM = 1350;
const EARNED_INCOME_ADD_ON = 450;
const SINGLE_STANDARD_DEDUCTION = 16100;
const KIDDIE_THRESHOLD = 2700;
const ELECTION_LIMIT = 13500;
const NIIT_RATE = 0.038;
const roundCents = amount => Math.round(amount * 100) / 100;

const rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const joint = {
  brackets: [24800, 100800, 211400, 403550, 512450, 768700],
  zeroRateLimit: 98900, fifteenRateLimit: 613700, niitThreshold: 250000
};
const schedules = {
  single: {
    brackets: [12400, 50400, 105700, 201775, 256225, 640600],
    zeroRateLimit: 49450, fifteenRateLimit: 545500, niitThreshold: 200000
  },
  joint,
  surviving: joint,
  separate: {
    brackets: [12400, 50400, 105700, 201775, 256225, 384350],
    zeroRateLimit: 49450, fifteenRateLimit: 306850, niitThreshold: 125000
  },
  head: {
    brackets: [17700, 67450, 105700, 201750, 256200, 640600],
    zeroRateLimit: 66200, fifteenRateLimit: 579600, niitThreshold: 200000
  }
};

export function dependentDeduction(earned) {
  return Math.min(SINGLE_STANDARD_DEDUCTION, Math.max(DEPENDENT_MINIMUM, earned + EARNED_INCOME_ADD_ON));
}

function ordinaryTax(schedule, taxable) {
  let tax = 0;
  let lower = 0;
  for (const [index, rate] of rates.entries()) {
    const upper = schedule.brackets[index] ?? Infinity;
    tax += Math.max(0, Math.min(upper, taxable) - lower) * rate;
    lower = upper;
  }
  return tax;
}

export function regularTax(status, taxable, preferential) {
  const schedule = schedules[status];
  const ordinary = taxable - Math.min(taxable, preferential);
  const atFifteen = Math.max(0, Math.min(taxable, schedule.fifteenRateLimit) - Math.max(ordinary, schedule.zeroRateLimit));
  const atTwenty = Math.max(0, taxable - Math.max(ordinary, schedule.fifteenRateLimit));
  return Math.min(ordinaryTax(schedule, taxable), ordinaryTax(schedule, ordinary) + 0.15 * atFifteen + 0.20 * atTwenty);
}

function electionIneligibility(input, directGains, unearned) {
  if (input.earned > 0 || input.otherOrdinary > 0 || directGains > 0) return 'type';
  if (unearned <= DEPENDENT_MINIMUM || unearned >= ELECTION_LIMIT) return 'income';
  if (!input.electionConfirmed) return 'confirmation';
  return null;
}

function estimateReturn(input, directGains, deduction, parentBaseTax) {
  const { earned, ordinary, otherOrdinary, dividends, distributions, parentStatus, parentTaxable,
    parentPreferential, parentMagi, parentNii, kiddieApplies } = input;
  const preferential = roundCents(dividends + distributions + directGains);
  const unearned = roundCents(ordinary + otherOrdinary + preferential);
  const totalIncome = roundCents(earned + unearned);
  const taxable = Math.max(0, roundCents(totalIncome - deduction));
  const aboveThreshold = Math.max(0, roundCents(unearned - KIDDIE_THRESHOLD));
  const kiddieRequired = kiddieApplies && aboveThreshold > 0;
  const parentShare = kiddieRequired ? Math.min(aboveThreshold, taxable) : 0;
  // IRS Line 5 Worksheet #1 uses the unearned-income mix. Worksheet #3 prorates
  // the standard deduction against total income when taxable income limits line 5.
  let parentPreferentialShare = 0;
  if (parentShare > 0) {
    parentPreferentialShare = parentShare === aboveThreshold
      ? preferential * parentShare / unearned
      : preferential * parentShare / totalIncome;
  }
  const parentIncrease = (amount, preferred) => Math.max(0,
    regularTax(parentStatus, parentTaxable + amount, parentPreferential + preferred) - parentBaseTax
  );
  const parentTax = parentIncrease(parentShare, parentPreferentialShare);
  const childRateTax = regularTax('single', taxable - parentShare, preferential - parentPreferentialShare);
  const childOnlyTax = regularTax('single', taxable, preferential);
  const separateTax = Math.max(childOnlyTax, childRateTax + parentTax);

  const electionReason = electionIneligibility(input, directGains, unearned);
  const result = {
    unearned, taxable, aboveThreshold, kiddieRequired, parentShare, parentPreferentialShare,
    parentTax, childRateTax, childOnlyTax, separateTax, electionReason
  };
  if (electionReason) return result;

  const electionAddedIncome = aboveThreshold;
  const electionPreferential = preferential * electionAddedIncome / unearned;
  const electionBaseTax = Math.min(DEPENDENT_MINIMUM, unearned - DEPENDENT_MINIMUM) * 0.10;
  const electionRegular = electionBaseTax + parentIncrease(electionAddedIncome, electionPreferential);
  const { niitThreshold } = schedules[parentStatus];
  const niit = (added) => NIIT_RATE * Math.max(0, Math.min(parentNii + added, parentMagi + added - niitThreshold));
  const electionNiit = niit(electionAddedIncome) - niit(0);
  return {
    ...result, electionAddedIncome, electionBaseTax, electionRegular, electionNiit,
    electionTax: electionRegular + electionNiit
  };
}

export function calculate({ otherOrdinary = 0, ...input }) {
  const amounts = [input.earned, input.ordinary, otherOrdinary, input.dividends, input.distributions,
    input.gains, input.plannedGain, input.parentTaxable, input.parentPreferential];
  if (!amounts.every(value => Number.isFinite(value) && value >= 0)
      || !Number.isFinite(input.parentMagi) || !Number.isFinite(input.parentNii)
      || !Object.hasOwn(schedules, input.parentStatus)
      || input.parentPreferential > input.parentTaxable) {
    throw new RangeError('Enter valid amounts. Parent qualified dividends and gains must fit within parent taxable income.');
  }

  const scenario = { ...input, otherOrdinary };
  const deduction = dependentDeduction(input.earned);
  const parentBaseTax = regularTax(input.parentStatus, input.parentTaxable, input.parentPreferential);
  const current = estimateReturn(scenario, input.gains, deduction, parentBaseTax);
  const projected = estimateReturn(scenario, input.gains + input.plannedGain, deduction, parentBaseTax);
  const thresholdRoom = Math.max(0, roundCents(KIDDIE_THRESHOLD - current.unearned));
  const zeroRateRoom = Math.max(0, roundCents(schedules.single.zeroRateLimit - current.taxable));
  return {
    current, projected, deduction, thresholdRoom, harvestRoom: Math.min(thresholdRoom, zeroRateRoom),
    saleTaxChange: projected.separateTax - current.separateTax
  };
}
