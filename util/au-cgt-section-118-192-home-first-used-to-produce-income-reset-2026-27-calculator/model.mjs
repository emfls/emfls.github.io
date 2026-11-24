const DAY_MS = 86_400_000;
const PRE_CGT_CUTOFF = '1985-09-20';
const FIRST_USE_CUTOFF = '1996-08-20';
const DISCOUNT = 0.50;
const MEDICARE_RATE = 0.02;

const BRACKETS = [
  { lower: 18_200, upper: 45_000, rate: 0.15 },
  { lower: 45_000, upper: 135_000, rate: 0.30 },
  { lower: 135_000, upper: 190_000, rate: 0.37 },
  { lower: 190_000, upper: Infinity, rate: 0.45 },
];

function money(value, label, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum || value > 1e12) {
    throw new RangeError(`Enter ${label} as an amount from A$${minimum} to A$1 trillion.`);
  }
  return value;
}

function date(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(`Enter a valid date for ${label}.`);
  }
  const timestamp = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new RangeError(`Enter a valid date for ${label}.`);
  }
  return timestamp;
}

function yearsLater(timestamp, years) {
  const anniversary = new Date(timestamp);
  // When February has no matching day, the period runs through its last day.
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + years);
  return anniversary.getTime();
}

function discountPeriodElapsed(acquired, disposed) {
  return disposed >= yearsLater(acquired + DAY_MS, 1);
}

export function meetsDiscountPeriod(acquired, disposed) {
  return discountPeriodElapsed(date(acquired, 'acquisition'), date(disposed, 'disposal'));
}

export function residentIncomeTax(income) {
  return BRACKETS.reduce((tax, { lower, upper, rate }) =>
    tax + Math.max(0, Math.min(income, upper) - lower) * rate, 0);
}

function gainResult({ method, costBase, taxableDays, totalDays, salePrice, otherIncome, discountEligible }) {
  const rawGain = Math.max(0, salePrice - costBase);
  const taxableFraction = taxableDays / totalDays;
  const apportionedGain = rawGain * taxableFraction;
  const netTaxableGain = apportionedGain * (discountEligible ? 1 - DISCOUNT : 1);
  const incomeTax = residentIncomeTax(otherIncome + netTaxableGain) - residentIncomeTax(otherIncome);
  const medicareLevy = netTaxableGain * MEDICARE_RATE;

  return {
    method, costBase, taxableDays, totalDays, rawGain, taxableFraction, apportionedGain,
    discountEligible, netTaxableGain, incomeTax, medicareLevy,
    additionalTax: incomeTax + medicareLevy,
    belowCostBase: method !== 'exempt' && salePrice < costBase,
  };
}

export function calculate(input) {
  const purchaseContract = date(input.purchaseContract, 'purchase contract');
  const ownershipStart = date(input.ownershipStart, 'purchase settlement or earlier right to occupy');
  const firstRent = date(input.firstRent, 'first rental use');
  const saleContract = date(input.saleContract, 'sale contract');
  const saleSettlement = date(input.saleSettlement, 'sale settlement');
  const moveBack = input.moveBack ? date(input.moveBack, 'move back') : saleSettlement;
  const rentalFirstMoveIn = date(input.rentalFirstMoveIn, 'Scenario B move-in');
  if (input.purchaseContract < PRE_CGT_CUTOFF) throw new RangeError('Pre-CGT purchases are outside this calculator.');
  if (input.saleContract < '2026-07-01' || input.saleContract > '2027-06-30') {
    throw new RangeError('Enter a sale contract date in the 2026–27 income year.');
  }
  if (ownershipStart < purchaseContract || saleSettlement < saleContract) {
    throw new RangeError('Each settlement date must be on or after its contract date.');
  }
  if (firstRent <= ownershipStart || firstRent > saleContract || firstRent >= saleSettlement) {
    throw new RangeError('First rental use must follow the start of ownership and be on or before the sale contract.');
  }
  if (moveBack <= firstRent || moveBack > saleSettlement) {
    throw new RangeError('Move back after first rental use and on or before sale settlement.');
  }
  if (rentalFirstMoveIn <= ownershipStart || rentalFirstMoveIn >= saleSettlement) {
    throw new RangeError('Scenario B move-in must fall after purchase settlement and before sale settlement.');
  }
  if (input.priorFullExemption !== true) {
    throw new RangeError('Scenario A requires a full exemption immediately before first rental use.');
  }
  if (input.absenceBasis !== 'calendar' && input.absenceBasis !== 'fixed2190') {
    throw new RangeError('Select a valid six-year calculation basis.');
  }

  const salePrice = money(input.salePrice, 'sale price', 1);
  const otherIncome = money(input.otherIncome, 'other taxable income');
  const purchasePrice = money(input.purchasePrice, 'purchase price', 1);
  const buyingCosts = money(input.buyingCosts, 'buying costs');
  const preRentalImprovements = money(input.preRentalImprovements, 'earlier eligible improvements');
  const postRentalImprovements = money(input.postRentalImprovements, 'later eligible improvements');
  const sellingCosts = money(input.sellingCosts, 'selling costs');
  const originalCostBase = purchasePrice + buyingCosts + preRentalImprovements + postRentalImprovements + sellingCosts;
  const ownershipDays = (saleSettlement - ownershipStart) / DAY_MS;
  const postResetDays = (saleSettlement - firstRent) / DAY_MS;
  const rentedDays = (moveBack - firstRent) / DAY_MS;
  const limitDays = input.absenceBasis === 'fixed2190' ? 2190 : (yearsLater(firstRent, 6) - firstRent) / DAY_MS;
  const exemptRentalDays = input.claim6YearAbsence === true ? Math.min(rentedDays, limitDays) : 0;
  const taxableDays = rentedDays - exemptRentalDays;
  const afterCutoff = input.firstRent > FIRST_USE_CUTOFF ||
    (input.firstRent === FIRST_USE_CUTOFF && input.afterCutoffTime === true);
  const resetApplies = taxableDays > 0 && afterCutoff;
  const originalDiscountEligible = discountPeriodElapsed(purchaseContract, saleContract);
  const resetDiscountEligible = discountPeriodElapsed(firstRent, saleContract);
  const original = {
    method: 'original', costBase: originalCostBase, totalDays: ownershipDays,
    salePrice, otherIncome, discountEligible: originalDiscountEligible,
  };

  const unreset = gainResult({ ...original, taxableDays });
  const rentedFirst = gainResult({ ...original, taxableDays: (rentalFirstMoveIn - ownershipStart) / DAY_MS });
  let homeFirst = unreset;
  if (taxableDays === 0) {
    homeFirst = gainResult({ ...original, method: 'exempt', taxableDays, discountEligible: false });
  } else if (resetApplies) {
    const marketValue = money(input.marketValue, 'market value at first rental use', 1);
    homeFirst = gainResult({
      ...original, method: 'reset', taxableDays, totalDays: postResetDays,
      costBase: marketValue + postRentalImprovements + sellingCosts, discountEligible: resetDiscountEligible,
    });
  }

  return {
    homeFirst: { ...homeFirst, rentedDays, exemptRentalDays },
    rentedFirst,
    unreset,
    resetTaxSaved: unreset.additionalTax - homeFirst.additionalTax,
    resetClockTrap: resetApplies && !resetDiscountEligible,
  };
}
