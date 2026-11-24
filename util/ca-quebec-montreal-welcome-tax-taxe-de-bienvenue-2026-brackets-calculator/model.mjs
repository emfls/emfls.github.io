// Brackets are [upper limit in CAD, marginal rate in basis points].
const MONTREAL = [
  [62_900, 50], [315_000, 100], [552_300, 150], [1_104_700, 200],
  [2_136_500, 250], [3_113_000, 350], [Infinity, 400],
];
const ONTARIO_LOWER = [[55_000, 50], [250_000, 100], [400_000, 150]];
const ONTARIO_OTHER = [...ONTARIO_LOWER, [Infinity, 200]];
const ONTARIO_HOMES = [...ONTARIO_LOWER, [2_000_000, 200], [Infinity, 250]];
const TORONTO_LOWER = [...ONTARIO_LOWER, [2_000_000, 200], [3_000_000, 250]];
const TORONTO_EARLY = [
  ...TORONTO_LOWER, [4_000_000, 350], [5_000_000, 450],
  [10_000_000, 550], [20_000_000, 650], [Infinity, 750],
];
const TORONTO_LATE = [
  ...TORONTO_LOWER, [4_000_000, 440], [5_000_000, 545],
  [10_000_000, 650], [20_000_000, 755], [Infinity, 860],
];

function scaledInteger(value, scale, min, max, message) {
  const scaled = Math.round(value * scale);
  if (!Number.isFinite(value) || value < min || value > max || scaled / scale !== value) {
    throw new RangeError(message);
  }
  return scaled;
}

function moneyCents(value) {
  return scaledInteger(value, 100, 0, 1_000_000_000,
    'Enter a CAD amount from $0 to $1 billion, with up to two decimal places.');
}

// One million units per dollar preserves cents multiplied by a four-place factor.
const UNITS_PER_DOLLAR = 1_000_000n;
const UNITS_PER_CENT = 10_000n;
const DUTY_CENT_DIVISOR = UNITS_PER_CENT * 10_000n;
const dollars = units => Number(units) / Number(UNITS_PER_DOLLAR);
const roundedDutyCents = weighted => (weighted + DUTY_CENT_DIVISOR / 2n) / DUTY_CENT_DIVISOR;

function progressiveTax(baseUnits, brackets) {
  const slices = [];
  let lower = 0;
  let weighted = 0n;
  for (const [upper, basisPoints] of brackets) {
    const upperUnits = Number.isFinite(upper) ? BigInt(upper) * UNITS_PER_DOLLAR : baseUnits;
    const sliceUnits = (baseUnits < upperUnits ? baseUnits : upperUnits) - BigInt(lower) * UNITS_PER_DOLLAR;
    if (sliceUnits <= 0n) break;

    const before = roundedDutyCents(weighted);
    weighted += sliceUnits * BigInt(basisPoints);
    // Differences of rounded subtotals keep the displayed slices equal to the bill.
    slices.push({
      lower, upper, rate: basisPoints / 10_000, taxable: dollars(sliceUnits),
      duty: Number(roundedDutyCents(weighted) - before) / 100,
    });
    if (baseUnits <= upperUnits) break;
    lower = upper;
  }
  return { slices, grossCents: Number(roundedDutyCents(weighted)) };
}

function quebecEstimate(purchase, deed, assessment, factor, brackets, exempt) {
  const adjustedAssessment = BigInt(assessment) * BigInt(factor);
  const candidates = [
    ['Purchase price', BigInt(purchase) * UNITS_PER_CENT],
    ['Deed consideration', BigInt(deed) * UNITS_PER_CENT],
    ['Adjusted municipal assessment', adjustedAssessment],
  ];
  const baseUnits = candidates.reduce((highest, [, amount]) => amount > highest ? amount : highest, 0n);
  const taxBase = dollars(baseUnits);
  const { slices, grossCents } = progressiveTax(baseUnits, brackets);
  const payableCents = exempt ? 0 : grossCents;
  return {
    taxBase,
    baseSources: baseUnits ? candidates.filter(([, amount]) => amount === baseUnits).map(([name]) => name) : [],
    adjustedAssessment: dollars(adjustedAssessment),
    slices,
    grossDuty: grossCents / 100,
    duty: payableCents / 100,
    effectiveRate: taxBase ? payableCents / 100 / taxBase : 0,
  };
}

