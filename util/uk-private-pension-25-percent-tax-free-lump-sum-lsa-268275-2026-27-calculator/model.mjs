export const STANDARD_LSA = 268_275;
export const STANDARD_LSDBA = 1_073_100;
export const MPAA = 10_000;
export const MAX_AMOUNT = 1_000_000_000;

const PERSONAL_ALLOWANCE = 12_570;
const TAPER_START = 100_000;
const TAPER_END = 125_140;
const BASIC_BAND = 37_700;

function pence(value, label) {
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT ||
      Math.abs(scaled - rounded) > 0.00002) {
    throw new RangeError(`${label} must be between £0 and £1 billion, to the nearest penny.`);
  }
  return rounded;
}

function taxRateUnits(income) {
  // Work in half-pence before applying rates so the taper stays exact.
  const allowance = Math.max(0, PERSONAL_ALLOWANCE * 200 - Math.max(0, income - TAPER_START * 100));
  const taxable = Math.max(0, income * 2 - allowance);
  return (
    Math.min(taxable, BASIC_BAND * 200) * 20 +
    Math.max(0, Math.min(taxable, TAPER_END * 200) - BASIC_BAND * 200) * 40 +
    Math.max(0, taxable - TAPER_END * 200) * 45
  );
}

export function annualIncomeTax(income) {
  return Math.round(taxRateUnits(pence(income, 'Annual income')) / 200) / 100;
}

export function calculateWithdrawal({
  pot, amount, priorLsaUsed = 0, lsaLimit = STANDARD_LSA,
  priorLsdbaUsed = priorLsaUsed, lsdbaLimit = STANDARD_LSDBA,
  method, taxableDrawdown = 0, otherIncome = 0,
}) {
  if (method !== 'pcls_drawdown' && method !== 'ufpls') {
    throw new RangeError('Choose PCLS with drawdown or UFPLS.');
  }

  const isPcls = method === 'pcls_drawdown';
  const potPence = pence(pot, 'Pension pot');
  const amountPence = pence(amount, 'Amount crystallising or withdrawing');
  const lsa = Math.max(0, pence(lsaLimit, 'LSA') - pence(priorLsaUsed, 'Prior LSA used'));
  const lsdba = Math.max(0, pence(lsdbaLimit, 'LSDBA') - pence(priorLsdbaUsed, 'Prior LSDBA used'));
  const income = pence(otherIncome, 'Other annual income');

  if (amountPence > potPence) throw new RangeError('Enter an amount no higher than the total pension pot.');

  const quarter = Math.floor(amountPence / 4);
  const taxFree = Math.min(quarter, lsa, lsdba);
  const taxable = isPcls ? pence(taxableDrawdown, 'Taxable drawdown') : amountPence - taxFree;
  if (taxable > amountPence - taxFree) {
    throw new RangeError('Taxable drawdown cannot exceed the amount moved into drawdown after the tax-free lump sum.');
  }

  const combined = income + taxable;
  const tax = Math.round((taxRateUnits(combined) - taxRateUnits(income)) / 200);
  const taperIncome = Math.max(0, Math.min(combined, TAPER_END * 100) - Math.max(income, TAPER_START * 100));

  return {
    taxFreeLumpSum: taxFree / 100,
    remainingLsa: (lsa - taxFree) / 100,
    remainingLsdba: (lsdba - taxFree) / 100,
    cappedTaxFreeAmount: (quarter - taxFree) / 100,
    taxableIncome: taxable / 100,
    incomeTax: tax / 100,
    incomeInTaperBand: taperIncome / 100,
    extraTaxFromTaper: Math.round(taperIncome / 5) / 100,
    netCash: (taxFree + taxable - tax) / 100,
    pensionRemaining: (potPence - taxFree - taxable) / 100,
    mpaaTriggered: taxable > 0,
    emergencyPayeWarning: taxable > 0,
  };
}
