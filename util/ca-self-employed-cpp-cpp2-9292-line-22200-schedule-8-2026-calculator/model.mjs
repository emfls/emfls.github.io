export const CPP_2026 = Object.freeze({
  ybe: 3500,
  ympe: 74600,
  yampe: 85000,
  baseRateBps: 990,
  firstEnhancedRateBps: 200,
  secondEnhancedRateBps: 800,
  federalCreditRateBps: 1400,
  provincialCreditRateBps: Object.freeze({ ON: 505, BC: 560, AB: 800 }),
});

const centsAtRate = (cents, basisPoints) => Math.round(cents * basisPoints / 10000);

function contributions(business, employment) {
  const { ybe, ympe, yampe, baseRateBps, firstEnhancedRateBps, secondEnhancedRateBps } = CPP_2026;
  const exemption = ybe * 100;
  const firstCeiling = ympe * 100;
  const secondCeiling = yampe * 100;
  const combined = business + employment;

  // Standard full-year withholding: allocate the shared exemption and earnings bands to employment first.
  const firstEarnings = Math.max(0, Math.min(combined, firstCeiling) - Math.max(employment, exemption));
  const secondEarnings = Math.max(0, Math.min(combined, secondCeiling) - Math.max(employment, firstCeiling));
  const baseContribution = centsAtRate(firstEarnings, baseRateBps);
  const firstEnhanced = centsAtRate(firstEarnings, firstEnhancedRateBps);
  const tier2 = centsAtRate(secondEarnings, secondEnhancedRateBps);
  const tier1 = baseContribution + firstEnhanced;
  return { baseContribution, firstEnhanced, tier1, tier2, total: tier1 + tier2 };
}

/** Full-year CPP estimate in CAD. T4 pensionable earnings assume standard payroll withholding. */
export function calculateCPP({
  netBusinessIncome, t4PensionableEarnings = 0, province, marginalTaxRate, age,
  electedOut = false, partialYear = false,
}) {
  if (!Number.isFinite(netBusinessIncome) || !Number.isFinite(t4PensionableEarnings)
      || t4PensionableEarnings < 0 || !Number.isFinite(marginalTaxRate)
      || marginalTaxRate < 0 || marginalTaxRate > 100
      || !Number.isInteger(age) || age < 0 || age > 120
      || (province !== 'QC' && !Object.hasOwn(CPP_2026.provincialCreditRateBps, province))) {
    throw new RangeError('Enter valid income, province, tax rate and age values.');
  }
  if (province === 'QC') return { status: 'qpp' };
  if (partialYear) return { status: 'partial-year' };
  if (electedOut && (age < 65 || age >= 70)) {
    throw new RangeError('The full-year working-beneficiary election applies at ages 65–69.');
  }

  const ageExempt = age < 18 || age >= 70;
  const status = ageExempt ? 'age-exempt' : electedOut ? 'election-exempt' : 'estimated';
  const business = status === 'estimated'
    ? Math.round(Math.min(CPP_2026.yampe, Math.max(0, netBusinessIncome)) * 100)
    : 0;
  const employment = Math.round(Math.min(CPP_2026.yampe, t4PensionableEarnings) * 100);
  const amounts = contributions(business, employment);
  const line31000 = Math.round(amounts.baseContribution / 2);
  const line22200 = amounts.total - line31000;
  const deductionValue = centsAtRate(line22200, Math.round(marginalTaxRate * 100));
  const federalCredit = centsAtRate(line31000, CPP_2026.federalCreditRateBps);
  const provincialCredit = centsAtRate(line31000, CPP_2026.provincialCreditRateBps[province]);
  const creditValue = federalCredit + provincialCredit;
  const cents = {
    ...amounts, line22200, line31000, deductionValue, federalCredit, provincialCredit, creditValue,
    netCost: amounts.total - deductionValue - creditValue,
    quarterlyReserve: Math.ceil(amounts.total / 4),
    t4Offset: contributions(business, 0).total - amounts.total,
  };
  return { status, ...Object.fromEntries(Object.entries(cents).map(([key, value]) => [key, value / 100])) };
}
