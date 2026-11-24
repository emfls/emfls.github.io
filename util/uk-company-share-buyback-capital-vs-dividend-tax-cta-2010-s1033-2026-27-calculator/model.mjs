export const TAX = Object.freeze({
  personalAllowance: 12_570,
  taperStart: 100_000,
  basicBand: 37_700,
  additionalThreshold: 125_140,
  dividendAllowance: 500,
  dividendRates: Object.freeze([0.1075, 0.3575, 0.3935]),
  annualExemption: 3_000,
  cgtBasic: 0.18,
  cgtHigher: 0.24,
  badrRate: 0.18,
  badrCap: 1_000_000,
  proposedBadrCap: 500_000,
  stampThreshold: 1_000,
  stampRate: 0.005,
  stampIncrement: 5,
});

const clamp = (value, maximum) => Math.min(Math.max(0, value), maximum);
const money = value => Math.round((value + Number.EPSILON) * 100) / 100;

function validate(value, label, maximum) {
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new RangeError(`${label} must be between 0 and ${maximum.toLocaleString('en-GB')}.`);
  }
}

function bandTax(start, end, rates) {
  return (
    Math.max(0, Math.min(end, TAX.basicBand) - start) * rates[0] +
    Math.max(0, Math.min(end, TAX.additionalThreshold) - Math.max(start, TAX.basicBand)) * rates[1] +
    Math.max(0, end - Math.max(start, TAX.additionalThreshold)) * rates[2]
  );
}

// Models non-savings income at England, Wales and Northern Ireland rates.
export function incomeTax(otherIncome, dividends) {
  const total = otherIncome + dividends;
  const allowance = Math.max(0, TAX.personalAllowance - Math.max(0, total - TAX.taperStart) / 2);
  const nonDividend = Math.max(0, otherIncome - allowance);
  const taxableIncome = Math.max(0, total - allowance);
  const allowanceUsed = clamp(taxableIncome - nonDividend, TAX.dividendAllowance);
  const dividendTax = bandTax(nonDividend + allowanceUsed, taxableIncome, TAX.dividendRates);
  const nonDividendTax = bandTax(0, nonDividend, [0.20, 0.40, 0.45]);
  return { allowance, taxableIncome, dividendTax, nonDividendTax, totalTax: dividendTax + nonDividendTax };
}

function capitalTax(gain, eligibleBadr, priorBadr, cap, annualExemption, taxableIncome) {
  const badrGain = clamp(gain, eligibleBadr ? Math.max(0, cap - priorBadr) : 0);
  const ordinaryGain = gain - badrGain;
  const taxableOrdinary = Math.max(0, ordinaryGain - annualExemption);
  const taxableBadr = Math.max(0, badrGain - Math.max(0, annualExemption - ordinaryGain));
  const basicRateGain = clamp(taxableOrdinary, Math.max(0, TAX.basicBand - taxableIncome - taxableBadr));
  const higherRateGain = taxableOrdinary - basicRateGain;
  const tax = money(taxableBadr * TAX.badrRate + basicRateGain * TAX.cgtBasic + higherRateGain * TAX.cgtHigher);
  return { tax, badrGain, taxableBadr, basicRateGain, higherRateGain };
}

export function stampDuty(price) {
  if (price <= TAX.stampThreshold) return 0;
  // Consideration is entered in pennies. Divide by the consideration per £5 of duty.
  const penniesPerIncrement = TAX.stampIncrement / TAX.stampRate * 100;
  return Math.ceil(Math.round(price * 100) / penniesPerIncrement) * TAX.stampIncrement;
}

export function checkEligibility(input) {
  const {
    unquotedTrading, tradeBenefit, ukResident, cleanArrangement, otherConditions,
    ownershipYears, inherited, beforeHolding, afterHolding, ordinary, voting, loan, windingUp,
  } = input;
  validate(ownershipYears, 'Ownership years', 150);
  for (const value of [beforeHolding, afterHolding, ordinary, voting, loan, windingUp]) {
    validate(value, 'Shareholding or rights percentage', 100);
  }
  const requiredYears = inherited ? 3 : 5;
  const largestRight = Math.max(ordinary, voting, loan, windingUp);
  const checks = {
    unquotedTrading: unquotedTrading === true,
    tradeBenefit: tradeBenefit === true,
    ukResident: ukResident === true,
    cleanArrangement: cleanArrangement === true,
    ownership: ownershipYears >= requiredYears,
    substantialReduction: afterHolding * 4 <= beforeHolding * 3 + 1e-9,
    statutoryConnection: largestRight <= 30,
    strictConnection: largestRight < 30,
    otherConditions: otherConditions === true,
  };
  const { strictConnection, ...statutory } = checks;
  const passesStatutory = Object.values(statutory).every(Boolean);
  return { checks, requiredYears, passesStatutory, passesScreen: passesStatutory && strictConnection };
}

export function calculateBuyback(input) {
  const {
    price, baseCost, subscribedCapital, otherIncome, otherDividends,
    priorBadr, annualExemption, badr,
  } = input;
  for (const [label, value] of Object.entries({
    'Buyback price': price, 'CGT acquisition cost': baseCost, 'Originally subscribed capital': subscribedCapital,
    'Other income': otherIncome, 'Other dividends': otherDividends, 'Prior BADR gains': priorBadr,
  })) {
    validate(value, label, 1_000_000_000);
  }
  validate(annualExemption, 'Unused CGT exemption', TAX.annualExemption);

  const capitalGain = Math.max(0, price - baseCost);
  const distribution = Math.max(0, price - subscribedCapital);
  const residualGain = price - distribution - baseCost;
  const before = incomeTax(otherIncome, otherDividends);
  const after = incomeTax(otherIncome, otherDividends + distribution);

  const capital = capitalTax(capitalGain, badr, priorBadr, TAX.badrCap, annualExemption, before.taxableIncome);
  const future = capitalTax(capitalGain, badr, priorBadr, TAX.proposedBadrCap, annualExemption, before.taxableIncome);
  const residual = capitalTax(Math.max(0, residualGain), false, 0, 0, annualExemption, after.taxableIncome);
  const incrementalIncomeTax = money(after.totalTax - before.totalTax);
  const distributionRouteTax = money(incrementalIncomeTax + residual.tax);

  return {
    capitalGain, distribution, residualGain, capital, future,
    dividendTaxIncrease: money(after.dividendTax - before.dividendTax),
    otherIncomeTaxIncrease: money(after.nonDividendTax - before.nonDividendTax),
    incrementalIncomeTax, distributionRouteTax, residualCgt: residual.tax,
    allowanceBefore: before.allowance,
    allowanceAfter: after.allowance,
    capitalNet: money(price - capital.tax),
    dividendNet: money(price - distributionRouteTax),
    capitalSaving: money(distributionRouteTax - capital.tax),
    delayCost: money(future.tax - capital.tax),
    stampDuty: stampDuty(price),
  };
}
