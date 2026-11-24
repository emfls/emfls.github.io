export const CPP_MAX = 1507.65;
export const OAS_MAX = 762.50;
export const OAS_MAX_75 = 838.75;
export const RECOVERY_THRESHOLD = 95_323;
export const HORIZON = 130;

const MONTHS_PER_YEAR = 12;
const AGE_60 = 60 * MONTHS_PER_YEAR;
const AGE_65 = 65 * MONTHS_PER_YEAR;
const AGE_70 = 70 * MONTHS_PER_YEAR;
const OAS_BOOST_MONTH = 75 * MONTHS_PER_YEAR + 1;
const RECOVERY_RATE = 0.15;

function inRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

export function cppBaseAmount(basis, value) {
  if (basis === 'percent') return CPP_MAX * inRange(value, 0, 100, 'CPP percentage') / 100;
  if (basis === 'amount') return inRange(value, 0, CPP_MAX, 'Monthly age-65 CPP');
  throw new RangeError('Choose a CPP estimate type.');
}

// Start and payment ages are whole months. Keep full precision until display.
export function cppMonthly(base, startMonth) {
  const offset = startMonth - AGE_65;
  return base * (1 + offset * (offset < 0 ? 0.006 : 0.007));
}

export function oasMonthly(startMonth, yearsInCanada, paymentMonth) {
  if (paymentMonth < startMonth) return 0;
  const maximum = paymentMonth >= OAS_BOOST_MONTH ? OAS_MAX_75 : OAS_MAX;
  return maximum * (Math.min(40, yearsInCanada) / 40) * (1 + (startMonth - AGE_65) * 0.006);
}

// All three income amounts must be from the same year, in 2026 dollars.
export function recoveryTax(otherIncome, cpp, oas) {
  return Math.min(oas, Math.max(0, (otherIncome + cpp + oas - RECOVERY_THRESHOLD) * RECOVERY_RATE));
}

function cashFlow(cppBase, cppStart, oasStart, yearsInCanada) {
  return Array.from({ length: HORIZON * MONTHS_PER_YEAR - AGE_60 }, (_, index) => {
    const month = AGE_60 + index;
    const cpp = month >= cppStart ? cppMonthly(cppBase, cppStart) : 0;
    const oas = oasMonthly(oasStart, yearsInCanada, month);
    return { cpp, oas, combined: cpp + oas };
  });
}

function summarize(flow, targetMonths, otherIncome, weights) {
  let nominal = 0;
  let presentValue = 0;
  let recoveryNominal = 0;
  let recoveryPresentValue = 0;
  let firstRecoveryAge = null;
  let firstThresholdAge = null;

  // Use projected 12-month age years as tax years, including the full
  // projected year's assessment when the payout horizon ends mid-year.
  for (let start = 0; start < targetMonths; start += MONTHS_PER_YEAR) {
    let annualCpp = 0;
    let annualOas = 0;
    for (const { cpp, oas } of flow.slice(start, start + MONTHS_PER_YEAR)) {
      annualCpp += cpp;
      annualOas += oas;
    }
    const age = 60 + start / MONTHS_PER_YEAR;
    if (firstThresholdAge === null && otherIncome + annualCpp + annualOas > RECOVERY_THRESHOLD) {
      firstThresholdAge = age;
    }
    const shareRecovered = annualOas > 0 ? recoveryTax(otherIncome, annualCpp, annualOas) / annualOas : 0;
    const end = Math.min(start + MONTHS_PER_YEAR, targetMonths);
    for (let index = start; index < end; index++) {
      const { combined, oas } = flow[index];
      const { nominalWeight, presentWeight } = weights[index];
      const recovered = oas * shareRecovered;
      if (recovered > 0 && firstRecoveryAge === null) firstRecoveryAge = age;
      nominal += combined * nominalWeight;
      presentValue += combined * presentWeight;
      recoveryNominal += recovered * nominalWeight;
      recoveryPresentValue += recovered * presentWeight;
    }
  }

  return {
    nominal, presentValue, recoveryNominal, firstRecoveryAge, firstThresholdAge,
    netNominal: nominal - recoveryNominal,
    netPresentValue: presentValue - recoveryPresentValue
  };
}

