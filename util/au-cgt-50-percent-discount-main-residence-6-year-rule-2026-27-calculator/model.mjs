const DAY = 86_400_000;
const RESIDENT_BRACKETS = [[18_200, 0], [45_000, 0.15], [135_000, 0.30], [190_000, 0.37], [Infinity, 0.45]];
const FOREIGN_BRACKETS = [[135_000, 0.30], [190_000, 0.37], [Infinity, 0.45]];

function amount(value, label, { whole = false, min = 0 } = {}) {
  if (!Number.isFinite(value) || value < min || value > Number.MAX_SAFE_INTEGER / 100 ||
      (whole && !Number.isInteger(value))) {
    throw new RangeError(`Enter a valid ${whole ? 'whole number' : 'amount'} for ${label}.`);
  }
  return value;
}

function date(value, label) {
  const timestamp = Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new RangeError(`Enter a valid date for ${label}.`);
  }
  return timestamp;
}

function anniversary(timestamp, years) {
  const day = new Date(timestamp);
  const year = day.getUTCFullYear() + years;
  const month = day.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(day.getUTCDate(), lastDay));
}

export function incomeTax(income, { resident = true, includeMedicare = true } = {}) {
  amount(income, 'taxable income');
  let floor = 0;
  let tax = 0;
  for (const [ceiling, rate] of resident ? RESIDENT_BRACKETS : FOREIGN_BRACKETS) {
    tax += Math.max(0, Math.min(ceiling, income) - floor) * rate;
    floor = ceiling;
  }
  return tax + (resident && includeMedicare ? income * 0.02 : 0);
}

export function calculateCgt(input) {
  const {
    resident = true, includeMedicare = true, history, electAbsence = false, useMarketReset = false,
    purchaseContractDate, saleContractDate, laterRentalStartDate,
  } = input;
  if (!['home-first', 'rental-first', 'investment'].includes(history)) {
    throw new RangeError('Select how you used the property.');
  }

  const bought = date(purchaseContractDate, 'the purchase contract');
  const sold = date(saleContractDate, 'the sale contract');
  if (sold < Date.UTC(2026, 6, 1) || sold >= Date.UTC(2027, 6, 1) || sold < bought) {
    throw new RangeError('Enter a sale contract date in 2026–27, on or after the purchase contract date.');
  }

  if (bought < Date.UTC(1985, 8, 20)) {
    throw new RangeError('This calculator supports property acquired from 20 September 1985.');
  }
  if (!resident && bought <= Date.UTC(2012, 4, 8)) {
    throw new RangeError('The foreign-resident estimate covers purchases after 8 May 2012.');
  }

  const days = (value, label, min = 0) => amount(value, label, { whole: true, min });
  const totalDays = days(input.totalOwnershipDays, 'ownership days', 1);
  const mainResidence = resident && history !== 'investment';
  const initialDays = mainResidence && history === 'rental-first'
    ? days(input.initialRentalDays, 'initial rental days', 1) : 0;
  const laterDays = mainResidence ? days(input.laterRentalDays, 'later rental days') : 0;
  if (mainResidence && initialDays + laterDays >= totalDays) {
    throw new RangeError('Rental days must leave at least one ownership day when the home was your main residence.');
  }

  let firstRental;
  let coveredDays = 0;
  if (laterDays > 0) {
    firstRental = date(laterRentalStartDate, 'the start of the later rental');
    if (firstRental <= bought) {
      throw new RangeError('The later rental must start after you bought and lived in the home.');
    }
    if (firstRental > sold || initialDays >= (firstRental - bought) / DAY) {
      throw new RangeError('Check that the initial and later rental periods fit the ownership timeline.');
    }
    // The ATO counts through the sixth anniversary in its continuous-rental example.
    coveredDays = Math.min(laterDays, (anniversary(firstRental, 6) - firstRental) / DAY + 1);
  }

  const baselineDays = mainResidence ? initialDays + laterDays : totalDays;
  const nonExemptDays = baselineDays - (electAbsence ? coveredDays : 0);
  const reset = mainResidence && history === 'home-first' && laterDays > 0 && useMarketReset;
  if (reset && firstRental <= Date.UTC(1996, 7, 20)) {
    throw new RangeError('The first-income-use reset requires a first rental after 20 August 1996.');
  }

  const salePrice = amount(input.salePrice, 'sale price');
  const purchasePrice = amount(input.purchasePrice, 'purchase price');
  const acquisitionCosts = amount(input.buyStampDutyAndLegal, 'purchase stamp duty and legal fees');
  const sellingCosts = amount(input.sellAgentAndLegal, 'selling fees');
  const improvements = amount(input.capitalImprovements, 'capital improvements');
  const deductions = amount(input.div43DepreciationClaimed, 'Division 43 capital works deductions');
  const availableLosses = amount(input.capitalLosses, 'available capital losses');
  const otherIncome = amount(input.otherIncome, 'other taxable income');

  function scenario(taxableDays, allowDiscount) {
    const useReset = reset && taxableDays > 0;
    const ownershipDays = useReset ? days(input.resetOwnershipDays, 'days from first rental', 1) : totalDays;
    if (useReset && (ownershipDays < laterDays || ownershipDays >= totalDays)) {
      throw new RangeError('Days from first rental must cover the later rental and be fewer than total ownership days.');
    }
    const base = useReset
      ? amount(input.marketValue, 'market value at first rental', { min: 0.01 }) +
        amount(input.postResetImprovements, 'post-reset improvements') + sellingCosts -
        amount(input.postResetDiv43, 'post-reset capital works deductions')
      : purchasePrice + acquisitionCosts + improvements + sellingCosts - deductions;
    const costBase = amount(base, 'adjusted cost base');
    const grossGain = Math.max(0, salePrice - costBase);
    const fraction = taxableDays / ownershipDays;
    const apportionedGain = grossGain * fraction;
    const capitalLoss = Math.max(0, costBase - salePrice) * fraction;
    const lossesUsed = Math.min(availableLosses, apportionedGain);
    const gainAfterLosses = apportionedGain - lossesUsed;
    const discountRate = resident && allowDiscount && sold > anniversary(useReset ? firstRental : bought, 1) ? 0.50 : 0;
    const netTaxableCgt = gainAfterLosses * (1 - discountRate);
    const taxOptions = { resident, includeMedicare };
    const marginalCgtBill = incomeTax(otherIncome + netTaxableCgt, taxOptions) - incomeTax(otherIncome, taxOptions);
    return {
      costBase, grossGain, apportionedGain, capitalLoss, lossesUsed,
      lossesRemaining: availableLosses - lossesUsed + capitalLoss, gainAfterLosses,
      discountRate, netTaxableCgt, marginalCgtBill, ownershipDays, useReset,
    };
  }

  const result = scenario(nonExemptDays, true);
  const withoutDiscount = scenario(nonExemptDays, false).marginalCgtBill;
  const missingComparisonValuation = reset && nonExemptDays === 0 && Number.isNaN(input.marketValue);
  const withoutBoth = missingComparisonValuation ? null : scenario(baselineDays, false).marginalCgtBill;
  return {
    ...result, nonExemptDays, protectedRentalDays: electAbsence ? coveredDays : 0,
    noConcessionsBill: withoutBoth,
    absenceTaxSaved: withoutBoth === null ? null : withoutBoth - withoutDiscount,
    discountTaxSaved: withoutDiscount - result.marginalCgtBill,
    combinedTaxSaved: withoutBoth === null ? null : withoutBoth - result.marginalCgtBill,
  };
}
