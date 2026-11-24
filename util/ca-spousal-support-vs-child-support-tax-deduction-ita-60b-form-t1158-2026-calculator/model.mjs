export const PERIODIC = 'periodic_registered_t1158';
export const LUMP_SUM = 'lump_sum_non_deductible';

const FEDERAL = [
  [58_523, 0.14], [117_045, 0.205], [181_440, 0.26],
  [258_482, 0.29], [Infinity, 0.33],
];
const PROVINCIAL = {
  ON: [[53_891, 0.0505], [107_785, 0.0915], [150_000, 0.1116], [220_000, 0.1216], [Infinity, 0.1316]],
  BC: [[50_363, 0.056], [100_728, 0.077], [115_648, 0.105], [140_430, 0.1229],
    [190_405, 0.147], [265_545, 0.168], [Infinity, 0.205]],
  AB: [[61_200, 0.08], [154_259, 0.10], [185_111, 0.12], [246_813, 0.13],
    [370_220, 0.14], [Infinity, 0.15]],
  QC: [[54_345, 0.14], [108_680, 0.19], [132_245, 0.24], [Infinity, 0.2575]],
};
const QUEBEC_FEDERAL_ABATEMENT = 0.165;

function taxInRange(lower, upper, brackets) {
  let tax = 0;
  let floor = 0;
  for (const [ceiling, rate] of brackets) {
    tax += Math.max(0, Math.min(upper, ceiling) - Math.max(lower, floor)) * rate;
    if (upper <= ceiling) break;
    floor = ceiling;
  }
  return tax;
}

function combinedTaxInRange(lower, upper, province) {
  if (!Object.hasOwn(PROVINCIAL, province)) throw new RangeError('Select a supported province.');
  const federal = taxInRange(lower, upper, FEDERAL);
  const federalShare = province === 'QC' ? 1 - QUEBEC_FEDERAL_ABATEMENT : 1;
  return federal * federalShare + taxInRange(lower, upper, PROVINCIAL[province]);
}

/** Bracket tax before credits and other adjustments. */
export function incomeTax(income, province) {
  if (!Number.isFinite(income) || income < 0) throw new RangeError('Enter a non-negative taxable income.');
  return combinedTaxInRange(0, income, province);
}

function toCents(amount) {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
    throw new RangeError('Enter valid amounts between $0 and $1 billion.');
  }
  const cents = Math.round(amount * 100);
  if (amount !== cents / 100) throw new RangeError('Use at most two decimal places.');
  return cents;
}

export function calculateSupport({
  province, structure, monthlyChild, monthlySpousal, actualPaid, priorChildArrears = 0,
  payerIncome, recipientIncome,
}) {
  if (structure !== PERIODIC && structure !== LUMP_SUM) throw new RangeError('Select a payment structure.');
  const scheduledChild = toCents(monthlyChild) * 12;
  const scheduledSpousal = toCents(monthlySpousal) * 12;
  const childDue = scheduledChild + toCents(priorChildArrears);
  const paid = toCents(actualPaid);
  const childAllocated = Math.min(paid, childDue);
  const periodic = structure === PERIODIC;
  const deductible = periodic ? Math.min(scheduledSpousal, paid - childAllocated) : 0;
  const reportable = childAllocated + deductible;
  const deduction = deductible / 100;
  const payerBefore = toCents(payerIncome);
  const recipientBefore = toCents(recipientIncome);
  const payerTaxableIncome = Math.max(0, payerBefore - deductible) / 100;
  const recipientTaxableIncome = (recipientBefore + deductible) / 100;
  const taxSavedCents = Math.round(combinedTaxInRange(payerTaxableIncome, payerBefore / 100, province) * 100);
  const extraTaxCents = Math.round(combinedTaxInRange(recipientBefore / 100, recipientTaxableIncome, province) * 100);
  const payerNetCost = (paid - taxSavedCents) / 100;
  const recipientNetCash = (paid - extraTaxCents) / 100;

  return {
    scheduledChildAnnual: scheduledChild / 100,
    scheduledSpousalAnnual: scheduledSpousal / 100,
    childDue: childDue / 100,
    childAllocated: childAllocated / 100,
    childShortfall: (childDue - childAllocated) / 100,
    spousalShortfall: periodic ? (scheduledSpousal - deductible) / 100 : 0,
    excludedTransfer: (paid - reportable) / 100,
    line21999: reportable / 100,
    line22000: deduction,
    line12799: reportable / 100,
    line12800: deduction,
    payerTaxableIncome,
    recipientTaxableIncome,
    taxSaved: taxSavedCents / 100,
    recipientExtraTax: extraTaxCents / 100,
    payerNetCost,
    payerNetMonthly: payerNetCost / 12,
    recipientNetCash,
    recipientNetMonthly: recipientNetCash / 12,
    combinedSaving: (taxSavedCents - extraTaxCents) / 100,
  };
}
