export const FINANCIAL_YEAR = Object.freeze({ start: '2026-07-01', end: '2027-06-30' });
export const SINGLE_MEDICARE_THRESHOLD = 28_011;

const DAY_MS = 86_400_000;
const MAX_AMOUNT = 1_000_000_000;
const PROFILES = {
  resident: { bands: [[18_200, 0], [45_000, .15], [135_000, .30], [190_000, .37], [Infinity, .45]], discount: .5 },
  foreign: { bands: [[135_000, .30], [190_000, .37], [Infinity, .45]], discount: 0 },
  super: { bands: [[Infinity, .15]], discount: 1 / 3 },
};

function taxProfile(entity) {
  if (!Object.hasOwn(PROFILES, entity)) throw new RangeError('Choose a supported taxpayer type.');
  return PROFILES[entity];
}

function nonnegative(value, label, maximum = MAX_AMOUNT) {
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new RangeError(`Enter a valid ${label} from A$0 to A$${maximum.toLocaleString('en-AU')}.`);
  }
  return value;
}

function calendarDate(value, label) {
  const date = new Date(`${value}T00:00:00Z`);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`Enter a valid calendar date for ${label}.`);
  }
  return date;
}

function anniversary(date, years) {
  const result = new Date(date);
  result.setUTCFullYear(date.getUTCFullYear() + years);
  // In a non-leap year the February anniversary is the last day of February.
  if (result.getUTCMonth() !== date.getUTCMonth()) result.setUTCDate(0);
  return result;
}

export function earliestDiscountDate(acquisitionDate) {
  const eligible = anniversary(calendarDate(acquisitionDate, 'acquisition'), 1);
  eligible.setUTCDate(eligible.getUTCDate() + 1);
  return eligible.toISOString().slice(0, 10);
}

export function residenceFraction(firstRentalDate, settlementDate) {
  const firstRental = calendarDate(firstRentalDate, 'first income-producing use');
  const settlement = calendarDate(settlementDate, 'settlement');
  if (settlement < firstRental) throw new RangeError('Settlement must be on or after first income-producing use.');
  const endOfExemption = anniversary(firstRental, 6);
  const ownershipDays = (settlement - firstRental) / DAY_MS + 1;
  const nonResidenceDays = Math.max(0, (settlement - endOfExemption) / DAY_MS);
  return nonResidenceDays / ownershipDays;
}

export function incomeTax(income, entity = 'resident') {
  nonnegative(income, 'taxable income', 2 * MAX_AMOUNT);
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of taxProfile(entity).bands) {
    tax += (Math.min(income, upper) - lower) * rate;
    if (income <= upper) break;
    lower = upper;
  }
  return tax;
}

export function medicareLevy(income) {
  nonnegative(income, 'taxable income', 2 * MAX_AMOUNT);
  return Math.min(.02 * income, .10 * Math.max(0, income - SINGLE_MEDICARE_THRESHOLD));
}

