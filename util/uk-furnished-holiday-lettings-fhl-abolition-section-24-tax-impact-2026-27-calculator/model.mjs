export const MAX_AMOUNT = 100_000_000;

const STANDARD_ALLOWANCE = 12_570;
const TAPER_START = 100_000;
const BASIC_BAND = 37_700;
const ADDITIONAL_THRESHOLD = 125_140;
const BASIC_RATE = 0.20;
const CGT_EXEMPTION = 3_000;
const BADR_LIFETIME_LIMIT = 1_000_000;

export function personalAllowance(income) {
  return Math.max(0, STANDARD_ALLOWANCE - Math.max(0, income - TAPER_START) / 2);
}

function taxableIncome(income) {
  return Math.max(0, income - personalAllowance(income));
}

export function incomeTax(income) {
  const taxable = taxableIncome(income);
  const basic = Math.min(taxable, BASIC_BAND);
  const higher = Math.max(0, Math.min(taxable, ADDITIONAL_THRESHOLD) - BASIC_BAND);
  const additional = Math.max(0, taxable - ADDITIONAL_THRESHOLD);
  return basic * BASIC_RATE + higher * 0.40 + additional * 0.45;
}

// Standalone company, full accounting year, augmented profits equal taxable profits.
export function corporationTax(profit) {
  const smallProfits = Math.min(profit, 50_000);
  const marginalProfits = Math.max(0, Math.min(profit, 250_000) - 50_000);
  const mainRateProfits = Math.max(0, profit - 250_000);
  return smallProfits * 0.19 + marginalProfits * 0.265 + mainRateProfits * 0.25;
}

function unusedBasicBand(income) {
  return Math.max(0, BASIC_BAND - taxableIncome(income));
}

function residentialGainTax(gain, basicBand) {
  const lowerRateGain = Math.min(gain, basicBand);
  return lowerRateGain * 0.18 + (gain - lowerRateGain) * 0.24;
}

export function residentialCgt(gain, income) {
  return residentialGainTax(Math.max(0, gain - CGT_EXEMPTION), unusedBasicBand(income));
}

function qualifyingBadrCgt(gain, income, rate) {
  const qualifyingGain = Math.min(gain, BADR_LIFETIME_LIMIT);
  const excessGain = gain - qualifyingGain;
  const remainingExemption = Math.max(0, CGT_EXEMPTION - excessGain);
  const remainingBasicBand = Math.max(0, unusedBasicBand(income) - qualifyingGain);
  return Math.max(0, qualifyingGain - remainingExemption) * rate
    + residentialGainTax(Math.max(0, excessGain - CGT_EXEMPTION), remainingBasicBand);
}

export function childBenefitChargePercent(income) {
  return Math.min(100, Math.max(0, Math.floor((income - 60_000) / 200)));
}

export function calculate({ grossIncome, runningCosts, mortgageInterest, otherIncome, capitalGain, pensionContribution }) {
  for (const amount of [grossIncome, runningCosts, mortgageInterest, otherIncome, capitalGain, pensionContribution]) {
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
      throw new RangeError('Enter amounts between £0 and £100,000,000.');
    }
  }

  const operatingProfit = grossIncome - runningCosts;
  const preTaxCash = operatingProfit - mortgageInterest;
  const oldTaxableProfit = Math.max(0, preTaxCash);
  const section24TaxableProfit = Math.max(0, operatingProfit);
  const oldTotalIncome = otherIncome + oldTaxableProfit;
  const newTotalIncome = otherIncome + section24TaxableProfit;

  const baselineTax = incomeTax(otherIncome);
  const oldIncomeTax = incomeTax(oldTotalIncome) - baselineTax;
  const grossTaxOnProfit = incomeTax(newTotalIncome) - baselineTax;
  const reliefBase = Math.min(mortgageInterest, section24TaxableProfit, taxableIncome(newTotalIncome));
  const sec24Credit = BASIC_RATE * reliefBase;
  const newNetIncomeTax = Math.max(0, grossTaxOnProfit - sec24Credit);

  const standardCgt = residentialCgt(capitalGain, newTotalIncome);
  const badrCgt2024 = qualifyingBadrCgt(capitalGain, oldTotalIncome, 0.10);
  const badrCgt2025 = qualifyingBadrCgt(capitalGain, oldTotalIncome, 0.14);
  const badrCgt2026 = qualifyingBadrCgt(capitalGain, newTotalIncome, 0.18);
  const spvProfit = oldTaxableProfit;
  const spvTax = corporationTax(spvProfit);

  return {
    oldTaxableProfit,
    section24TaxableProfit,
    oldIncomeTax,
    grossTaxOnProfit,
    sec24Credit,
    newNetIncomeTax,
    annualIncomeTaxIncrease: newNetIncomeTax - oldIncomeTax,
    financeCostsCarriedForward: mortgageInterest - reliefBase,
    oldTotalIncome,
    newTotalIncome,
    oldPersonalAllowance: personalAllowance(oldTotalIncome),
    newPersonalAllowance: personalAllowance(newTotalIncome),
    oldChildBenefitChargePercent: childBenefitChargePercent(oldTotalIncome),
    newChildBenefitChargePercent: childBenefitChargePercent(newTotalIncome),
    preTaxCash,
    oldAfterTaxCash: preTaxCash - oldIncomeTax,
    newAfterTaxCash: preTaxCash - newNetIncomeTax,
    oldRelevantEarnings: oldTaxableProfit,
    newRelevantEarnings: 0,
    pensionContributionAffected: Math.min(pensionContribution, oldTaxableProfit),
    standardCgt,
    badrCgt2024,
    badrCgt2025,
    badrCgt2026,
    extraCgtVsHistoricalBadr: standardCgt - badrCgt2024,
    extraCgtVsSameYearBadr: standardCgt - badrCgt2026,
    spvProfit,
    spvTax,
    spvAfterTaxCash: preTaxCash - spvTax,
  };
}
