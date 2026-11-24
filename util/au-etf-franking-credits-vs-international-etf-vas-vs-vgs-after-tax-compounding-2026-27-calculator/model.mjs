export const TAX_PROFILES = Object.freeze([
  { id: 'pension', label: 'Retirement-phase super (0%)', rate: 0, cgtRate: 0 },
  { id: 'accumulation', label: 'Accumulation super (15%)', rate: 0.15, cgtRate: 0.10 },
  { id: 'personal-0', label: 'Personal (0%)', rate: 0, cgtRate: 0 },
  { id: 'personal-15', label: 'Personal (15%, before Medicare)', rate: 0.15, cgtRate: 0.075 },
  { id: 'personal-32', label: 'Personal (32%, incl. Medicare)', rate: 0.32, cgtRate: 0.16 },
  { id: 'personal-39', label: 'Personal (39%, incl. Medicare)', rate: 0.39, cgtRate: 0.195 },
  { id: 'personal-47', label: 'Personal (47%, incl. Medicare)', rate: 0.47, cgtRate: 0.235 },
].map(Object.freeze));

export const FOREIGN_TAX = Object.freeze({
  fund: Object.freeze({ withholding: 0.15, eligibleFito: 0.15 }),
  treaty: Object.freeze({ withholding: 0.15, eligibleFito: 0.15 }),
  undocumented: Object.freeze({ withholding: 0.30, eligibleFito: 0.15 }),
});

export function australianDistribution(cashDividend, frankingPct, marginalRate) {
  const frankingCredit = cashDividend * frankingPct * (0.30 / 0.70);
  const grossedUpDividend = cashDividend + frankingCredit;
  const tax = grossedUpDividend * marginalRate - frankingCredit;
  return { frankingCredit, grossedUpDividend, tax, reinvested: cashDividend - tax };
}

export function internationalDistribution(grossDividend, marginalRate, { withholding, eligibleFito }) {
  const foreignTax = grossDividend * withholding;
  const australianTaxBeforeOffset = grossDividend * marginalRate;
  // shortcut: Limit FITO to this distribution until the model includes whole-of-return tax.
  const fito = Math.min(foreignTax, grossDividend * eligibleFito, australianTaxBeforeOffset);
  const australianTax = australianTaxBeforeOffset - fito;
  const tax = foreignTax + australianTax;
  return { foreignTax, fito, australianTax, tax, reinvested: grossDividend - tax };
}

function project(principal, years, cashYield, growth, cgtRate, distribution) {
  let balance = principal;
  let costBase = principal;
  let annualTaxPaid = 0;
  let frankingCredits = 0;
  let frankingRefunds = 0;
  for (let year = 0; year < years; year += 1) {
    const income = distribution(balance * cashYield);
    annualTaxPaid += income.tax;
    frankingCredits += income.frankingCredit ?? 0;
    frankingRefunds += Math.max(0, -income.tax);
    costBase += income.reinvested;
    balance += balance * growth + income.reinvested;
  }
  const capitalGain = balance - costBase;
  const cgt = Math.max(0, capitalGain) * cgtRate;
  const finalValue = balance - cgt;
  return {
    balance, costBase, capitalGain, cgt, finalValue, annualTaxPaid, frankingCredits, frankingRefunds,
    cagr: Math.expm1(Math.log(finalValue / principal) / years),
  };
}

export function compareEtfs({
  principal, years, auYield, auGrowth, frankingPct, intlYield, intlGrowth, profile, foreignTaxMode,
}) {
  const tax = TAX_PROFILES.find(({ id }) => id === profile);
  const foreign = Object.hasOwn(FOREIGN_TAX, foreignTaxMode) ? FOREIGN_TAX[foreignTaxMode] : undefined;
  const valid = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  if (!valid(principal, 1, 100000000) || !valid(years, 10, 30) || !Number.isInteger(years) ||
      !valid(auYield, 0, 0.25) || !valid(intlYield, 0, 0.25) ||
      !valid(auGrowth, -0.5, 0.5) || !valid(intlGrowth, -0.5, 0.5) ||
      !valid(frankingPct, 0, 1) || !tax || !foreign) {
    throw new RangeError('Check the investment assumptions and tax settings.');
  }

  const australian = project(principal, years, auYield, auGrowth, tax.cgtRate,
    (cash) => australianDistribution(cash, frankingPct, tax.rate));
  const international = project(principal, years, intlYield, intlGrowth, tax.cgtRate,
    (cash) => internationalDistribution(cash, tax.rate, foreign));
  return {
    australian, international,
    valueGap: australian.finalValue - international.finalValue,
    cagrGap: australian.cagr - international.cagr,
  };
}