export function calculateCGT({
  salePrice, purchasePrice, buySellCosts = 0, capitalImprovements = 0,
  currentLosses = 0, carriedLosses = 0, otherTaxableIncome = 0,
  acquisitionDate, saleDate, entity = 'resident', discountAllowed = true,
  homeMode = 'none', firstRentalDate, settlementDate, marketValue,
}) {
  const { discount } = taxProfile(entity);
  nonnegative(salePrice, 'sale price');
  nonnegative(buySellCosts, 'eligible transaction cost');
  nonnegative(capitalImprovements, 'eligible capital improvement amount');
  nonnegative(currentLosses, 'current-year capital loss');
  nonnegative(carriedLosses, 'carried-forward capital loss');
  nonnegative(otherTaxableIncome, 'other taxable income');
  calendarDate(acquisitionDate, 'acquisition');
  calendarDate(saleDate, 'sale contract');
  if (acquisitionDate < '1985-09-20') {
    throw new RangeError('This estimate covers assets acquired on or after 20 September 1985.');
  }
  if (entity === 'foreign' && acquisitionDate <= '2012-05-08') {
    throw new RangeError('The foreign resident estimate covers assets acquired after 8 May 2012.');
  }
  if (saleDate < acquisitionDate) throw new RangeError('The sale contract cannot predate acquisition.');
  if (saleDate < FINANCIAL_YEAR.start || saleDate > FINANCIAL_YEAR.end) {
    throw new RangeError('Enter a sale contract date within 2026–27 (1 July 2026 to 30 June 2027).');
  }
  if (!['none', 'rented', 'vacant'].includes(homeMode)) throw new RangeError('Choose a supported home-use scenario.');
  if (homeMode !== 'none' && entity !== 'resident') {
    throw new RangeError('The former-home estimate applies to a qualifying Australian resident individual.');
  }

  let taxableFraction = homeMode === 'vacant' ? 0 : 1;
  let useMarketValue = false;
  if (homeMode === 'rented') {
    calendarDate(firstRentalDate, 'first income-producing use');
    calendarDate(settlementDate, 'settlement');
    if (firstRentalDate <= acquisitionDate || firstRentalDate > saleDate || firstRentalDate <= '1996-08-20') {
      throw new RangeError('For this scenario, first income-producing use must be after acquisition and 20 August 1996, and by the sale contract date.');
    }
    if (settlementDate < saleDate) throw new RangeError('Settlement must be on or after the sale contract date.');
    taxableFraction = residenceFraction(firstRentalDate, settlementDate);
    useMarketValue = taxableFraction > 0;
  }

  const base = useMarketValue
    ? nonnegative(marketValue, 'market value at first income-producing use')
    : nonnegative(purchasePrice, 'purchase price');
  const grossGain = salePrice - base - buySellCosts - capitalImprovements;
  const assessableGain = Math.max(0, grossGain) * taxableFraction;
  const assetCapitalLoss = Math.max(0, -grossGain) * taxableFraction;
  // Use current-year losses first, then prior-year losses, before discounting.
  const currentLossesUsed = Math.min(assessableGain, currentLosses);
  const carriedLossesUsed = Math.min(assessableGain - currentLossesUsed, carriedLosses);
  const gainAfterLosses = assessableGain - currentLossesUsed - carriedLossesUsed;
  const eligibleFrom = earliestDiscountDate(useMarketValue ? firstRentalDate : acquisitionDate);
  const potentialDiscount = discountAllowed ? discount : 0;
  const discountRate = gainAfterLosses > 0 && saleDate >= eligibleFrom ? potentialDiscount : 0;

  const baselineTax = incomeTax(otherTaxableIncome, entity);
  const levy = entity === 'resident' ? medicareLevy : () => 0;
  const baselineLevy = levy(otherTaxableIncome);
  function assess(rate) {
    const netTaxableCapitalGain = gainAfterLosses - gainAfterLosses * rate;
    const combinedIncome = otherTaxableIncome + netTaxableCapitalGain;
    const incrementalIncomeTax = incomeTax(combinedIncome, entity) - baselineTax;
    const incrementalMedicare = levy(combinedIncome) - baselineLevy;
    return {
      netTaxableCapitalGain, combinedIncome, incrementalIncomeTax, incrementalMedicare,
      incrementalCGT: incrementalIncomeTax + incrementalMedicare,
    };
  }

  let comparison = null;
  if (homeMode === 'none' && eligibleFrom <= FINANCIAL_YEAR.end) {
    const shortTax = assess(0).incrementalCGT;
    const longTax = assess(potentialDiscount).incrementalCGT;
    comparison = { shortTax, longTax, savings: shortTax - longTax };
  }
  return {
    grossGain, assessableGain, assetCapitalLoss, taxableFraction, useMarketValue,
    currentLossesUsed, carriedLossesUsed, gainAfterLosses, eligibleFrom, discountRate,
    comparison, ...assess(discountRate),
  };
}
