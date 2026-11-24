export const CAPITAL_CEILING = 1_000_000;
export const MAX_AMOUNT = 1_000_000_000_000;

const ordinaryCaps = { single: 50_000, mfs: 50_000, hoh: 50_000, mfj: 100_000 };
const answers = ['yes', 'no', 'unknown'];
const dispositions = ['sale', 'worthless'];
const toCents = value => Math.round(value * 100);
const fromCents = value => value / 100;

function validDecimal(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max && fromCents(toCents(value)) === value;
}

function screen({ domestic, original, holder, exception, active, capital, transitional }) {
  const core = [domestic, original, holder];
  if (core.includes('no') || (active <= 50 && exception === 'no')
      || (capital > CAPITAL_CEILING && transitional === 'no')) {
    return 'ineligible';
  }
  if (core.includes('unknown') || (active <= 50 && exception === 'unknown')
      || transitional !== 'no') {
    return 'review';
  }
  return 'eligible';
}

function yearOne(loss, ordinary, gains, incomeCap, ordinaryRate, capitalRate) {
  const capitalLoss = loss - ordinary;
  const gainOffset = Math.min(capitalLoss, gains);
  const incomeOffset = Math.min(capitalLoss - gainOffset, incomeCap);
  const carryover = capitalLoss - gainOffset - incomeOffset;
  // Rates are in basis points. Split the multiplication to retain cent precision at the input ceiling.
  const savingsAt = (amount, rate) => Math.floor(amount / 10_000) * rate
    + ((amount % 10_000) * rate) / 10_000;
  const savings = Math.round(savingsAt(ordinary + incomeOffset, ordinaryRate)
    + savingsAt(gainOffset, capitalRate));

  return {
    gainOffset: fromCents(gainOffset),
    incomeOffset: fromCents(incomeOffset),
    carryover: fromCents(carryover),
    savings: fromCents(savings),
    equivalentYears: (capitalLoss - gainOffset) / incomeCap,
    taxYears: loss === 0 ? 0 : 1 + Math.ceil(carryover / incomeCap),
  };
}

function optimizeSplit(loss, firstCap, secondCap) {
  const firstOrdinary = Math.min(loss, firstCap);
  const secondLoss = Math.min(loss - firstOrdinary, secondCap);
  return {
    firstLoss: fromCents(loss - secondLoss),
    secondLoss: fromCents(secondLoss),
    firstOrdinary: fromCents(firstOrdinary),
    secondOrdinary: fromCents(secondLoss),
    totalOrdinary: fromCents(firstOrdinary + secondLoss),
    capitalLoss: fromCents(loss - firstOrdinary - secondLoss),
  };
}

/** Monetary inputs and outputs are in dollars. Rates are percentages, not fractions. */
export function calculate(inputs) {
  const { basis, proceeds, filing, gains, fed, state, gainsRate, priorOrdinary, capital,
    active, domestic, original, holder, exception, transitional = 'unknown', disposition } = inputs;
  if (!Object.hasOwn(ordinaryCaps, filing)
      || ![basis, proceeds, gains, priorOrdinary, capital].every(value => validDecimal(value, 0, MAX_AMOUNT))
      || !validDecimal(fed, 10, 37) || !validDecimal(state, 0, 13.3)
      || !validDecimal(gainsRate, 0, 37) || !validDecimal(active, 0, 100)
      || ![domestic, original, holder, exception, transitional].every(value => answers.includes(value))
      || !dispositions.includes(disposition)) {
    return { error: 'Complete each field using the displayed limits and up to two decimal places.' };
  }
  if (disposition === 'worthless' && proceeds !== 0) {
    return { error: 'Enter zero proceeds for stock that became wholly worthless.' };
  }

  const ordinaryCap = ordinaryCaps[filing];
  const remainingOrdinaryCap = Math.max(0, toCents(ordinaryCap) - toCents(priorOrdinary));
  const capitalIncomeCap = filing === 'mfs' ? 1_500 : 3_000;
  const incomeCap = toCents(capitalIncomeCap);
  const loss = Math.max(0, toCents(basis) - toCents(proceeds));
  const eligibility = screen({ domestic, original, holder, exception, active, capital, transitional });
  const ordinary = eligibility === 'eligible' ? Math.min(loss, remainingOrdinaryCap) : 0;
  const ordinaryRate = toCents(fed) + toCents(state);
  const capitalRate = toCents(gainsRate) + toCents(state);
  const standard = yearOne(loss, 0, toCents(gains), incomeCap, ordinaryRate, capitalRate);
  const with1244 = eligibility === 'review' && loss > 0
    ? null
    : yearOne(loss, ordinary, toCents(gains), incomeCap, ordinaryRate, capitalRate);
  const split = eligibility === 'eligible' && disposition === 'sale' && loss > remainingOrdinaryCap
    ? optimizeSplit(loss, remainingOrdinaryCap, toCents(ordinaryCap))
    : null;

  return {
    loss: fromCents(loss),
    eligibility,
    ordinaryCap,
    remainingOrdinaryCap: fromCents(remainingOrdinaryCap),
    capitalIncomeCap,
    ordinary: with1244 === null ? null : fromCents(ordinary),
    capitalLoss: with1244 === null ? null : fromCents(loss - ordinary),
    with1244,
    standard,
    advantage: with1244 === null ? null : fromCents(toCents(with1244.savings) - toCents(standard.savings)),
    yearsSaved: with1244 === null ? null : standard.taxYears - with1244.taxYears,
    capitalReview: transitional !== 'no',
    split,
  };
}
