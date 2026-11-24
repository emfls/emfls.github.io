const rules = {
  single: {
    ordinary: [12400, 50400, 105700, 201775, 256225, 640600],
    capital: [49450, 545500],
    surtaxThreshold: 200000
  },
  mfj: {
    ordinary: [24800, 100800, 211400, 403550, 512450, 768700],
    capital: [98900, 613700],
    surtaxThreshold: 250000
  }
};
const ordinaryRates = [1000, 1200, 2200, 2400, 3200, 3500, 3700];
const capitalRates = [0, 1500, 2000];
const maxDollars = 1_000_000_000;
const positive = amount => Math.max(0, amount);

function cents(value, label, max = maxDollars) {
  const rounded = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > max || rounded / 100 !== value) {
    throw new RangeError(`${label} must be between 0 and ${max.toLocaleString('en-US')}, with up to two decimal places.`);
  }
  return rounded;
}

// Rates are integer basis points. Keep fractional cents until summing each tax.
function bandTax(base, added, ceilings, rates) {
  let lower = 0;
  let tax = 0;
  for (const [index, rate] of rates.entries()) {
    const upper = index < ceilings.length ? ceilings[index] * 100 : Infinity;
    tax += positive(Math.min(base + added, upper) - Math.max(base, lower)) * rate;
    lower = upper;
  }
  return Math.round(tax / 10000);
}

function excessAdded(base, added, threshold) {
  return positive(base + added - threshold * 100) - positive(base - threshold * 100);
}

function rateTax(amount, rate) {
  return Math.round(amount * rate / 10000);
}

export function calculateNso({
  filing, shares, strikePrice, fmvAtExercise, exitPrice, taxableIncome,
  employerWages, socialSecurityWages, otherMedicareWages, priorSupplemental, stateRate,
  saleTiming, saleTaxableIncome, saleMagi
}) {
  if (!Object.hasOwn(rules, filing)) throw new RangeError('Choose a filing status.');
  if (!['sameYearShort', 'laterYearShort', 'long'].includes(saleTiming)) {
    throw new RangeError('Choose when you plan to sell.');
  }
  if (!Number.isSafeInteger(shares) || shares < 1 || shares > 10_000_000) {
    throw new RangeError('Enter a whole number of shares between 1 and 10,000,000.');
  }

  const strikeCost = cents(strikePrice, 'Strike price') * shares;
  const exerciseValue = cents(fmvAtExercise, 'Exercise fair market value') * shares;
  const exitProceeds = cents(exitPrice, 'Future sale price') * shares;
  if (Math.max(strikeCost, exerciseValue, exitProceeds) > maxDollars * 100) {
    throw new RangeError('Total strike cost, exercise value and sale proceeds must each be $1 billion or less.');
  }

  const ordinaryBase = cents(taxableIncome, '2026 taxable ordinary income');
  const employerBase = cents(employerWages, 'YTD wages at the exercising employer');
  const socialSecurityBase = cents(socialSecurityWages, 'YTD Social Security wages');
  const householdBase = employerBase + cents(otherMedicareWages, 'Other household Medicare wages');
  const priorSupplementalCents = cents(priorSupplemental, 'Prior supplemental wages');
  const stateRateBps = cents(stateRate, 'State tax rate', 100);
  const magi = cents(saleMagi, 'Sale-year MAGI');
  const { ordinary, capital, surtaxThreshold } = rules[filing];

  const spread = positive(exerciseValue - strikeCost);
  const basis = strikeCost + spread;
  const federalTax = bandTax(ordinaryBase, spread, ordinary, ordinaryRates);
  const federalWithholding = bandTax(priorSupplementalCents, spread, [1_000_000], [2200, 3700]);
  const socialSecurity = rateTax(Math.min(spread, positive(18_450_000 - socialSecurityBase)), 620);
  const medicare = rateTax(spread, 145);
  const additionalMedicare = rateTax(excessAdded(householdBase, spread, surtaxThreshold), 90);
  const additionalMedicareWithheld = rateTax(excessAdded(employerBase, spread, 200_000), 90);
  const stateExerciseTax = rateTax(spread, stateRateBps);
  const exerciseTax = federalTax + socialSecurity + medicare + additionalMedicare + stateExerciseTax;
  const exerciseWithholding = federalWithholding + socialSecurity + medicare +
    additionalMedicareWithheld + stateExerciseTax;

  const sameYear = saleTiming === 'sameYearShort';
  const longTerm = saleTiming === 'long';
  const exitOrdinaryBase = sameYear
    ? ordinaryBase + spread
    : cents(saleTaxableIncome, 'Sale-year taxable ordinary income');
  const exitMagi = magi + (sameYear ? spread : 0);
  const capitalGain = exitProceeds - basis;
  const taxableGain = positive(capitalGain);
  const saleFederalTax = longTerm
    ? bandTax(exitOrdinaryBase, taxableGain, capital, capitalRates)
    : bandTax(exitOrdinaryBase, taxableGain, ordinary, ordinaryRates);
  const niit = rateTax(Math.min(taxableGain, positive(exitMagi + taxableGain - surtaxThreshold * 100)), 380);
  const stateSaleTax = rateTax(taxableGain, stateRateBps);
  const saleTax = saleFederalTax + niit + stateSaleTax;
  const cashAtExercise = strikeCost + exerciseWithholding;
  const cashWithTaxReserve = strikeCost + exerciseTax;
  const sameDayNetCash = exerciseValue - cashAtExercise;
  const sameDayNetProfit = exerciseValue - cashWithTaxReserve;
  const holdNetProfit = exitProceeds - saleTax - cashWithTaxReserve;

  const amountsInCents = {
    strikeCost, exerciseValue, spread, basis, federalTax, federalWithholding,
    federalGap: federalTax - federalWithholding, socialSecurity, medicare, additionalMedicare,
    additionalMedicareWithheld, stateExerciseTax, exerciseTax, exerciseWithholding,
    cashAtExercise, cashWithTaxReserve, sameDayNetCash, sameDayNetProfit,
    exitProceeds, capitalGain, saleFederalTax, niit, stateSaleTax, saleTax, holdNetProfit,
    holdAdvantage: holdNetProfit - sameDayNetProfit
  };
  return Object.fromEntries(Object.entries(amountsInCents).map(([key, amount]) => [key, amount / 100]));
}
