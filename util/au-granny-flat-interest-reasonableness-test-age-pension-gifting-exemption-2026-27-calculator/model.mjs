// DSS Social Security Guide 4.6.4.60. The first row is age 51 at next birthday.
const FACTORS = Object.freeze([
  33.94, 33.02, 32.09, 31.18, 30.27, 29.37, 28.47, 27.57, 26.69, 25.80,
  24.92, 24.05, 23.18, 22.33, 21.48, 20.64, 19.80, 18.98, 18.16, 17.36,
  16.56, 15.77, 15.01, 14.25, 13.50, 12.78, 12.07, 11.37, 10.70, 10.04,
  9.41, 8.80, 8.21, 7.65, 7.11, 6.60, 6.13, 5.68, 5.26, 4.87,
  4.52, 4.19, 3.89, 3.63, 3.40, 3.19, 3.01, 2.86, 2.72, 2.60,
]);

// Standard domestic Age Pension rates at 20 September 2026.
export const RATES = Object.freeze({
  annualPartneredRate: 48516,
  eaa: 267000,
  annualGiftLimit: 10000,
  fiveYearGiftLimit: 30000,
  deprivationYears: 5,
  deemingLow: 0.0175,
  deemingHigh: 0.0375,
  fortnights: 26,
});

const HOUSEHOLDS = {
  single: { maxFortnight: 1237.70, homeThreshold: 333000, incomeFree: 226, incomeTaper: 0.5, deemingThreshold: 66800, assetShare: 1 },
  coupleBoth: { maxFortnight: 1866, homeThreshold: 499000, incomeFree: 396, incomeTaper: 0.5, deemingThreshold: 110600, assetShare: 1 },
  coupleOne: { maxFortnight: 933, homeThreshold: 499000, incomeFree: 396, incomeTaper: 0.25, deemingThreshold: 110600, assetShare: 0.5 },
};

const ARRANGEMENTS = ['lumpSum', 'standardCost', 'documentedPlusExtra', 'unknown'];
const MONEY_MAX = 100000000;
const cents = value => Math.round(value * 100) / 100;

