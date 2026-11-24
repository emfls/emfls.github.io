// US Umbrella Liability Insurance Engine (2026 Standards)
export function calcExposedHomeEquity(homeValue, mortgageBalance, homesteadExemption) {
  const equity = Math.max(0, homeValue - mortgageBalance);
  return Math.max(0, equity - homesteadExemption);
}

export function recommendUmbrellaTier(totalExposed) {
  if (totalExposed <= 1000000) return 1000000;
  if (totalExposed <= 2000000) return 2000000;
  if (totalExposed <= 3000000) return 3000000;
  if (totalExposed <= 5000000) return 5000000;
  return Math.ceil(totalExposed / 1000000) * 1000000;
}

export function calcUmbrellaPremium(coverageAmount, options = {}) {
  const {
    vehicles = 2,
    homes = 1,
    rentals = 0,
    hasTeenDriver = false,
    hasPoolOrTrampoline = false
  } = options;

  if (coverageAmount <= 0) return 0;
  const tiersOver1M = Math.max(0, (coverageAmount - 1000000) / 1000000);
  
  // Base rates: $220 for 1st $1M + $95 per additional $1M
  let basePremium = 220 + (tiersOver1M * 95);

  // Risk surcharges
  if (hasTeenDriver) basePremium += 140;
  if (hasPoolOrTrampoline) basePremium += 45;
  if (vehicles > 2) basePremium += (vehicles - 2) * 35;
  if (rentals > 0) basePremium += rentals * 65;

  return basePremium;
}

export function checkUnderlyingCoverageGaps(autoBI, autoPD, homeLiability) {
  // Carrier minimum attachment requirements: Auto $250k/$500k, Auto PD $100k, Home $300k
  const autoBIGap = autoBI < 250000;
  const autoPDGap = autoPD < 100000;
  const homeGap = homeLiability < 300000;
  const hasGap = autoBIGap || autoPDGap || homeGap;

  return {
    hasGap,
    autoBIGap,
    autoPDGap,
    homeGap,
    autoBIMin: 250000,
    autoPDMin: 100000,
    homeMin: 300000
  };
}

export function computeUmbrellaPlan(inputs) {
  const {
    homeValue = 800000,
    mortgageBalance = 450000,
    homesteadExemption = 300000,
    taxableInvestments = 200000,
    bankCash = 50000,
    rentalRealEstateEquity = 150000,
    erisaQualifiedRetirement = 400000, // 100% protected under Federal ERISA law
    annualWages = 120000,
    autoBI = 250000,
    autoPD = 100000,
    homeLiability = 300000,
    vehicles = 2,
    rentals = 0,
    hasTeenDriver = false,
    hasPool = false
  } = inputs;

  if (homeValue < 0 || mortgageBalance < 0) throw new RangeError('Values cannot be negative');

  const homeEquity = Math.max(0, homeValue - mortgageBalance);
  const exposedHomeEquity = Math.max(0, homeEquity - homesteadExemption);
  const garnishableFutureWages = annualWages * 1.0; // Standard 1.0x annual wage exposure
  
  const totalExposedNetWorth = exposedHomeEquity + taxableInvestments + bankCash + rentalRealEstateEquity + garnishableFutureWages;
  const recommendedCoverage = recommendUmbrellaTier(totalExposedNetWorth);
  
  const annualPremium = calcUmbrellaPremium(recommendedCoverage, {
    vehicles,
    rentals,
    hasTeenDriver,
    hasPoolOrTrampoline: hasPool
  });

  const protectionPerDollar = annualPremium > 0 ? (recommendedCoverage / annualPremium) : 0;
  const gaps = checkUnderlyingCoverageGaps(autoBI, autoPD, homeLiability);

  return {
    homeEquity,
    exposedHomeEquity,
    erisaProtectedAmount: erisaQualifiedRetirement,
    garnishableFutureWages,
    totalExposedNetWorth,
    recommendedCoverage,
    annualPremium,
    protectionPerDollar,
    gaps
  };
}
