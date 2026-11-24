export const FUND_STEP_UP = Object.freeze({
  standard_qof_10pct: 0.10,
  rural_qrof_30pct: 0.30,
});

function inRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function cashFlowIrr(initialOutlay, deferredTax, inclusionYear, proceeds, years) {
  if (inclusionYear === years) {
    proceeds -= deferredTax;
    deferredTax = 0;
  }
  if (proceeds <= 0) return null;
  if (deferredTax === 0) return (proceeds / initialOutlay) ** (1 / years) - 1;

  // The future value of these two outlays is strictly increasing in the IRR factor.
  let low = 0;
  let high = Math.max(1, (proceeds / initialOutlay) ** (1 / years));
  for (let iteration = 0; iteration < 72; iteration++) {
    const factor = (low + high) / 2;
    const futureOutlays = initialOutlay * factor ** years
      + deferredTax * factor ** (years - inclusionYear);
    if (futureOutlays > proceeds) high = factor;
    else low = factor;
  }
  return (low + high) / 2 - 1;
}

export function calculateQoz({ gain, fundType, years, growthPct, ltcgPct, niit, statePct, stateConforms }) {
  if (!inRange(gain, 0.01, 1e9)) throw new RangeError('Enter a realized gain from $0.01 to $1 billion.');
  if (!Object.hasOwn(FUND_STEP_UP, fundType)) throw new RangeError('Select a valid fund type.');
  if (!Number.isInteger(years) || !inRange(years, 1, 20)) throw new RangeError('Enter a whole holding period from 1 to 20 years.');
  if (!inRange(growthPct, -100, 100)) throw new RangeError('Enter annual growth from −100% to 100%.');
  if (![15, 20].includes(ltcgPct)) throw new RangeError('Select a 15% or 20% federal LTCG rate.');
  if (typeof niit !== 'boolean') throw new RangeError('Select whether NIIT applies.');
  if (!inRange(statePct, 0, 50)) throw new RangeError('Enter a state tax rate from 0% to 50%.');
  if (typeof stateConforms !== 'boolean') throw new RangeError('Select whether the state follows federal QOZ treatment.');

  const federalRate = (ltcgPct + (niit ? 3.8 : 0)) / 100;
  const stateRate = statePct / 100;
  const growthFactor = 1 + growthPct / 100;
  const exitGrowth = growthFactor ** years;
  const upfrontTax = gain * (federalRate + stateRate);
  const invested = gain - upfrontTax;
  const taxableExitValue = invested * exitGrowth;
  const taxableExitTax = Math.max(0, taxableExitValue - invested) * (federalRate + stateRate);
  const taxableProceeds = taxableExitValue - taxableExitTax;
  const taxable = {
    upfrontTax,
    invested,
    exitValue: taxableExitValue,
    exitTax: taxableExitTax,
    netWealth: taxableProceeds,
    irr: cashFlowIrr(gain, 0, years, taxableProceeds, years),
  };

  const inclusionYear = Math.min(years, 5);
  const inclusionValue = gain * growthFactor ** inclusionYear;
  const exitValue = gain * exitGrowth;
  const excluded = years >= 10;
  const stateUpfrontTax = stateConforms ? 0 : gain * stateRate;

  const funds = {};
  for (const [type, stepUp] of Object.entries(FUND_STEP_UP)) {
    const basisStepUp = years >= 5 ? gain * stepUp : 0;
    const recognizedGain = Math.max(0, Math.min(gain, inclusionValue) - basisStepUp);
    const federalDeferredTax = recognizedGain * federalRate;
    const stateDeferredTax = stateConforms ? recognizedGain * stateRate : 0;
    const deferredTax = federalDeferredTax + stateDeferredTax;
    const federalBasis = basisStepUp + recognizedGain;
    const federalExitGain = Math.max(0, exitValue - federalBasis);
    const federalExitTax = excluded ? 0 : federalExitGain * federalRate;
    const stateExitTax = stateConforms
      ? (excluded ? 0 : federalExitGain * stateRate)
      : Math.max(0, exitValue - gain) * stateRate;
    const exitTax = federalExitTax + stateExitTax;
    const exitProceeds = exitValue - exitTax;

    // Taxes paid from outside the fund have an opportunity cost through exit.
    const netWealth = exitProceeds
      - stateUpfrontTax * exitGrowth
      - deferredTax * growthFactor ** (years - inclusionYear);
    const irr = cashFlowIrr(gain + stateUpfrontTax, deferredTax, inclusionYear, exitProceeds, years);

    funds[type] = {
      upfrontTax: stateUpfrontTax,
      invested: gain,
      inclusionYear,
      inclusionValue,
      basisStepUp,
      recognizedGain,
      federalDeferredTax,
      stateDeferredTax,
      deferredTax,
      exitValue,
      federalExitTax,
      stateExitTax,
      exitTax,
      federalAppreciationTaxSaved: excluded ? federalExitGain * federalRate : 0,
      exitProceeds,
      netWealth,
      irr,
      dollarAdvantage: netWealth - taxable.netWealth,
      irrLift: irr === null || taxable.irr === null ? null : irr - taxable.irr,
    };
  }

  return { taxable, funds, selected: funds[fundType] };
}
