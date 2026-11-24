export const NIL_RATE_BAND = 325_000;
export const LIFETIME_RATE = 0.20;
export const ANNIVERSARY_FACTOR = 0.30;
export const MAX_ANNIVERSARY_RATE = LIFETIME_RATE * ANNIVERSARY_FACTOR;
export const DEATH_RATE = 0.40;
export const CYCLE_QUARTERS = 40;

function amount(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite, non-negative number`);
  }
  return value;
}

function quarters(value, maximum) {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new RangeError(`Completed quarters must be a whole number from 0 to ${maximum}`);
  }
  return value;
}

export function calculateEntryCharge({
  initialTrustTransfer, prior7YrCLTs = 0, settlorPays = false,
}) {
  amount(initialTrustTransfer, 'Initial transfer');
  const availableEntryNRB = Math.max(0, NIL_RATE_BAND - amount(prior7YrCLTs, 'Prior transfers'));
  const chargeableEntry = Math.max(0, initialTrustTransfer - availableEntryNRB);
  const entryRate = settlorPays ? LIFETIME_RATE / (1 - LIFETIME_RATE) : LIFETIME_RATE;
  return { availableEntryNRB, chargeableEntry, entryRate, entryCharge: chargeableEntry * entryRate };
}

export function calculatePeriodicCharge({
  trustValueAtAnniversary,
  prior7YrCLTsBeforeSettlement = 0,
  capitalDistributionsLast10Yrs = 0,
  quartersAsRelevantProperty = CYCLE_QUARTERS,
}) {
  amount(trustValueAtAnniversary, 'Anniversary value');
  amount(prior7YrCLTsBeforeSettlement, 'Prior transfers');
  amount(capitalDistributionsLast10Yrs, 'Prior chargeable exits');
  const fraction = quarters(quartersAsRelevantProperty, CYCLE_QUARTERS) / CYCLE_QUARTERS;
  const hypotheticalNRB = Math.max(0, NIL_RATE_BAND - prior7YrCLTsBeforeSettlement - capitalDistributionsLast10Yrs);
  const chargeableAt10Yr = Math.max(0, trustValueAtAnniversary - hypotheticalNRB);
  const notionalTax20Pct = chargeableAt10Yr * LIFETIME_RATE;
  const effectiveRate = trustValueAtAnniversary > 0 ? notionalTax20Pct / trustValueAtAnniversary : 0;
  const actualPeriodicRate = Math.min(MAX_ANNIVERSARY_RATE, effectiveRate * ANNIVERSARY_FACTOR);
  const payablePeriodicRate = actualPeriodicRate * fraction;
  const periodicCharge = trustValueAtAnniversary * payablePeriodicRate;
  return { hypotheticalNRB, chargeableAt10Yr, notionalTax20Pct, effectiveRate,
    actualPeriodicRate, payablePeriodicRate, periodicCharge };
}

// Section 68 uses historic settled value. For a single initial addition, the
// rate calculation shares the same lifetime-rate computation as section 66.
export function calculateFirstCycleExitBaseRate(historicSettledValue, prior7YrCLTs = 0) {
  return calculatePeriodicCharge({
    trustValueAtAnniversary: historicSettledValue,
    prior7YrCLTsBeforeSettlement: prior7YrCLTs,
  }).actualPeriodicRate;
}

export function calculateExitCharge({
  capitalDistributed, baseRate, completedQuarters, trusteesPayFromRemaining = false,
}) {
  amount(capitalDistributed, 'Distribution');
  if (!Number.isFinite(baseRate) || baseRate < 0 || baseRate > MAX_ANNIVERSARY_RATE) {
    throw new RangeError('Exit base rate must be between 0% and 6%');
  }
  const exitRate = baseRate * (quarters(completedQuarters, CYCLE_QUARTERS - 1) / CYCLE_QUARTERS);
  const taxPerPound = trusteesPayFromRemaining ? exitRate / (1 - exitRate) : exitRate;
  return { exitRate, exitCharge: capitalDistributed * taxPerPound };
}

export function compareThirtyYears({
  initialTrustTransfer, prior7YrCLTs = 0, settlorPays = false, annualGrowthRate = 0,
}) {
  if (!Number.isFinite(annualGrowthRate) || annualGrowthRate < -1) {
    throw new RangeError('Annual growth must be finite and at least −100%');
  }
  const { entryCharge } = calculateEntryCharge({ initialTrustTransfer, prior7YrCLTs, settlorPays });
  const startingBudget = settlorPays ? initialTrustTransfer + entryCharge : initialTrustTransfer;
  const growthPerDecade = (1 + annualGrowthRate) ** 10;
  if (!Number.isFinite(startingBudget * growthPerDecade ** 3)) {
    throw new RangeError('The projection exceeds the supported range');
  }
  let trustNet = settlorPays ? initialTrustTransfer : initialTrustTransfer - entryCharge;
  const anniversaries = [10, 20, 30].map(year => {
    const grossValue = trustNet * growthPerDecade;
    const { periodicCharge } = calculatePeriodicCharge({
      trustValueAtAnniversary: grossValue,
      prior7YrCLTsBeforeSettlement: prior7YrCLTs,
    });
    trustNet = grossValue - periodicCharge;
    return { year, grossValue, tax: periodicCharge, netValue: trustNet };
  });

  const trustTax = entryCharge + anniversaries.reduce((total, row) => total + row.tax, 0);
  const estateGross = startingBudget * growthPerDecade ** 3;
  const estateTax = Math.max(0, estateGross - NIL_RATE_BAND) * DEATH_RATE;
  const estateNet = estateGross - estateTax;
  return { startingBudget, entryCharge, anniversaries, trustTax, trustNet, estateGross, estateTax,
    estateNet, trustDrag: estateGross - trustNet, netDifference: trustNet - estateNet };
}
