const DAY_MS = 86_400_000;
const RESET_CUTOFF = Date.UTC(1996, 7, 20) / DAY_MS;
const TAX_YEAR_START = Date.UTC(2026, 6, 1) / DAY_MS;
const TAX_YEAR_END = Date.UTC(2027, 5, 30) / DAY_MS;
const FIRST_CGT_DAY = Date.UTC(1985, 8, 20) / DAY_MS;
const USES = new Set(['home', 'rented', 'vacant']);
const BRACKETS = [
  [18_200, 45_000, 0.15],
  [45_000, 135_000, 0.30],
  [135_000, 190_000, 0.37],
  [190_000, Infinity, 0.45],
];

function dateToDay(value, label) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value + 'T00:00:00Z');
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) {
      return date.getTime() / DAY_MS;
    }
  }
  throw new RangeError(label + ' needs a valid date.');
}

function anniversary(day, years) {
  const date = new Date(day * DAY_MS);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + years);
  if (date.getUTCMonth() !== month) date.setUTCDate(0); // 29 February becomes 28 February.
  return date.getTime() / DAY_MS;
}

function amount(value, label, positive = false) {
  if (!Number.isFinite(value) || value < 0 || (positive && value === 0) || value > 1e12) {
    const minimum = positive ? 'greater than zero' : 'zero or more';
    throw new RangeError(label + ' must be ' + minimum + ' and no more than A$1 trillion.');
  }
  return value;
}

export function residentIncomeTax(taxableIncome) {
  return BRACKETS.reduce((tax, [lower, upper, rate]) => {
    return tax + Math.max(0, Math.min(taxableIncome, upper) - lower) * rate;
  }, 0);
}

export function standardMedicareLevy(taxableIncome) {
  return taxableIncome * 0.02;
}

function parseTimeline(periods, start, end) {
  if (!Array.isArray(periods) || periods.length === 0) {
    throw new RangeError('Enter a property use timeline.');
  }
  return periods.map(({ from, use }, index) => {
    const day = dateToDay(from, 'Timeline row ' + (index + 1));
    if (index === 0 && day !== start) {
      throw new RangeError('The timeline must start at purchase settlement.');
    }
    if (index > 0 && from <= periods[index - 1].from) {
      throw new RangeError('Each timeline date must be later than the previous date.');
    }
    if (day > end) throw new RangeError('Timeline dates cannot be after sale settlement.');
    if (!USES.has(use)) throw new RangeError('Select a valid use in each timeline row.');
    return { day, use };
  });
}

function countNonExemptDays(periods, saleSettlement, applyAbsenceRule) {
  let establishedHome = false;
  let coveredRentalDays = 0;
  let nonExemptDays = 0;
  let rentalAllowance;
  let fullyExemptBeforeFirstRental = false;
  let firstRental;

  for (const [index, { day, use }] of periods.entries()) {
    const end = periods[index + 1]?.day ?? saleSettlement + 1;
    const days = end - day;

    if (use === 'home') {
      establishedHome = true;
      rentalAllowance = undefined;
      continue;
    }

    if (use === 'rented' && firstRental === undefined) {
      firstRental = day;
      fullyExemptBeforeFirstRental = establishedHome && nonExemptDays === 0;
    }

    if (!applyAbsenceRule || !establishedHome) {
      nonExemptDays += days;
    } else if (use === 'rented') {
      // The first rental starts a calendar-year allowance. Vacant intervals pause it.
      rentalAllowance ??= anniversary(day, 6) - day + 1;
      const covered = Math.min(days, rentalAllowance);
      rentalAllowance -= covered;
      coveredRentalDays += covered;
      nonExemptDays += days - covered;
    }
  }

  return { nonExemptDays, coveredRentalDays, firstRental, fullyExemptBeforeFirstRental };
}

function estimate(input, dates, periods, applyAbsenceRule) {
  const { purchaseContract, purchaseSettlement, saleContract, saleSettlement } = dates;
  const days = countNonExemptDays(periods, saleSettlement, applyAbsenceRule);
  const { nonExemptDays, coveredRentalDays, firstRental, fullyExemptBeforeFirstRental } = days;
  const resetApplies = fullyExemptBeforeFirstRental && firstRental > RESET_CUTOFF && nonExemptDays > 0;
  const ownershipStart = resetApplies ? firstRental : purchaseSettlement;
  const ownershipDays = saleSettlement - ownershipStart + 1;
  const costBase = resetApplies
    ? amount(input.marketValue, 'First-rental market value', true) + input.sellingCosts + input.postResetImprovements
    : input.purchasePrice + input.stampDuty + input.sellingCosts + input.improvements;
  const grossGain = Math.max(0, input.salePrice - costBase);
  const gainBeforeDiscount = grossGain * (nonExemptDays / ownershipDays);
  const discountApplies = gainBeforeDiscount > 0 && saleContract > anniversary(
    resetApplies ? firstRental : purchaseContract, 1,
  );
  const netGain = discountApplies ? gainBeforeDiscount * 0.5 : gainBeforeDiscount;
  const incomeWithGain = input.otherIncome + netGain;
  const additionalIncomeTax = residentIncomeTax(incomeWithGain) - residentIncomeTax(input.otherIncome);
  const additionalMedicareLevy = standardMedicareLevy(netGain);
  return {
    nonExemptDays, coveredRentalDays, ownershipDays, resetApplies, costBase, grossGain,
    gainBeforeDiscount, discountApplies, netGain, additionalIncomeTax, additionalMedicareLevy,
    additionalTax: additionalIncomeTax + additionalMedicareLevy,
  };
}

export function compareScenarios(input) {
  const purchaseContract = dateToDay(input.purchaseContract, 'Purchase contract');
  const purchaseSettlement = dateToDay(input.purchaseSettlement, 'Purchase settlement');
  const saleContract = dateToDay(input.saleContract, 'Sale contract');
  const saleSettlement = dateToDay(input.saleSettlement, 'Sale settlement');

  if (purchaseContract < FIRST_CGT_DAY) throw new RangeError('This calculator covers post-CGT purchases from 20 September 1985.');
  if (purchaseSettlement < purchaseContract) throw new RangeError('Purchase settlement must be on or after the purchase contract.');
  if (saleContract < TAX_YEAR_START || saleContract > TAX_YEAR_END) {
    throw new RangeError('Enter a sale contract date in the 2026–27 income year (1 July 2026 to 30 June 2027).');
  }
  if (saleContract < purchaseSettlement) throw new RangeError('Sale contract must be on or after purchase settlement.');
  if (saleSettlement < saleContract) throw new RangeError('Sale settlement must be on or after the sale contract.');

  amount(input.purchasePrice, 'Original purchase price', true);
  amount(input.stampDuty, 'Buying stamp duty');
  amount(input.salePrice, 'Sale price', true);
  amount(input.sellingCosts, 'Selling costs');
  amount(input.improvements, 'Total capital improvements');
  amount(input.postResetImprovements, 'Post-reset capital improvements');
  amount(input.otherIncome, 'Other taxable income');
  if (input.postResetImprovements > input.improvements) {
    throw new RangeError('Post-reset improvements cannot exceed total capital improvements.');
  }

  const periods = parseTimeline(input.periods, purchaseSettlement, saleSettlement);
  const dates = { purchaseContract, purchaseSettlement, saleContract, saleSettlement };
  const withRule = estimate(input, dates, periods, true);
  const withoutRule = estimate(input, dates, periods, false);
  return { withRule, withoutRule, taxSaved: withoutRule.additionalTax - withRule.additionalTax };
}
