export const RULES = Object.freeze({
  bonusRate: 1,
  buildingYears: Object.freeze({ residential: 27.5, commercial: 39 }),
  passiveMaximum: 25000,
  passivePhaseoutStart: 100000,
  passivePhaseoutEnd: 150000,
  strDays: 7,
  repsHours: 750,
  repsTimePct: 50,
  ordinaryLossThreshold: Object.freeze({ single: 256000, mfj: 512000 }),
});

export function passiveAllowance(magi) {
  return Math.max(0, RULES.passiveMaximum - Math.max(0, magi - RULES.passivePhaseoutStart) / 2);
}

function checkRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} is outside the supported range.`);
  }
}

export function calculate(input) {
  const {
    purchasePrice, closingCosts, landPct, month, building, eligible, fivePct, sevenPct,
    fifteenPct, rentalNet, passiveIncome, magi, rate, fee, filing, activity, active,
    material, averageStay, repsHours, repsTime, otherBusinessNet,
  } = input;

  for (const [value, label] of [[purchasePrice, 'Purchase price'], [closingCosts, 'Closing costs'],
    [passiveIncome, 'Other passive income'], [fee, 'Study fee']]) {
    checkRange(value, 0, 1e12, label);
  }
  for (const [value, label] of [[rentalNet, 'Rental result'], [magi, 'MAGI'], [otherBusinessNet, 'Other business result']]) {
    checkRange(value, -1e12, 1e12, label);
  }
  for (const [value, label] of [[landPct, 'Land share'], [fivePct, '5-year share'],
    [sevenPct, '7-year share'], [fifteenPct, '15-year share'], [rate, 'Marginal rate']]) {
    checkRange(value, 0, 100, label);
  }
  if (fivePct + sevenPct + fifteenPct > 100) throw new RangeError('The 5-, 7-, and 15-year shares must total 100% or less.');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('Choose a valid service month.');
  if (!Object.hasOwn(RULES.buildingYears, building) || !Object.hasOwn(RULES.ordinaryLossThreshold, filing)
      || !['rental', 'str', 'reps'].includes(activity)) {
    throw new RangeError('Choose a supported building type, filing status, and activity.');
  }
  if (activity === 'str') checkRange(averageStay, 0.01, 366, 'Average guest stay');
  if (activity === 'reps') {
    checkRange(repsHours, 0, 8784, 'Qualifying real property hours');
    checkRange(repsTime, 0, 100, 'Qualifying real property share of service time');
  }

  const strException = activity === 'str' && averageStay <= RULES.strDays;
  const qualifiedReps = activity === 'reps' && repsHours > RULES.repsHours && repsTime > RULES.repsTimePct;
  const nonpassive = (strException || qualifiedReps) && material === true;
  const allowance = !strException && !nonpassive && active === true ? passiveAllowance(magi) : 0;
  const businessCapacity = Math.max(0, RULES.ordinaryLossThreshold[filing] + otherBusinessNet);
  const years = RULES.buildingYears[building];
  const basis = (purchasePrice + closingCosts) * (1 - landPct / 100);
  const yearFraction = (12.5 - month) / 12;
  const reclassPct = fivePct + sevenPct + fifteenPct;
  const allocations = {
    five: basis * fivePct / 100,
    seven: basis * sevenPct / 100,
    fifteen: basis * fifteenPct / 100,
    structural: basis * (1 - reclassPct / 100),
  };

  function scenario(structuralBasis, bonus) {
    const structural = structuralBasis / years * yearFraction;
    const depreciation = structural + bonus;
    const rentalShelter = Math.min(Math.max(0, rentalNet), depreciation);
    const loss = Math.max(0, depreciation - rentalNet);
    const passiveOffset = nonpassive ? 0 : Math.min(loss, passiveIncome);
    const ordinaryOffset = Math.min(loss - passiveOffset, nonpassive ? businessCapacity : allowance);
    const unused = Math.max(0, loss - passiveOffset - ordinaryOffset);
    return {
      structural, bonus, depreciation, rentalShelter, loss, passiveOffset, ordinaryOffset,
      ordinaryTaxSavings: ordinaryOffset * rate / 100,
      suspended: nonpassive ? 0 : unused,
      eblDeferred: nonpassive ? unused : 0,
    };
  }

  const standard = scenario(basis, 0);
  const accelerated = eligible === true
    ? scenario(allocations.structural, basis * reclassPct / 100 * RULES.bonusRate)
    : null;
  // Compare both scenarios at one marginal rate, including tax avoided on rental profit.
  const usable = ({ rentalShelter, passiveOffset, ordinaryOffset }) => rentalShelter + passiveOffset + ordinaryOffset;
  const grossSavings = accelerated ? (usable(accelerated) - usable(standard)) * rate / 100 : null;
  const netSavings = accelerated ? grossSavings - fee : null;
  const roiPct = accelerated && fee > 0 ? netSavings / fee * 100 : null;

  return {
    years, basis, yearFraction, allocations, reclassPct, strException, qualifiedReps, nonpassive,
    allowance, businessCapacity, standard, accelerated, grossSavings, netSavings, roiPct,
  };
}
