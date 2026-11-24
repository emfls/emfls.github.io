export const PARAMETERS = Object.freeze({
  personalAllowance: 12570,
  taperStarts: 100000,
  basicBand: 37700,
  additionalThreshold: 125140,
  lumpSumAllowance: 268275,
  annualAllowance: 60000,
  moneyPurchaseAnnualAllowance: 10000,
  maxInput: 1000000000
});

const pence = (amount) => Math.round(amount * 100);
const pounds = (amount) => amount / 100;
const positive = (amount) => Math.max(0, amount);

export function isValidAmount(amount) {
  return Number.isFinite(amount) && amount >= 0 && amount <= PARAMETERS.maxInput && pounds(pence(amount)) === amount;
}

function readAmount(amount) {
  if (!isValidAmount(amount)) {
    throw new RangeError('Enter each amount from £0 to £1,000,000,000, with up to two decimal places.');
  }
  return pence(amount);
}

// Keep the tapered allowance in half-pennies. Round each annual liability once.
function annualTaxPence(income) {
  const allowance = positive(pence(PARAMETERS.personalAllowance) * 2 - positive(income - pence(PARAMETERS.taperStarts)));
  const taxable = positive(income * 2 - allowance);
  const basicLimit = pence(PARAMETERS.basicBand) * 2;
  const higherLimit = pence(PARAMETERS.additionalThreshold) * 2;
  const basic = Math.min(taxable, basicLimit);
  const higher = positive(Math.min(taxable, higherLimit) - basicLimit);
  const additional = positive(taxable - higherLimit);
  return Math.round((basic * 20 + higher * 40 + additional * 45) / 200);
}

export function annualIncomeTax(income) {
  return pounds(annualTaxPence(readAmount(income)));
}

// HMRC manual Tables A and B–D, 1257L M1. Table A splits code 1257 into
// two £416.67 adjustments and £214.92 for code 257. C1/C2 publish their
// own starting tax amounts because their monthly cutoffs use payroll rounding.
function monthOneTaxPence(payment) {
  const taxable = Math.floor(positive(payment - 104826) / 100);
  if (taxable <= 3142) return taxable * 20;
  if (taxable <= 10429) return 62846 + (taxable - 3142) * 40;
  return 354330 + (taxable - 10429) * 45;
}

export function monthOneTax(taxablePayment) {
  return pounds(monthOneTaxPence(readAmount(taxablePayment)));
}

export function compareWithdrawals({ cash, crystallised, otherIncome, lsaUsed, mpaaAlreadyActive = false }) {
  const gross = readAmount(cash);
  const designated = readAmount(crystallised);
  const income = readAmount(otherIncome);
  const lsaAvailable = positive(pence(PARAMETERS.lumpSumAllowance) - readAmount(lsaUsed));
  if (gross > designated) throw new RangeError('The amount crystallised must cover the gross cash requested.');
  const taxBefore = annualTaxPence(income);

  function estimate(taxFree, mpaaTriggered) {
    const taxable = gross - taxFree;
    const grossIncome = income + taxable;
    const annualTax = annualTaxPence(grossIncome) - taxBefore;
    const withholding = monthOneTaxPence(taxable);
    const taperSlice = positive(
      Math.min(grossIncome, pence(PARAMETERS.additionalThreshold)) - Math.max(income, pence(PARAMETERS.taperStarts))
    );
    return {
      taxFree: pounds(taxFree),
      taxable: pounds(taxable),
      lsaRemaining: pounds(lsaAvailable - taxFree),
      annualTax: pounds(annualTax),
      withholding: pounds(withholding),
      overpayment: pounds(positive(withholding - annualTax)),
      shortfall: pounds(positive(annualTax - withholding)),
      cashNow: pounds(gross - withholding),
      cashAfterAnnualTax: pounds(gross - annualTax),
      taperSlice: pounds(taperSlice),
      mpaaTriggered,
      mpaaStatus: mpaaAlreadyActive ? 'already-active' : mpaaTriggered ? 'triggered' : 'not-triggered'
    };
  }

  const pcls = Math.min(gross, Math.floor(designated / 4), lsaAvailable);
  const ufplsTaxFree = Math.min(Math.floor(gross / 4), lsaAvailable);
  return {
    drawdown: { ...estimate(pcls, gross > pcls), fundsLeftInDrawdown: pounds(designated - gross) },
    ufpls: estimate(ufplsTaxFree, gross > 0)
  };
}
