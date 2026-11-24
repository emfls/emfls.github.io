export const CPP_2026 = Object.freeze({
  maximumMonthly: 1507.65,
  exemption: 3500,
  ympe: 74600,
  yampe: 85000,
  employeeCppRate: 0.0595,
  employeeCpp2Rate: 0.04,
});

const startAges = [60, 65, 70];
const milestoneAges = [75, 80, 85, 90, 95];

function requireRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(label + ' must be between ' + min + ' and ' + max + '.');
  }
}

export function ageFactor(ageMonths) {
  if (!Number.isInteger(ageMonths) || ageMonths < 720 || ageMonths > 840) {
    throw new RangeError('Claiming age must be a whole month from age 60 to 70.');
  }
  const monthsFrom65 = ageMonths - 780;
  return 1 + monthsFrom65 * (monthsFrom65 < 0 ? 0.006 : 0.007);
}

export function contributionEstimate(income, workType = 'employee') {
  requireRange(income, 0, Number.MAX_VALUE, 'Annual pensionable earnings');
  if (workType !== 'employee' && workType !== 'self-employed') {
    throw new RangeError('Choose employment or self-employment earnings.');
  }
  const share = workType === 'self-employed' ? 2 : 1;
  const cppBand = Math.max(0, Math.min(income, CPP_2026.ympe) - CPP_2026.exemption);
  const cpp2Band = Math.max(0, Math.min(income, CPP_2026.yampe) - CPP_2026.ympe);
  const cppCents = Math.round(cppBand * (100 * CPP_2026.employeeCppRate) * share);
  const cpp2Cents = Math.round(cpp2Band * (100 * CPP_2026.employeeCpp2Rate) * share);
  return {
    cpp: cppCents / 100,
    cpp2: cpp2Cents / 100,
    total: (cppCents + cpp2Cents) / 100,
  };
}

function geometricSum(months, logGrowth) {
  return logGrowth === 0 ? months : Math.expm1(months * logGrowth) / Math.expm1(logGrowth);
}

function cumulative(net, start, month, logGrowth, firstMonthDiscount) {
  return net * Math.exp(start * logGrowth) * geometricSum(month - start, logGrowth) * firstMonthDiscount;
}

function crossover(earlyAge, lateAge, logGrowth) {
  const gap = (lateAge - earlyAge) * 12;
  const earlyFactor = ageFactor(earlyAge * 12);
  const gain = ageFactor(lateAge * 12) - earlyFactor;

  // Express the early lead in units of the later option's first payment.
  const lead = earlyFactor * Math.exp(-gap * logGrowth) * geometricSum(gap, logGrowth);
  const scaledLead = lead * Math.expm1(logGrowth) / gain;
  if (scaledLead <= -1) return null; // The discounted gains have a finite upper bound.

  const months = logGrowth === 0 ? lead / gain : Math.log1p(scaledLead) / logGrowth;
  // Snap floating-point noise at an exact whole-month tie before rounding up.
  const nearest = Math.round(months);
  const wholeMonths = Math.abs(months - nearest) < 1e-10 ? nearest : Math.ceil(months);
  return lateAge * 12 + Math.max(1, wholeMonths);
}

// Values are CAD as of age 60. Rates are effective annual percentages.
export function comparePensions({ monthly, inflationRate, discountRate, taxRate }) {
  requireRange(monthly, 0, CPP_2026.maximumMonthly, 'Monthly age-65 CPP');
  requireRange(inflationRate, 0, 25, 'Annual CPI inflation');
  requireRange(discountRate, -25, 50, 'Annual nominal opportunity cost');
  requireRange(taxRate, 0, 100, 'Marginal tax rate');

  const inflationLog = Math.log1p(inflationRate / 100);
  const discountLog = Math.log1p(discountRate / 100);
  const bases = {
    nominal: inflationLog / 12,
    real: 0,
    present: (inflationLog - discountLog) / 12,
  };
  const monthlyPayments = startAges.map((age) => {
    const gross = monthly * ageFactor(age * 12);
    return { age, gross, net: gross * (1 - taxRate / 100) };
  });
  const breakEvens = [[60, 65], [65, 70], [60, 70]].map(([earlyAge, lateAge]) => ({
    earlyAge,
    lateAge,
    ...Object.fromEntries(Object.entries(bases).map(([basis, logGrowth]) => [
      basis, monthly === 0 || taxRate === 100 ? null : crossover(earlyAge, lateAge, logGrowth),
    ])),
  }));
  const milestones = milestoneAges.map((age) => ({
    age,
    ...Object.fromEntries(Object.entries(bases).map(([basis, logGrowth]) => [
      basis,
      monthlyPayments.map(({ age: startAge, net }) => cumulative(
        net, (startAge - 60) * 12, (age - 60) * 12, logGrowth,
        basis === 'present' ? Math.exp(-discountLog / 12) : 1,
      )),
    ])),
  }));
  return {
    monthly: monthlyPayments,
    breakEvens,
    milestones,
    realDiscountRate: 100 * Math.expm1(discountLog - inflationLog),
  };
}
