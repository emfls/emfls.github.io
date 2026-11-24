export const BASIC_EXCLUSION = 15_000_000;
export const ANNUAL_EXCLUSION = 19_000;
export const TOP_RATE = 0.40;
export const MONEY_LIMIT = 1_000_000_000;

const BRACKETS = [
  [0, 18], [10_000, 20], [20_000, 22], [40_000, 24], [60_000, 26],
  [80_000, 28], [100_000, 30], [150_000, 32], [250_000, 34],
  [500_000, 37], [750_000, 39], [1_000_000, 40],
];
const ASSET_FIELDS = ['realEstate', 'investments', 'retirement', 'business', 'lifeInsurance'];
const DEDUCTION_FIELDS = ['debts', 'expenses', 'maritalDeduction', 'charity'];

function money(value, label, max = MONEY_LIMIT) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`${label} must be between $0 and $${max.toLocaleString('en-US')}.`);
  }
  return Math.round(value * 100);
}

function count(value, label, max) {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${label} must be a whole number from 0 to ${max}.`);
  }
  return value;
}

// Integer tax units of $0.0001 keep the progressive subtraction exact through rounding.
function schedule(amountCents) {
  return BRACKETS.reduce((tax, [floor, rate], index) => {
    const upper = (BRACKETS[index + 1]?.[0] ?? Infinity) * 100;
    return tax + Math.max(0, Math.min(amountCents, upper) - floor * 100) * rate;
  }, 0);
}

const dollars = cents => cents / 100;
const roundTax = taxUnits => dollars(Math.round(taxUnits / 100));

export function unifiedTax(amount) {
  return roundTax(schedule(money(amount, 'Unified tax base', 10 * MONEY_LIMIT)));
}

export function calculateEstate(input = {}) {
  const sum = fields => fields.reduce((total, field) => total + money(input[field] ?? 0, field), 0);
  const gross = sum(ASSET_FIELDS);
  const deductions = sum(DEDUCTION_FIELDS);
  const taxable = Math.max(0, gross - deductions);
  const gifts = money(input.adjustedGifts ?? 0, 'Adjusted taxable gifts');
  const giftTaxPayable = money(input.giftTaxPayable ?? 0, 'Form 706 prior gift tax payable');
  const exclusion = BASIC_EXCLUSION * 100 + money(input.dsue ?? 0, 'DSUE', BASIC_EXCLUSION);
  const taxBase = taxable + gifts;
  const tentative = schedule(taxBase);
  const credit = schedule(exclusion);
  // Line 7 raises the break-even tax base within the 40% bracket.
  const creditThreshold = exclusion + giftTaxPayable / TOP_RATE;
  const estateTaxUnits = Math.max(0, tentative - giftTaxPayable * 100 - credit);
  return {
    grossEstate: dollars(gross),
    deductions: dollars(deductions),
    taxableEstate: dollars(taxable),
    taxBase: dollars(taxBase),
    applicableExclusion: dollars(exclusion),
    tentativeTax: roundTax(tentative),
    unifiedCredit: roundTax(credit),
    giftTaxPayable: dollars(giftTaxPayable),
    estateHeadroom: dollars(Math.max(0, creditThreshold - gifts)),
    excessAboveCreditThreshold: dollars(Math.max(0, taxBase - creditThreshold)),
    estateTax: roundTax(estateTaxUnits),
  };
}

function donorEstimate(taxable, priorUsed, dsue, label) {
  const exclusion = BASIC_EXCLUSION * 100 + money(dsue, `${label} gift DSUE`, BASIC_EXCLUSION);
  const before = Math.max(0, exclusion - money(priorUsed, `${label} prior exclusion used`));
  const exclusionUsed = Math.min(taxable, before);
  const giftTaxUnits = (taxable - exclusionUsed) * 40;
  return {
    taxableGift: dollars(taxable),
    exclusionUsed: dollars(exclusionUsed),
    remainingExclusion: dollars(before - exclusionUsed),
    giftTaxUnits,
    giftTax: roundTax(giftTaxUnits),
  };
}

export function calculateGift({
  perRecipient = 0, recipients = 1, split = false, priorExclusionUsed = 0, dsue = 0,
  spousePriorExclusionUsed = 0, spouseDsue = 0,
} = {}) {
  const people = count(recipients, 'Recipients', 1000);
  const perPerson = money(perRecipient, 'Gift per recipient');
  const annualLimit = ANNUAL_EXCLUSION * 100 * (split ? 2 : 1);
  const taxable = Math.max(0, perPerson - annualLimit) * people;
  const donor = donorEstimate(split ? taxable / 2 : taxable, priorExclusionUsed, dsue, 'Donor');
  const spouse = split ? donorEstimate(taxable / 2, spousePriorExclusionUsed, spouseDsue, 'Spouse') : null;
  return {
    annualCapacity: dollars(annualLimit * people),
    excludedGifts: dollars(Math.min(perPerson, annualLimit) * people),
    taxableGift: dollars(taxable),
    donor,
    spouse,
    giftTax: roundTax(donor.giftTaxUnits + (spouse?.giftTaxUnits ?? 0)),
  };
}

export function projectAnnualGiving(estate, { recipients = 1, years = 10, split = false } = {}) {
  const people = count(recipients, 'Recipients', 1000);
  const duration = count(years, 'Years', 50);
  const annualTransfer = ANNUAL_EXCLUSION * people * (split ? 2 : 1);
  const transfer = annualTransfer * duration;
  const before = calculateEstate(estate);
  const reduction = Math.min(transfer, before.taxableEstate);
  // Hold deductions, prior gifts and credits constant for this counterfactual.
  const taxAfterUnits = Math.max(0, schedule(Math.round((before.taxBase - reduction) * 100))
    - Math.round(before.giftTaxPayable * 100) * 100
    - schedule(Math.round(before.applicableExclusion * 100)));
  const estateTaxAfterGiving = roundTax(taxAfterUnits);
  return {
    annualTransfer,
    transfer,
    modeledEstateReduction: reduction,
    estateTaxAfterGiving,
    estateTaxSaved: dollars(Math.round((before.estateTax - estateTaxAfterGiving) * 100)),
  };
}
