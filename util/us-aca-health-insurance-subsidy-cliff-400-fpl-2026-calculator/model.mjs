const povertyGuidelines = {
  contiguous: [15650, 5500],
  alaska: [19550, 6880],
  hawaii: [17990, 6330],
};

export function federalPovertyLevel(householdSize, region) {
  if (!Number.isInteger(householdSize) || householdSize < 1 || householdSize > 100 ||
      !Object.hasOwn(povertyGuidelines, region)) {
    throw new RangeError('Enter a household size from 1 to 100 and select a region.');
  }
  const [firstPerson, additionalPerson] = povertyGuidelines[region];
  return firstPerson + (householdSize - 1) * additionalPerson;
}

export function applicableRate(fplPercent) {
  if (!Number.isFinite(fplPercent) || fplPercent < 0) {
    throw new RangeError('FPL percentage must be finite and nonnegative.');
  }
  if (fplPercent > 400) return null;
  if (fplPercent < 133) return 0.021;
  for (const [low, high, start, end] of [
    [133, 150, 0.0314, 0.0419],
    [150, 200, 0.0419, 0.066],
    [200, 250, 0.066, 0.0844],
    [250, 300, 0.0844, 0.0996],
  ]) {
    if (fplPercent < high) return start + (end - start) * (fplPercent - low) / (high - low);
  }
  return 0.0996;
}

function moneyInCents(value) {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || value > 1e9 || cents / 100 !== value) {
    throw new RangeError('Enter dollar amounts from 0 to 1 billion with at most two decimal places.');
  }
  return cents;
}

export function calculateAcaCliff({
  householdSize,
  region,
  magi,
  annualBenchmarkPremium,
  availableContribution,
  marginalTaxRatePercent = 0,
}) {
  const fpl = federalPovertyLevel(householdSize, region);
  const magiCents = moneyInCents(magi);
  const premiumCents = moneyInCents(annualBenchmarkPremium);
  const availableCents = moneyInCents(availableContribution);
  if (!Number.isFinite(marginalTaxRatePercent) || marginalTaxRatePercent < 0 || marginalTaxRatePercent > 100) {
    throw new RangeError('Enter an income-tax rate from 0% to 100%.');
  }

  const cliff = 4 * fpl;
  const rescueTarget = cliff - 1;
  const fplPercent = magiCents / fpl;
  const rate = applicableRate(fplPercent);
  const aboveCliff = magiCents > cliff * 100;
  const belowFpl = magiCents < fpl * 100;
  const annualPtcCents = aboveCliff || belowFpl
    ? 0
    : Math.max(0, premiumCents - Math.round(magiCents * rate));
  const cliffLossCents = Math.max(0, premiumCents - Math.round(cliff * 100 * 0.0996));
  const minimumCents = Math.max(0, magiCents - cliff * 100);
  const bufferedCents = Math.max(0, magiCents - rescueTarget * 100);
  const rescuePtcCents = aboveCliff
    ? Math.max(0, premiumCents - Math.round(rescueTarget * 100 * 0.0996))
    : null;
  const taxSavingsCents = aboveCliff ? Math.round(bufferedCents * marginalTaxRatePercent / 100) : null;

  return {
    fpl,
    cliff,
    rescueTarget,
    fplPercent,
    applicableRate: rate,
    aboveCliff,
    belowFpl,
    annualPtc: annualPtcCents / 100,
    netMonthlyPremium: Math.round((premiumCents - annualPtcCents) / 12) / 100,
    cliffLoss: cliffLossCents / 100,
    minimumContribution: minimumCents / 100,
    bufferedContribution: bufferedCents / 100,
    minimumShortfall: Math.max(0, minimumCents - availableCents) / 100,
    bufferedShortfall: Math.max(0, bufferedCents - availableCents) / 100,
    rescuePtc: rescuePtcCents === null ? null : rescuePtcCents / 100,
    taxSavings: taxSavingsCents === null ? null : taxSavingsCents / 100,
    effectiveReturnPercent: rescuePtcCents > 0
      ? (rescuePtcCents + taxSavingsCents) / bufferedCents * 100
      : null,
  };
}
