// Canada Revenue Agency (CRA) ITA s. 54 Superficial Loss Rules & T+1 Settlement Parameters
export const CRA_TAX_LOSS_CONSTANTS_2026 = {
  lastTradeDate2026: '2026-12-30', // Wednesday, Dec 30, 2026 (T+1 settles Dec 31)
  settlementDate2026: '2026-12-31',
  safeRebuyDate2026: '2027-01-31', // 31 days after settlement
  inclusionRate: 0.50, // 50% inclusion rate
  provincialRates: {
    ON: 0.5353, // Ontario top marginal rate
    BC: 0.5350, // British Columbia top marginal rate
    QC: 0.5331, // Quebec top marginal rate
    AB: 0.4800, // Alberta top marginal rate
    OTHER: 0.5000
  }
};

export function calcSettlementAndRebuyDates(tradeDateStr = '2026-12-30') {
  const parts = tradeDateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  
  const tradeDate = new Date(Date.UTC(y, m, d));
  
  // T+1 settlement: next business day (skipping weekend)
  const settlementDate = new Date(tradeDate);
  let daysToAdd = 1;
  settlementDate.setUTCDate(settlementDate.getUTCDate() + daysToAdd);
  if (settlementDate.getUTCDay() === 6) { // Saturday -> Monday (+2)
    settlementDate.setUTCDate(settlementDate.getUTCDate() + 2);
  } else if (settlementDate.getUTCDay() === 0) { // Sunday -> Monday (+1)
    settlementDate.setUTCDate(settlementDate.getUTCDate() + 1);
  }

  // Safe rebuy date: exactly 31 calendar days after settlement
  const safeRebuyDate = new Date(settlementDate);
  safeRebuyDate.setUTCDate(safeRebuyDate.getUTCDate() + 31);

  const qualifiesFor2026TaxYear = settlementDate.getUTCFullYear() === 2026;

  const formatDate = (dt) => dt.toISOString().split('T')[0];

  return {
    tradeDate: tradeDateStr,
    settlementDate: formatDate(settlementDate),
    safeRebuyDate: formatDate(safeRebuyDate),
    qualifiesFor2026TaxYear
  };
}

export function calcTaxLossSelling(inputs) {
  const {
    unrealizedLoss = 20000, // ACB - Current Market Value
    current2026Gains = 8000, // 2026 capital gains already realized
    priorGains2025 = 5000,
    priorGains2024 = 4000,
    priorGains2023 = 2000,
    province = 'ON',
    marginalTaxRate = 0.5353,
    tradeDate = '2026-12-30',
    isSuperficialViolation = false,
    isRegisteredAccountTrap = false // repurchased in TFSA/RRSP
  } = inputs;

  if (unrealizedLoss <= 0 || isNaN(unrealizedLoss)) throw new RangeError('Unrealized loss must be positive');
  if (current2026Gains < 0 || isNaN(current2026Gains)) throw new RangeError('Current gains must be non-negative');

  const dates = calcSettlementAndRebuyDates(tradeDate);
  const effectiveTaxRate = marginalTaxRate || (CRA_TAX_LOSS_CONSTANTS_2026.provincialRates[province] || 0.50);

  // If trade date settles in 2027, loss cannot be claimed on 2026 tax return!
  if (!dates.qualifiesFor2026TaxYear) {
    return {
      dates,
      disallowedReason: 'MISSED_DEADLINE_SETTLES_2027',
      realizedLoss: unrealizedLoss,
      allowableCapitalLoss: 0,
      offset2026Gains: 0,
      t1aCarrybackTotal: 0,
      immediateTaxSavings: 0,
      t1aRefund: 0,
      totalTaxCashRecovery: 0,
      remainingLossCarryforward: 0,
      isPermanentDestruction: false
    };
  }

  // Superficial loss violation check
  if (isSuperficialViolation) {
    return {
      dates,
      disallowedReason: isRegisteredAccountTrap ? 'PERMANENT_REGISTERED_DESTRUCTION' : 'SUPERFICIAL_LOSS_DENIED',
      realizedLoss: unrealizedLoss,
      allowableCapitalLoss: 0,
      offset2026Gains: 0,
      t1aCarrybackTotal: 0,
      immediateTaxSavings: 0,
      t1aRefund: 0,
      totalTaxCashRecovery: 0,
      remainingLossCarryforward: 0,
      isPermanentDestruction: isRegisteredAccountTrap
    };
  }

  // 1. Allowable Capital Loss (50% Inclusion Rate)
  const allowableCapitalLoss = unrealizedLoss * CRA_TAX_LOSS_CONSTANTS_2026.inclusionRate;

  // 2. Offset against current 2026 capital gains
  // Taxable capital gain in 2026
  const taxable2026Gains = current2026Gains * CRA_TAX_LOSS_CONSTANTS_2026.inclusionRate;
  const offset2026 = Math.min(allowableCapitalLoss, taxable2026Gains);
  const immediateTaxSavings2026 = offset2026 * effectiveTaxRate;

  // Remaining allowable loss available for Form T1A carryback
  let remainingAcl = allowableCapitalLoss - offset2026;

  // 3. Form T1A 3-Year Carryback (2025, 2024, 2023)
  const taxable2025 = priorGains2025 * CRA_TAX_LOSS_CONSTANTS_2026.inclusionRate;
  const carryback2025 = Math.min(remainingAcl, taxable2025);
  remainingAcl -= carryback2025;

  const taxable2024 = priorGains2024 * CRA_TAX_LOSS_CONSTANTS_2026.inclusionRate;
  const carryback2024 = Math.min(remainingAcl, taxable2024);
  remainingAcl -= carryback2024;

  const taxable2023 = priorGains2023 * CRA_TAX_LOSS_CONSTANTS_2026.inclusionRate;
  const carryback2023 = Math.min(remainingAcl, taxable2023);
  remainingAcl -= carryback2023;

  const totalT1aCarryback = carryback2025 + carryback2024 + carryback2023;
  const t1aTaxRefund = totalT1aCarryback * effectiveTaxRate;

  // 4. Total Immediate Cash Recovery
  const totalTaxCashRecovery = immediateTaxSavings2026 + t1aTaxRefund;

  return {
    dates,
    disallowedReason: null,
    realizedLoss: unrealizedLoss,
    allowableCapitalLoss: Math.round(allowableCapitalLoss * 100) / 100,
    offset2026Gains: Math.round(offset2026 * 100) / 100,
    immediateTaxSavings: Math.round(immediateTaxSavings2026 * 100) / 100,
    t1aCarryback: {
      year2025: Math.round(carryback2025 * 100) / 100,
      year2024: Math.round(carryback2024 * 100) / 100,
      year2023: Math.round(carryback2023 * 100) / 100,
      totalCarryback: Math.round(totalT1aCarryback * 100) / 100,
      t1aTaxRefund: Math.round(t1aTaxRefund * 100) / 100
    },
    totalTaxCashRecovery: Math.round(totalTaxCashRecovery * 100) / 100,
    remainingLossCarryforward: Math.round(remainingAcl * 100) / 100,
    isPermanentDestruction: false
  };
}
