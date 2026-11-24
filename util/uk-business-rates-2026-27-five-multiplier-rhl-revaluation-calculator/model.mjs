// 2026/27 England Business Rates Reform: New Five-Multiplier Statutory Model
export const BUSINESS_RATES_MULTIPLIERS_2026_27 = {
  small_non_rhl: 0.432, // 43.2p (RV < £51,000 Non-Retail/Hospitality/Leisure)
  standard_non_rhl: 0.480, // 48.0p (£51,000 <= RV < £500,000 Non-RHL)
  small_rhl: 0.382, // 38.2p (RV < £51,000 Retail, Hospitality & Leisure)
  standard_rhl: 0.430, // 43.0p (£51,000 <= RV < £500,000 RHL)
  high_value: 0.508 // 50.8p (RV >= £500,000 All Sectors)
};

export const OLD_MULTIPLIERS_2025_26 = {
  small: 0.499, // 49.9p
  standard: 0.555 // 55.5p
};

export function calcUkBusinessRates2026(inputs = {}) {
  const {
    rateableValue = 35000, // Valuation Office Agency (VOA) Rateable Value (RV)
    isRHL = true, // Retail, Hospitality or Leisure property
    isSingleProperty = true, // Eligible for Small Business Rate Relief (SBRR)
    cityOfLondonPremium = false // Optional City of London 1.4p premium
  } = inputs;

  const rv = Math.max(0, Number(rateableValue) || 0);

  // 1. Determine 2026/27 Five-Multiplier Category
  let multiplierKey = 'small_non_rhl';
  let multiplierName = 'Small Non-RHL';
  let multiplierRate = 0.432;

  if (rv >= 500000) {
    multiplierKey = 'high_value';
    multiplierName = 'High-Value Property (RV >= £500k)';
    multiplierRate = BUSINESS_RATES_MULTIPLIERS_2026_27.high_value;
  } else if (rv >= 51000) {
    if (isRHL) {
      multiplierKey = 'standard_rhl';
      multiplierName = 'Standard RHL (£51k–£500k)';
      multiplierRate = BUSINESS_RATES_MULTIPLIERS_2026_27.standard_rhl;
    } else {
      multiplierKey = 'standard_non_rhl';
      multiplierName = 'Standard Non-RHL (£51k–£500k)';
      multiplierRate = BUSINESS_RATES_MULTIPLIERS_2026_27.standard_non_rhl;
    }
  } else {
    // RV < £51,000
    if (isRHL) {
      multiplierKey = 'small_rhl';
      multiplierName = 'Small Business RHL (RV < £51k)';
      multiplierRate = BUSINESS_RATES_MULTIPLIERS_2026_27.small_rhl;
    } else {
      multiplierKey = 'small_non_rhl';
      multiplierName = 'Small Business Non-RHL (RV < £51k)';
      multiplierRate = BUSINESS_RATES_MULTIPLIERS_2026_27.small_non_rhl;
    }
  }

  if (cityOfLondonPremium) {
    multiplierRate += 0.014; // +1.4p premium
  }

  const grossBill2026 = rv * multiplierRate;

  // 2. Small Business Rate Relief (SBRR) in England
  // 100% relief for RV <= £12,000; tapered relief for £12,001 to £15,000
  let sbrrPercent = 0;
  if (isSingleProperty && rv <= 15000) {
    if (rv <= 12000) {
      sbrrPercent = 100;
    } else {
      sbrrPercent = Math.max(0, ((15000 - rv) / 3000) * 100);
    }
  }
  const sbrrDiscount = grossBill2026 * (sbrrPercent / 100);
  const netBill2026 = Math.max(0, grossBill2026 - sbrrDiscount);

  // 3. Comparison with 2025/26 Old System
  // In 2025/26: Small multiplier was 49.9p (RV < 51k), Standard 55.5p (RV >= 51k)
  const oldMultiplier = rv < 51000 ? OLD_MULTIPLIERS_2025_26.small : OLD_MULTIPLIERS_2025_26.standard;
  let oldGrossBill = rv * oldMultiplier;
  let oldSbrrDiscount = oldGrossBill * (sbrrPercent / 100);
  let oldNetBill = Math.max(0, oldGrossBill - oldSbrrDiscount);
  // In 2025/26 RHL properties had 40% relief capped at £110k
  if (isRHL && sbrrPercent === 0) {
    const rhlRelief = Math.min(110000, oldNetBill * 0.40);
    oldNetBill = Math.max(0, oldNetBill - rhlRelief);
  }

  const billDifference = netBill2026 - oldNetBill;
  const savingsVsOld = oldNetBill - netBill2026;
  const percentChange = oldNetBill > 0 ? (billDifference / oldNetBill) * 100 : 0;

  return {
    rateableValue: Math.round(rv * 100) / 100,
    isRHL,
    isSingleProperty,
    multiplierKey,
    multiplierName,
    multiplierPence: Math.round(multiplierRate * 1000) / 10, // e.g. 38.2p
    grossBill2026: Math.round(grossBill2026 * 100) / 100,
    sbrrPercent: Math.round(sbrrPercent * 10) / 10,
    sbrrDiscount: Math.round(sbrrDiscount * 100) / 100,
    netBill2026: Math.round(netBill2026 * 100) / 100,
    monthlyBill2026: Math.round((netBill2026 / 10) * 100) / 100, // Standard UK 10 monthly instalments
    // Old 2025/26 Benchmark
    oldMultiplierPence: Math.round(oldMultiplier * 1000) / 10,
    oldNetBill: Math.round(oldNetBill * 100) / 100,
    savingsVsOld: Math.round(savingsVsOld * 100) / 100,
    percentChange: Math.round(percentChange * 10) / 10
  };
}