function crossover(lead, next, index) {
  if (lead === 0 || Math.sign(lead) === Math.sign(next)) return null;
  return 60 + (index + lead / (lead - next)) / MONTHS_PER_YEAR;
}

function compare(id, first, second, benefit, weights) {
  let nominalLead = 0;
  let presentLead = 0;
  let nominal = null;
  let presentValue = null;
  let identical = true;
  for (let index = 0; index < first.length; index++) {
    const difference = second[index][benefit] - first[index][benefit];
    if (difference !== 0) identical = false;
    const { nominalWeight, presentWeight } = weights[index];
    const nextNominal = nominalLead + difference * nominalWeight;
    const nextPresent = presentLead + difference * presentWeight;
    if (difference !== 0) {
      nominal ??= crossover(nominalLead, nextNominal, index);
      presentValue ??= crossover(presentLead, nextPresent, index);
    }
    nominalLead = nextNominal;
    presentLead = nextPresent;
  }
  return { id, nominal, presentValue, identical };
}

export function calculate({ cppBase, yearsInCanada, cppAge, oasAge, lifeAge, inflation, realDiscount, otherIncome }) {
  inRange(cppBase, 0, CPP_MAX, 'Monthly age-65 CPP');
  inRange(yearsInCanada, 0, 102, 'Completed years in Canada');
  if (!Number.isInteger(yearsInCanada)) throw new RangeError('Use whole completed years in Canada.');
  inRange(inflation, 0, 0.10, 'Annual CPI as a decimal');
  inRange(realDiscount, -0.10, 0.20, 'Annual real discount as a decimal');
  inRange(otherIncome, 0, 10_000_000, 'Other annual income');

  const cppStart = Math.round(inRange(cppAge, 60, 70, 'Custom CPP age') * MONTHS_PER_YEAR);
  const oasStart = Math.round(inRange(oasAge, 65, 70, 'Custom OAS age') * MONTHS_PER_YEAR);
  const targetMonth = Math.round(inRange(lifeAge, 60, 120, 'Target age') * MONTHS_PER_YEAR);
  const targetMonths = targetMonth - AGE_60;
  const starts = [
    [AGE_60, AGE_65], [AGE_65, AGE_65], [AGE_70, AGE_70], [cppStart, oasStart]
  ];
  const flows = starts.map(([cpp, oas]) => cashFlow(cppBase, cpp, oas, yearsInCanada));
  const weights = flows[0].map((_, index) => {
    const years = (index + 1) / MONTHS_PER_YEAR;
    return { nominalWeight: (1 + inflation) ** years, presentWeight: (1 + realDiscount) ** -years };
  });
  const scenarios = starts.map(([cpp, oas], index) => ({
    cppStart: cpp,
    oasStart: oas,
    cppAtStart: cppMonthly(cppBase, cpp),
    oasAtStart: oasMonthly(oas, yearsInCanada, oas),
    oasAt75: oasMonthly(oas, yearsInCanada, OAS_BOOST_MONTH),
    ...summarize(flows[index], targetMonths, otherIncome, weights)
  }));
  const [early, standard, delayed, custom] = flows;
  const crossovers = [
    compare('cpp60-65', early, standard, 'cpp', weights),
    compare('cpp65-70', standard, delayed, 'cpp', weights),
    compare('cpp60-70', early, delayed, 'cpp', weights),
    compare('oas65-70', standard, delayed, 'oas', weights),
    compare('combined60-65', early, standard, 'combined', weights),
    compare('combined65-70', standard, delayed, 'combined', weights),
    compare('combined60-70', early, delayed, 'combined', weights),
    compare('custom-65', standard, custom, 'combined', weights)
  ];
  return { targetAge: targetMonth / MONTHS_PER_YEAR, scenarios, crossovers };
}
