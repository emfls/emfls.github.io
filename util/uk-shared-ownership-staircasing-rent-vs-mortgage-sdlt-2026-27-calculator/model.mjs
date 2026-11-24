// 2026/27 HMRC Stamp Duty Land Tax (SDLT) Schedules & Shared Ownership Rules
// Standard Residential Bands (England & NI):
// - Up to £125,000: 0%
// - £125,001 to £250,000: 2%
// - £250,001 to £925,000: 5%
// - £925,001 to £1,500,000: 10%
// - Above £1,500,000: 12%
//
// First-Time Buyer (FTB) Relief 2026/27:
// - Up to £300,000: 0%
// - £300,001 to £500,000: 5%
// - Only eligible if property Full Market Value (FMV) <= £500,000

export function calcStandardSdlt(price, isFirstTimeBuyer = false) {
  if (price <= 0 || isNaN(price)) return 0;

  if (isFirstTimeBuyer && price <= 500000) {
    if (price <= 300000) return 0;
    return (price - 300000) * 0.05;
  }

  let tax = 0;
  if (price > 125000) {
    tax += Math.min(price - 125000, 125000) * 0.02;
  }
  if (price > 250000) {
    tax += Math.min(price - 250000, 675000) * 0.05;
  }
  if (price > 925000) {
    tax += Math.min(price - 925000, 575000) * 0.10;
  }
  if (price > 1500000) {
    tax += (price - 1500000) * 0.12;
  }
  return tax;
}

export function calcMonthlyMortgage(principal, annualRate, termYears = 25) {
  if (principal <= 0) return 0;
  if (annualRate <= 0) return principal / (termYears * 12);
  const r = annualRate / 12;
  const n = termYears * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calcSharedOwnership(inputs) {
  const {
    fullMarketValue = 350000,
    initialSharePct = 0.40, // 40% initial share
    buyerDepositPct = 0.05, // 5% deposit of the share
    mortgageInterestRate = 0.052,
    mortgageTermYears = 25,
    housingAssocRentRate = 0.0275, // standard 2.75% of unsold equity
    monthlyServiceCharge = 150,
    isFirstTimeBuyer = true,
    annualPropertyGrowth = 0.03, // 3% annual property inflation
    staircaseYear = 5,
    staircaseSharePct = 0.25 // buying an extra 25%
  } = inputs;

  if (fullMarketValue <= 0 || isNaN(fullMarketValue)) throw new RangeError('Full Market Value must be positive');
  if (initialSharePct <= 0 || initialSharePct >= 1.0) throw new RangeError('Initial share must be between 1% and 99%');

  // Initial Share Economics
  const initialShareValue = fullMarketValue * initialSharePct;
  const depositAmount = initialShareValue * buyerDepositPct;
  const mortgagePrincipal = initialShareValue - depositAmount;
  const initialMonthlyMortgage = calcMonthlyMortgage(mortgagePrincipal, mortgageInterestRate, mortgageTermYears);

  // Unsold Share Rent
  const unsoldEquity = fullMarketValue * (1 - initialSharePct);
  const initialMonthlyRent = (unsoldEquity * housingAssocRentRate) / 12;
  const initialTotalMonthly = initialMonthlyMortgage + initialMonthlyRent + monthlyServiceCharge;

  // SDLT Option A: Market Value Election (pay SDLT on 100% FMV upfront)
  const sdltMarketValueUpfront = calcStandardSdlt(fullMarketValue, isFirstTimeBuyer);

  // SDLT Option B: Staged Payments (pay SDLT on initial premium/share only)
  // For initial share under £125k / £300k, often £0 SDLT!
  const sdltStagedUpfront = calcStandardSdlt(initialShareValue, isFirstTimeBuyer);

  // Year 5 Staircasing Projection
  const futureFmv = fullMarketValue * Math.pow(1 + annualPropertyGrowth, staircaseYear);
  const staircaseCost = futureFmv * staircaseSharePct;
  const newOwnedPct = initialSharePct + staircaseSharePct;
  const remainingUnsoldPct = Math.max(0, 1 - newOwnedPct);
  const newMonthlyRent = (futureFmv * remainingUnsoldPct * housingAssocRentRate) / 12;

  // Future SDLT on staircasing under Staged Payments:
  // Statutory rule: If total ownership stays <= 80%, staircasing tranches pay £0 SDLT!
  // If staircasing crosses >80% (e.g. to 100%), linked-transaction SDLT is triggered on the full cumulative price!
  let staircaseSdlt = 0;
  if (newOwnedPct > 0.80) {
    // Linked transaction calculation on cumulative consideration
    const totalConsiderationPaid = initialShareValue + staircaseCost;
    const fullRateTax = calcStandardSdlt(totalConsiderationPaid, false);
    // Proportion applicable to this tranche
    staircaseSdlt = fullRateTax * (staircaseCost / totalConsiderationPaid);
  }

  const legalValuationFees = 1650; // £450 RICS valuation + £1,200 solicitor fees
  const totalStaircasingOutlay = staircaseCost + staircaseSdlt + legalValuationFees;

  const totalSdltOptionA = sdltMarketValueUpfront; // £0 on future staircasing
  const totalSdltOptionB = sdltStagedUpfront + staircaseSdlt;
  const sdltStrategyWinner = totalSdltOptionA < totalSdltOptionB ? 'Market Value Election' : 'Staged Payments';

  return {
    fullMarketValue,
    initialSharePct: initialSharePct * 100,
    initialShareValue: Math.round(initialShareValue),
    depositAmount: Math.round(depositAmount),
    mortgagePrincipal: Math.round(mortgagePrincipal),
    initialMonthlyMortgage: Math.round(initialMonthlyMortgage),
    initialMonthlyRent: Math.round(initialMonthlyRent),
    monthlyServiceCharge: Math.round(monthlyServiceCharge),
    initialTotalMonthly: Math.round(initialTotalMonthly),
    sdlt: {
      marketValueOption: Math.round(sdltMarketValueUpfront),
      stagedOptionUpfront: Math.round(sdltStagedUpfront),
      staircaseFutureSdlt: Math.round(stcaseSdlt(staircaseSdlt)),
      totalSdltOptionA: Math.round(totalSdltOptionA),
      totalSdltOptionB: Math.round(totalSdltOptionB),
      sdltSavings: Math.abs(Math.round(totalSdltOptionA - totalSdltOptionB)),
      winner: sdltStrategyWinner
    },
    staircasing: {
      year: staircaseYear,
      futureFmv: Math.round(futureFmv),
      staircaseSharePct: staircaseSharePct * 100,
      staircaseCost: Math.round(staircaseCost),
      newOwnedPct: newOwnedPct * 100,
      newMonthlyRent: Math.round(newMonthlyRent),
      monthlyRentReduction: Math.round(initialMonthlyRent - newMonthlyRent),
      totalOutlay: Math.round(totalStaircasingOutlay)
    }
  };

  function stcaseSdlt(val) { return isNaN(val) ? 0 : val; }
}
