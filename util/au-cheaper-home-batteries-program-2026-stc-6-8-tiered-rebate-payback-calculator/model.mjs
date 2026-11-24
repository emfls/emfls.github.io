// Clean Energy Regulator (CER) & energy.gov.au Cheaper Home Batteries Program (May 1, 2026)
// Tiered Subsidized Usable Capacity:
// - Tier 1: First 14 kWh -> 100% multiplier
// - Tier 2: 14 to 28 kWh -> 60% multiplier
// - Tier 3: 28 to 50 kWh -> 15% multiplier
// - Tier 4: Above 50 kWh -> 0% multiplier
//
// Deeming Factors:
// - May 1 to Dec 31, 2026: STC Factor = 6.8
// - Jan 1 to Jun 30, 2027: STC Factor = 5.7
// Default STC Market Price: $37.50 / certificate

export function calcTieredDeemedKwh(usableKwh) {
  if (usableKwh <= 0 || isNaN(usableKwh)) return 0;
  const t1 = Math.min(usableKwh, 14) * 1.0;
  const t2 = Math.max(0, Math.min(usableKwh - 14, 14)) * 0.6;
  const t3 = Math.max(0, Math.min(usableKwh - 28, 22)) * 0.15;
  return t1 + t2 + t3;
}

export function calcBatteryStcRebate(usableKwh, stcFactor = 6.8, stcPrice = 37.50) {
  const deemedKwh = calcTieredDeemedKwh(usableKwh);
  const stcCount = Math.round(deemedKwh * stcFactor);
  const rebateDollar = stcCount * stcPrice;
  return {
    deemedKwh,
    stcCount,
    rebateDollar,
    rebatePerUsableKwh: usableKwh > 0 ? rebateDollar / usableKwh : 0
  };
}

export function calcBatteryPayback(inputs) {
  const {
    batteryCapacityKwh = 13.5, // e.g. Tesla Powerwall 3 / Sungrow 14
    grossInstalledCost = 12800,
    stateRebateDollar = 0, // e.g. NSW PDRS or QLD Battery Booster
    stcPrice = 37.50,
    dailyCycledKwh = 11.5, // usable cycle per day
    peakTariffKwh = 0.42,  // evening peak import price $/kWh
    feedInTariffKwh = 0.06, // solar export foregone $/kWh
    roundTripEfficiency = 0.90, // 90%
    electricityInflationRate = 0.035, // 3.5%/yr
    batteryDegradationRate = 0.015   // 1.5%/yr
  } = inputs;

  if (batteryCapacityKwh <= 0 || isNaN(batteryCapacityKwh)) throw new RangeError('Capacity must be positive');
  if (grossInstalledCost <= 0 || isNaN(grossInstalledCost)) throw new RangeError('Cost must be positive');

  // 2026 Rebate (6.8 Factor) vs 2027 Rebate (5.7 Factor)
  const rebate2026 = calcBatteryStcRebate(batteryCapacityKwh, 6.8, stcPrice);
  const rebate2027 = calcBatteryStcRebate(batteryCapacityKwh, 5.7, stcPrice);
  const waitingPenalty = rebate2026.rebateDollar - rebate2027.rebateDollar;

  // Net cost after 2026 federal rebate + state rebate
  const netInstalledCost = Math.max(0, grossInstalledCost - rebate2026.rebateDollar - stateRebateDollar);

  // Year 1 Daily Arbitrage Value:
  // Avoided peak import minus foregone feed-in tariff adjusted for round-trip efficiency
  // Value per kWh cycled = peakTariff - (feedInTariff / roundTripEfficiency)
  const netSavingsPerKwh = Math.max(0, peakTariffKwh - (feedInTariffKwh / roundTripEfficiency));
  const year1AnnualSavings = dailyCycledKwh * netSavingsPerKwh * 365;

  const simplePaybackYears = year1AnnualSavings > 0 ? netInstalledCost / year1AnnualSavings : Infinity;

  // 10-Year Cash Flow Projection
  let cumulativeSavings = 0;
  const yearlyBreakdown = [];
  let breakEvenYear = null;

  for (let y = 1; y <= 10; y++) {
    const degradedDailyCycle = dailyCycledKwh * Math.pow(1 - batteryDegradationRate, y - 1);
    const inflatedPeak = peakTariffKwh * Math.pow(1 + electricityInflationRate, y - 1);
    const inflatedFiT = feedInTariffKwh * Math.pow(1 + electricityInflationRate * 0.5, y - 1);
    const yearNetKwhValue = Math.max(0, inflatedPeak - (inflatedFiT / roundTripEfficiency));
    const annualSavings = degradedDailyCycle * yearNetKwhValue * 365;

    cumulativeSavings += annualSavings;
    const netPosition = cumulativeSavings - netInstalledCost;

    if (netPosition >= 0 && breakEvenYear === null) {
      // Linear interpolation for exact break-even
      const priorNet = cumulativeSavings - annualSavings - netInstalledCost;
      const fraction = Math.abs(priorNet) / annualSavings;
      breakEvenYear = (y - 1) + fraction;
    }

    yearlyBreakdown.push({
      year: y,
      annualSavings: Math.round(annualSavings),
      cumulativeSavings: Math.round(cumulativeSavings),
      netPosition: Math.round(netPosition)
    });
  }

  const tenYearNetProfit = cumulativeSavings - netInstalledCost;
  const tenYearRoiPct = netInstalledCost > 0 ? (tenYearNetProfit / netInstalledCost) * 100 : 0;

  return {
    batteryCapacityKwh,
    grossInstalledCost,
    rebate2026,
    rebate2027,
    waitingPenalty: Math.round(waitingPenalty),
    netInstalledCost: Math.round(netInstalledCost),
    year1AnnualSavings: Math.round(year1AnnualSavings),
    simplePaybackYears: parseFloat(simplePaybackYears.toFixed(1)),
    exactBreakEvenYears: breakEvenYear ? parseFloat(breakEvenYear.toFixed(1)) : null,
    tenYearCumulativeSavings: Math.round(cumulativeSavings),
    tenYearNetProfit: Math.round(tenYearNetProfit),
    tenYearRoiPct: Math.round(tenYearRoiPct),
    yearlyBreakdown
  };
}
