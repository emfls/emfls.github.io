// 2026 US Commercial Trucking Insurance & FMCSA 49 CFR Part 387 Statutory Liability Regulations
export const FMCSA_LIABILITY_MINIMUMS = {
  "general": { code: "general", label: "General Freight (>10,001 lbs)", fmcsaMin: 750000, marketStandard: 1000000, baseNewAuth: 14500, baseEst: 7200 },
  "oil": { code: "oil", label: "Oil & Moderate Hazard (>10,001 lbs)", fmcsaMin: 1000000, marketStandard: 1000000, baseNewAuth: 18500, baseEst: 9500 },
  "hazmat": { code: "hazmat", label: "High-Hazard Materials & Explosives", fmcsaMin: 5000000, marketStandard: 5000000, baseNewAuth: 26000, baseEst: 14500 }
};

export const RADIUS_MULTIPLIERS = {
  "local": 0.85,    // < 100 miles
  "regional": 1.00, // 100 - 500 miles
  "otr": 1.25       // 500+ miles (Over-the-Road Long Haul)
};

export const CARGO_LIMIT_COSTS = {
  "100k": 1200, // $100,000 standard broker freight contract
  "250k": 2400, // $250,000 high-value cargo
  "500k": 4200  // $500,000 specialized / electronics
};

export function calcTruckingInsurance(inputs = {}) {
  const {
    cargoType = "general",
    fleetSize = 1,
    isNewAuthority = false, // true: < 2 yrs operating authority, false: 2+ yrs established
    operatingRadius = "regional",
    tractorTrailerValue = 120000, // stated value for physical damage
    hasPhysicalDamage = true,
    cargoLimit = "100k",
    hasBobtail = true,
    annualMilesPerTruck = 100000
  } = inputs;

  const validFleet = Math.max(1, parseInt(fleetSize, 10) || 1);
  const validValue = Math.max(0, Number(tractorTrailerValue) || 0);
  const validMiles = Math.max(10000, Number(annualMilesPerTruck) || 100000);
  const cargoInfo = FMCSA_LIABILITY_MINIMUMS[cargoType] || FMCSA_LIABILITY_MINIMUMS["general"];
  const radiusMult = RADIUS_MULTIPLIERS[operatingRadius] || 1.00;

  // 1. Primary Auto Liability (FMCSA Statutory Coverage)
  const baseRatePerTruck = isNewAuthority ? cargoInfo.baseNewAuth : cargoInfo.baseEst;
  const primaryLiabilityPerTruck = baseRatePerTruck * radiusMult;
  // Fleet discount factor: 1-2 trucks = 1.00, 3-5 = 0.95, 6-10 = 0.90, 11+ = 0.85
  let fleetDiscount = 1.00;
  if (validFleet >= 11) fleetDiscount = 0.85;
  else if (validFleet >= 6) fleetDiscount = 0.90;
  else if (validFleet >= 3) fleetDiscount = 0.95;

  const totalPrimaryLiability = primaryLiabilityPerTruck * validFleet * fleetDiscount;

  // 2. Physical Damage (Collision & Comprehensive): 3.5% of stated value per truck
  let totalPhysicalDamage = 0;
  if (hasPhysicalDamage && validValue > 0) {
    totalPhysicalDamage = (validValue * 0.035) * validFleet;
  }

  // 3. Motor Truck Cargo (MTC)
  const cargoCostPerTruck = CARGO_LIMIT_COSTS[cargoLimit] || 1200;
  const totalCargoInsurance = cargoCostPerTruck * validFleet;

  // 4. Bobtail / Non-Trucking Liability (NTL): $600/yr per truck
  const totalBobtail = hasBobtail ? (600 * validFleet) : 0;

  // Total Annual Insurance Premium
  const totalAnnualPremium = totalPrimaryLiability + totalPhysicalDamage + totalCargoInsurance + totalBobtail;
  const annualCostPerTruck = totalAnnualPremium / validFleet;
  const monthlyPremium = totalAnnualPremium / 12;

  // Cost-Per-Mile (CPM) Drag
  const totalFleetMiles = validFleet * validMiles;
  const costPerMile = totalFleetMiles > 0 ? (totalAnnualPremium / totalFleetMiles) : 0;

  // New Authority vs Established Savings Delta (Per truck)
  const estPrimaryPerTruck = cargoInfo.baseEst * radiusMult;
  const newAuthPremiumPerTruck = cargoInfo.baseNewAuth * radiusMult;
  const authorityExperienceSavingsPerTruck = Math.max(0, newAuthPremiumPerTruck - estPrimaryPerTruck);

  return {
    cargoType,
    fmcsaMin: cargoInfo.fmcsaMin,
    marketStandard: cargoInfo.marketStandard,
    fleetSize: validFleet,
    isNewAuthority,
    operatingRadius,
    radiusMultiplier: radiusMult,
    fleetDiscount,
    primaryLiabilityPerTruck: Math.round(primaryLiabilityPerTruck * 100) / 100,
    totalPrimaryLiability: Math.round(totalPrimaryLiability * 100) / 100,
    totalPhysicalDamage: Math.round(totalPhysicalDamage * 100) / 100,
    totalCargoInsurance: Math.round(totalCargoInsurance * 100) / 100,
    totalBobtail: Math.round(totalBobtail * 100) / 100,
    totalAnnualPremium: Math.round(totalAnnualPremium * 100) / 100,
    annualCostPerTruck: Math.round(annualCostPerTruck * 100) / 100,
    monthlyPremium: Math.round(monthlyPremium * 100) / 100,
    totalFleetMiles,
    costPerMile: Math.round(costPerMile * 1000) / 1000,
    authorityExperienceSavingsPerTruck: Math.round(authorityExperienceSavingsPerTruck * 100) / 100
  };
}
