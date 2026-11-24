export const DAYS_IN_YEAR = 365;
export const MAX_AMOUNT = 100_000_000;

const THRESHOLDS = {
  single: [105_000, 123_000, 164_000],
  family: [210_000, 246_000, 328_000],
};
const RATES_BP = [0, 100, 125, 150];

function toCents(amount) {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
    throw new RangeError('Enter AUD amounts from 0 to 100,000,000.');
  }
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 0.00001) {
    throw new RangeError('Enter AUD amounts to the nearest cent.');
  }
  return cents;
}

export function calculateMls({
  status = 'single',
  dependentChildren = 0,
  taxableIncome,
  assessableFhssRelease = 0,
  reportableFringeBenefits = 0,
  reportableSuperContributions = 0,
  netInvestmentAndRentalLosses = 0,
  exemptForeignIncome = 0,
  taxedFamilyTrustDistribution = 0,
  spouseMlsIncome = 0,
  daysWithoutCover = DAYS_IN_YEAR,
  annualPremium,
}) {
  if (status !== 'single' && status !== 'family') {
    throw new RangeError('Choose a household status.');
  }
  if (!Number.isSafeInteger(dependentChildren) || dependentChildren < 0 || dependentChildren > 100) {
    throw new RangeError('Enter a whole number of dependent children from 0 to 100.');
  }
  if (!Number.isInteger(daysWithoutCover) || daysWithoutCover < 0 || daysWithoutCover > DAYS_IN_YEAR) {
    throw new RangeError('Enter a whole number of uncovered days from 0 to 365.');
  }

  const taxable = toCents(taxableIncome);
  const fhss = toCents(assessableFhssRelease);
  if (fhss > taxable) {
    throw new RangeError('The assessable FHSS release cannot exceed taxable income.');
  }
  const mlsTaxable = taxable - fhss;
  const surchargeBase = mlsTaxable + toCents(reportableFringeBenefits) + toCents(taxedFamilyTrustDistribution);
  const foreign = toCents(exemptForeignIncome);
  const individualIncome = surchargeBase + toCents(reportableSuperContributions)
    + toCents(netInvestmentAndRentalLosses) + (mlsTaxable >= 100 ? foreign : 0);
  const spouse = toCents(spouseMlsIncome);
  const tierIncome = individualIncome + (status === 'family' ? spouse : 0);
  const childBonus = status === 'family' ? Math.max(0, dependentChildren - 1) * 1500 : 0;
  const tier = THRESHOLDS[status].filter(limit => tierIncome > (limit + childBonus) * 100).length;
  const rateBp = RATES_BP[tier];

  const premium = toCents(annualPremium);
  const fullYearMls = Math.round(surchargeBase * rateBp / 10_000);
  const proratedMls = Math.round(surchargeBase * rateBp * daysWithoutCover / (10_000 * DAYS_IN_YEAR));
  const standardLevy = Math.round(taxable * 200 / 10_000);

  return {
    individualMlsIncome: individualIncome / 100,
    tierIncome: tierIncome / 100,
    surchargeBase: surchargeBase / 100,
    tier,
    rate: rateBp / 10_000,
    childBonus,
    fullYearMls: fullYearMls / 100,
    proratedMls: proratedMls / 100,
    standardLevy: standardLevy / 100,
    breakEvenPremium: fullYearMls / 100,
    netSavings: (fullYearMls - premium) / 100,
  };
}