function checkAmount(value, label, min = 0, max = MONEY_MAX) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min.toLocaleString('en-AU')} and ${max.toLocaleString('en-AU')}.`);
  }
}

function checkAge(age) {
  if (!Number.isInteger(age) || age < 1 || age > 130) {
    throw new RangeError('Enter a whole age at next birthday between 1 and 130.');
  }
}

function householdRates(household) {
  if (!Object.hasOwn(HOUSEHOLDS, household)) throw new RangeError('Choose an Age Pension household.');
  return HOUSEHOLDS[household];
}

export function conversionFactor(nextBirthdayAge) {
  checkAge(nextBirthdayAge);
  return FACTORS[nextBirthdayAge - 51] ?? null;
}

export function remainingGiftAllowance(giftsThisYear, fiveYearAllowanceUsed) {
  checkAmount(giftsThisYear, 'Gifts already made this financial year');
  checkAmount(fiveYearAllowanceUsed, 'Five-year free area used', 0, RATES.fiveYearGiftLimit);
  const annualUsed = Math.min(giftsThisYear, RATES.annualGiftLimit);
  if (fiveYearAllowanceUsed < annualUsed) {
    throw new RangeError('Five-year free area used must include this year’s gifts up to $10,000.');
  }
  return cents(Math.min(RATES.annualGiftLimit - annualUsed, RATES.fiveYearGiftLimit - fiveYearAllowanceUsed));
}

export function deemedIncome(financialAssets, household) {
  const { deemingThreshold } = householdRates(household);
  return Math.min(financialAssets, deemingThreshold) * RATES.deemingLow
    + Math.max(0, financialAssets - deemingThreshold) * RATES.deemingHigh;
}

export function estimatePension({ assets, financialAssets, otherAnnualIncome, household, homeowner, eaa }) {
  const rates = householdRates(household);
  const threshold = rates.homeThreshold + (homeowner ? 0 : eaa);
  const deemedAnnual = deemedIncome(financialAssets, household);
  const assetExcess = Math.max(0, cents(assets - threshold));
  // DSS 4.2.3 assesses excess assets in whole $250 steps.
  const assetReduction = Math.floor(assetExcess / 250) * 0.75 * rates.assetShare;
  const incomeExcess = Math.max(0, (deemedAnnual + otherAnnualIncome) / RATES.fortnights - rates.incomeFree);
  const incomeReduction = incomeExcess * rates.incomeTaper;
  const fortnight = cents(Math.max(0, rates.maxFortnight - Math.max(assetReduction, incomeReduction)));
  let bindingTest = 'Full rate';
  if (assetReduction || incomeReduction) {
    bindingTest = assetReduction >= incomeReduction ? 'Assets test' : 'Income test';
  }
  return { annual: cents(fortnight * RATES.fortnights), fortnight, bindingTest, threshold, deemedAnnual: cents(deemedAnnual), assets };
}

export function calculate(input) {
  const {
    household, nextBirthdayAge, partnerNextBirthdayAge, arrangement,
    transfer, documentedCost, giftsThisYear, fiveYearAllowanceUsed,
    otherAssets, financialAssets, otherAnnualIncome, giftHomeowner, annualPartneredRate, eaa,
  } = input;
  householdRates(household);
  checkAge(nextBirthdayAge);
  const couple = household !== 'single';
  if (couple) checkAge(partnerNextBirthdayAge);
  if (!ARRANGEMENTS.includes(arrangement)) throw new RangeError('Choose an arrangement.');
  if (typeof giftHomeowner !== 'boolean') throw new RangeError('Choose your housing status for the outright gift.');
  checkAmount(transfer, 'Total contribution');
  if (arrangement === 'documentedPlusExtra') checkAmount(documentedCost, 'Documented property or building cost', 0.01, transfer);
  checkAmount(otherAssets, 'Remaining assessable assets');
  checkAmount(financialAssets, 'Remaining financial assets', 0, otherAssets);
  checkAmount(otherAnnualIncome, 'Other assessable income');
  checkAmount(annualPartneredRate, 'Combined annual partnered rate', 1);
  checkAmount(eaa, 'Extra Allowable Amount');
  const giftAllowance = remainingGiftAllowance(giftsThisYear, fiveYearAllowanceUsed);
  const factorAge = couple ? Math.min(nextBirthdayAge, partnerNextBirthdayAge) : nextBirthdayAge;
  const factor = conversionFactor(factorAge);
  const testApplies = arrangement === 'lumpSum' || arrangement === 'documentedPlusExtra';
  const reasonablenessLimit = testApplies && factor !== null ? cents(annualPartneredRate * factor) : null;

  let entryContribution = null;
  if (arrangement === 'standardCost') entryContribution = transfer;
  if (reasonablenessLimit !== null) {
    const recognizedLimit = arrangement === 'documentedPlusExtra'
      ? Math.max(reasonablenessLimit, documentedCost)
      : reasonablenessLimit;
    entryContribution = Math.min(transfer, recognizedLimit);
  }

  const giftExcess = entryContribution === null ? null : cents(transfer - entryContribution);
  const deprivedAsset = giftExcess === null ? null : cents(Math.max(0, giftExcess - giftAllowance));
  const homeowner = entryContribution > 0 ? entryContribution > eaa : null;
  const assessableInterest = homeowner === null ? null : homeowner ? 0 : entryContribution;
  const standardGiftDeprivedAsset = cents(Math.max(0, transfer - giftAllowance));

  const ageForPayment = household === 'coupleOne' ? Math.max(nextBirthdayAge, partnerNextBirthdayAge) : factorAge;
  const pensionEligibleByAge = ageForPayment >= 68;
  function pension(newDeprivation, assessableHousingInterest, isHomeowner) {
    return estimatePension({
      assets: cents(otherAssets + newDeprivation + assessableHousingInterest),
      financialAssets: cents(financialAssets + newDeprivation),
      otherAnnualIncome, household, homeowner: isHomeowner, eaa,
    });
  }

  const standardGiftPension = pensionEligibleByAge ? pension(standardGiftDeprivedAsset, 0, giftHomeowner) : null;
  const grannyPension = pensionEligibleByAge && homeowner !== null ? pension(deprivedAsset, assessableInterest, homeowner) : null;
  const pensionWithoutDeprivation = grannyPension && pension(0, assessableInterest, homeowner);
  const annualDifference = grannyPension && cents(grannyPension.annual - standardGiftPension.annual);
  const annualDeprivationImpact = grannyPension && cents(pensionWithoutDeprivation.annual - grannyPension.annual);

  return {
    factorAge, factor, reasonablenessLimit, entryContribution, giftExcess, giftAllowance,
    deprivedAsset, standardGiftDeprivedAsset, homeowner, assessableInterest, pensionEligibleByAge,
    grannyPension, standardGiftPension, annualDifference, annualDeprivationImpact,
    fiveYearDifference: annualDifference === null ? null : cents(annualDifference * RATES.deprivationYears),
    fiveYearDeprivationImpact: annualDeprivationImpact === null ? null : cents(annualDeprivationImpact * RATES.deprivationYears),
  };
}