export function estimateHomeownershipCredit(taxBase, dutyPaid) {
  if (![taxBase, dutyPaid].every(value => Number.isFinite(value) && value >= 0)) {
    throw new RangeError('Enter a nonnegative tax base and duty paid.');
  }
  if (taxBase >= 1_000_000) return 0;
  const dutyCents = Math.round(Math.min(dutyPaid, 8500) * 100);
  const excessBaseUnits = BigInt(Math.max(0, Math.round(taxBase * 1_000_000) - 750_000_000_000));
  const initial = Math.min(dutyCents, 500_000) * 10_000
    + Math.min(Math.max(0, dutyCents - 500_000), 350_000) * 2500;
  const net = BigInt(initial) * UNITS_PER_CENT - excessBaseUnits * 235n;
  return net > 0n ? Number(roundedDutyCents(net)) / 100 : 0;
}

export function estimateWelcomeTax({
  purchasePriceExTax, deedConsideration = 0, municipalAssessment = 0,
  comparativeFactor = 1, localUpperRate = 1.5, jurisdiction = 'montreal',
  familyExemption = false, torontoPeriod = 'apr-dec', singleFamily = true,
}) {
  const purchase = moneyCents(purchasePriceExTax);
  const deed = moneyCents(deedConsideration);
  const assessment = moneyCents(municipalAssessment);
  const factor = scaledInteger(comparativeFactor, 10_000, 0.0001, 10,
    'Enter a local comparative factor greater than 0 and up to 10, with at most four decimal places.');
  const localBasisPoints = scaledInteger(localUpperRate, 100, 1.5, 3,
    'Enter 1.5% for the Québec baseline, or a local rate from 2% to 3%.');
  if (localBasisPoints > 150 && localBasisPoints < 200) {
    throw new RangeError('Enter 1.5% for the Québec baseline, or a local rate from 2% to 3%.');
  }
  if (!['montreal', 'quebec'].includes(jurisdiction) || !['jan-mar', 'apr-dec'].includes(torontoPeriod)
      || typeof familyExemption !== 'boolean' || typeof singleFamily !== 'boolean') {
    throw new RangeError('Choose a valid location, exemption status and comparison scenario.');
  }

  const quebecBrackets = [[62_900, 50], [315_000, 100], [Infinity, 150]];
  // The local rate applies only to the slice above $500,000.
  if (localBasisPoints > 150) quebecBrackets.splice(2, 1, [500_000, 150], [Infinity, localBasisPoints]);
  const montreal = quebecEstimate(purchase, deed, assessment, 10_000, MONTREAL, familyExemption);
  const quebec = quebecEstimate(purchase, deed, assessment, factor, quebecBrackets, familyExemption);
  const selected = jurisdiction === 'montreal' ? montreal : quebec;

  const consideration = BigInt(purchase) * UNITS_PER_CENT;
  const ontario = progressiveTax(consideration, singleFamily ? ONTARIO_HOMES : ONTARIO_OTHER);
  const torontoBrackets = torontoPeriod === 'jan-mar' ? TORONTO_EARLY : TORONTO_LATE;
  const toronto = progressiveTax(consideration, singleFamily ? torontoBrackets : ONTARIO_OTHER);
  return {
    montreal, quebec, selected, premium: (Math.round(montreal.duty * 100) - Math.round(quebec.duty * 100)) / 100,
    ontarioDuty: ontario.grossCents / 100,
    torontoMunicipalDuty: toronto.grossCents / 100,
    torontoCombinedDuty: (ontario.grossCents + toronto.grossCents) / 100,
    homeownershipCredit: estimateHomeownershipCredit(selected.taxBase, selected.duty),
  };
}
