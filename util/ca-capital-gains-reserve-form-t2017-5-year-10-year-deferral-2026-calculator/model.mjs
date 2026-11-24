export const SALE_YEAR = 2026;
export const INCLUSION_RATE = 0.5;
const RESERVE_YEARS = { standard_5yr: 5, intergenerational_10yr: 10 };

// Each pair is the upper limit of a taxable-income slice and its marginal rate.
const FEDERAL = [
  [58523, .14], [117045, .205], [181440, .26], [258482, .29], [Infinity, .33],
];
const PROVINCIAL = {
  ON: [[53891, .0505], [107785, .0915], [150000, .1116], [220000, .1216], [Infinity, .1316]],
  BC: [[50363, .056], [100728, .077], [115648, .105], [140430, .1229],
    [190405, .147], [265545, .168], [Infinity, .205]],
  AB: [[61200, .08], [154259, .10], [185111, .12], [246813, .13], [370220, .14], [Infinity, .15]],
  QC: [[54345, .14], [108680, .19], [132245, .24], [Infinity, .2575]],
};

export function statutoryFactor(yearIndex, regime) {
  if (!Object.hasOwn(RESERVE_YEARS, regime)) throw new RangeError('Choose a supported reserve regime.');
  if (!Number.isSafeInteger(yearIndex) || yearIndex < 0) throw new RangeError('Enter a valid year index.');
  const years = RESERVE_YEARS[regime];
  return Math.max(0, (years - 1 - yearIndex) / years);
}

function taxOnSlices(baseIncome, extraIncome, brackets) {
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of brackets) {
    const start = Math.max(baseIncome, lower);
    const portion = Math.max(0, Math.min(extraIncome - (start - baseIncome), upper - start));
    tax += portion * rate;
    lower = upper;
  }
  return tax;
}

export function incrementalTax(baseIncome, taxableGain, province) {
  if (!Object.hasOwn(PROVINCIAL, province)) throw new RangeError('Choose a supported province.');
  if (![baseIncome, taxableGain].every(amount => Number.isFinite(amount) && amount >= 0)) {
    throw new RangeError('Taxable income and gain must be finite, non-negative amounts.');
  }
  const federalTax = taxOnSlices(baseIncome, taxableGain, FEDERAL);
  const provincialTax = taxOnSlices(baseIncome, taxableGain, PROVINCIAL[province]);
  return federalTax * (province === 'QC' ? 0.835 : 1) + provincialTax;
}

export function calculateReserve({
  saleProceeds, costBasisAndExpenses, downPayment, installmentYears,
  otherIncome, province, regime, nonResident = false,
}) {
  if (!Number.isFinite(saleProceeds) || saleProceeds <= 0) {
    throw new RangeError('Enter sale proceeds greater than zero.');
  }
  if (!Number.isFinite(costBasisAndExpenses) || costBasisAndExpenses < 0) {
    throw new RangeError('Enter a non-negative amount for ACB plus selling expenses.');
  }
  if (!Number.isFinite(downPayment) || downPayment < 0 || downPayment > saleProceeds) {
    throw new RangeError('Enter a down payment between zero and the sale proceeds.');
  }
  if (!Number.isSafeInteger(installmentYears) || installmentYears < 0
      || (installmentYears === 0 && downPayment < saleProceeds)) {
    throw new RangeError('Enter a whole number of installment years. Use 0 only for full payment at closing.');
  }
  if (!Number.isFinite(otherIncome) || otherIncome < 0) {
    throw new RangeError('Enter non-negative other annual taxable income.');
  }
  if (!Object.hasOwn(PROVINCIAL, province)) throw new RangeError('Choose a supported province.');
  if (!Object.hasOwn(RESERVE_YEARS, regime)) throw new RangeError('Choose a supported reserve regime.');
  if (typeof nonResident !== 'boolean') throw new RangeError('Residency flag must be true or false.');

  const totalCapitalGain = Math.max(0, saleProceeds - costBasisAndExpenses);
  const financedPrincipal = saleProceeds - downPayment;
  const annualInstallment = installmentYears === 0 ? 0 : financedPrincipal / installmentYears;
  const reserveYears = nonResident ? 1 : RESERVE_YEARS[regime];
  const lumpSumTax = nonResident ? null : incrementalTax(otherIncome, totalCapitalGain * INCLUSION_RATE, province);

  const schedule = [];
  let priorReserveAddedBack = 0;
  for (let k = 0; k < reserveYears; k += 1) {
    const proceedsDue = k === 0 ? downPayment : k <= installmentYears ? annualInstallment : 0;
    const unpaidProceedsAtYearEnd = installmentYears === 0 ? 0
      : financedPrincipal * (Math.max(0, installmentYears - k) / installmentYears);
    const proceedsBasedReserve = totalCapitalGain * (unpaidProceedsAtYearEnd / saleProceeds);
    const reserveFactor = nonResident ? 0 : statutoryFactor(k, regime);
    const statutoryCapReserve = totalCapitalGain * reserveFactor;
    const endingReserve = Math.min(proceedsBasedReserve, statutoryCapReserve);
    const netCapitalGainRecognized = (k === 0 ? totalCapitalGain : priorReserveAddedBack) - endingReserve;
    const taxableCapitalGain = netCapitalGainRecognized * INCLUSION_RATE;
    const tax = nonResident ? null : incrementalTax(otherIncome, taxableCapitalGain, province);
    schedule.push({
      year: SALE_YEAR + k, proceedsDue, unpaidProceedsAtYearEnd, proceedsBasedReserve,
      reserveFactor, statutoryCapReserve, endingReserve, priorReserveAddedBack,
      netCapitalGainRecognized, taxableCapitalGain, tax,
    });
    priorReserveAddedBack = endingReserve;
  }

  const cumulativeTax = nonResident ? null : schedule.reduce((total, row) => total + row.tax, 0);
  return {
    totalCapitalGain, annualInstallment, lumpSumTax, cumulativeTax, schedule,
    savings: nonResident ? null : Math.max(0, lumpSumTax - cumulativeTax),
    yearZeroCashPreserved: nonResident ? null : lumpSumTax - schedule[0].tax,
  };
}
