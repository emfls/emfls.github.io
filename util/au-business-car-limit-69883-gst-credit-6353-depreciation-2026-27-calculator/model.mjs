// 2026–27 Australian Taxation Office (ATO) Statutory Car Cost Limit & GST Input Tax Credit Parameters (Effective 1 July 2026)
export const ATO_CAR_LIMIT_2026_27 = 69883; // Indexed ATO car depreciation limit for 2026–27 (up from $69,674)
export const ATO_MAX_GST_CREDIT_2026_27 = 6353; // 1/11th of $69,883 (up from $6,334)
export const INSTANT_ASSET_WRITE_OFF_THRESHOLD = 20000; // Small business immediate deduction (< $20,000 net)
export const SIMPLIFIED_POOL_Y1_RATE = 0.15; // 15% Year 1 deduction
export const SIMPLIFIED_POOL_SUBSEQUENT_RATE = 0.30; // 30% diminishing value in subsequent years

export function calcAuCarLimit(inputs = {}) {
  const {
    purchasePrice = 85000,
    vehicleType = "passenger", // 'passenger' (car/suv <1t) or 'commercial' (dual-cab ute >=1t payload)
    businessUsePercent = 80,
    isGstRegistered = true,
    entityTaxRate = 25 // 25% base rate company, 30% standard, 32%, 39%, 47% marginal
  } = inputs;

  const validPrice = Math.max(0, Number(purchasePrice) || 0);
  const busPct = Math.max(0, Math.min(100, Number(businessUsePercent) || 0)) / 100;
  const taxRate = Math.max(0, Number(entityTaxRate) || 0) / 100;
  const isPassenger = (vehicleType === "passenger");

  // 1. GST Input Tax Credit
  const rawGstInPrice = validPrice / 11;
  let maxAllowableGst = 0;
  let lostGstCredit = 0;

  if (isGstRegistered) {
    if (isPassenger) {
      maxAllowableGst = Math.min(rawGstInPrice, ATO_MAX_GST_CREDIT_2026_27) * busPct;
      lostGstCredit = Math.max(0, rawGstInPrice - ATO_MAX_GST_CREDIT_2026_27) * busPct;
    } else {
      // Commercial vehicles (>= 1,000 kg carrying capacity) are NOT subject to car limit!
      maxAllowableGst = rawGstInPrice * busPct;
      lostGstCredit = 0;
    }
  }

  // 2. Cost Base for Depreciation
  let effectiveCostBase = 0;
  let excessAboveCarLimit = 0;

  if (isPassenger) {
    const netPrice = isGstRegistered ? (validPrice - Math.min(rawGstInPrice, ATO_MAX_GST_CREDIT_2026_27)) : validPrice;
    effectiveCostBase = Math.min(ATO_CAR_LIMIT_2026_27, netPrice);
    if (validPrice > ATO_CAR_LIMIT_2026_27) {
      excessAboveCarLimit = validPrice - ATO_CAR_LIMIT_2026_27;
    }
  } else {
    // Commercial vehicle: 100% of purchase price (less GST if registered) is depreciable
    effectiveCostBase = isGstRegistered ? (validPrice - rawGstInPrice) : validPrice;
    excessAboveCarLimit = 0;
  }

  // 3. Instant Asset Write-Off vs Simplified Depreciation Pool
  const eligibleInstantWriteOff = (effectiveCostBase < INSTANT_ASSET_WRITE_OFF_THRESHOLD);

  // 5-Year Depreciation Schedule
  const schedule = [];
  let openingBalance = effectiveCostBase;
  let cumulativeDeprec = 0;

  for (let yr = 1; yr <= 5; yr++) {
    let yrDeprec = 0;
    if (eligibleInstantWriteOff && yr === 1) {
      yrDeprec = openingBalance * busPct;
      openingBalance = 0;
    } else if (!eligibleInstantWriteOff) {
      const rate = (yr === 1) ? SIMPLIFIED_POOL_Y1_RATE : SIMPLIFIED_POOL_SUBSEQUENT_RATE;
      yrDeprec = openingBalance * rate * busPct;
      openingBalance = Math.max(0, openingBalance - (openingBalance * rate));
    }
    cumulativeDeprec += yrDeprec;
    const yrTaxSaved = yrDeprec * taxRate;
    schedule.push({
      year: yr,
      depreciation: Math.round(yrDeprec * 100) / 100,
      cumulativeDepreciation: Math.round(cumulativeDeprec * 100) / 100,
      taxSaved: Math.round(yrTaxSaved * 100) / 100
    });
  }

  const total5YrDeprec = cumulativeDeprec;
  const total5YrIncomeTaxSaved = total5YrDeprec * taxRate;
  const total5YrNetBenefit = total5YrIncomeTaxSaved + maxAllowableGst;

  // Comparison: Commercial Ute Exemption Advantage
  let commercialTaxAdvantage = 0;
  if (isPassenger && validPrice > ATO_CAR_LIMIT_2026_27) {
    const commNetCost = isGstRegistered ? (validPrice - rawGstInPrice) : validPrice;
    const commDeprecY1 = commNetCost * SIMPLIFIED_POOL_Y1_RATE * busPct;
    const passDeprecY1 = effectiveCostBase * SIMPLIFIED_POOL_Y1_RATE * busPct;
    commercialTaxAdvantage = (lostGstCredit) + ((commDeprecY1 - passDeprecY1) * taxRate);
  }

  return {
    purchasePrice: validPrice,
    vehicleType,
    isPassenger,
    businessUsePercent: busPct * 100,
    isGstRegistered,
    entityTaxRate: taxRate * 100,
    atoCarLimit: ATO_CAR_LIMIT_2026_27,
    atoMaxGstCredit: ATO_MAX_GST_CREDIT_2026_27,
    maxAllowableGst: Math.round(maxAllowableGst * 100) / 100,
    lostGstCredit: Math.round(lostGstCredit * 100) / 100,
    effectiveCostBase: Math.round(effectiveCostBase * 100) / 100,
    excessAboveCarLimit: Math.round(excessAboveCarLimit * 100) / 100,
    eligibleInstantWriteOff,
    schedule,
    total5YrDeprec: Math.round(total5YrDeprec * 100) / 100,
    total5YrIncomeTaxSaved: Math.round(total5YrIncomeTaxSaved * 100) / 100,
    total5YrNetBenefit: Math.round(total5YrNetBenefit * 100) / 100,
    commercialTaxAdvantage: Math.round(commercialTaxAdvantage * 100) / 100
  };
}
