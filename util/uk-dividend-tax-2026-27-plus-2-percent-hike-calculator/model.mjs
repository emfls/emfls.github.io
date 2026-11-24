const PENCE = 100;
const BASIS_POINTS = 10000;
const MAX_AMOUNT = 100000000;
const PERSONAL_ALLOWANCE = 12570 * PENCE;
const TAPER_START = 100000 * PENCE;
const DIVIDEND_ALLOWANCE = 500 * PENCE;
const BASIC_LIMIT = 37700 * PENCE;
const HIGHER_LIMIT = 125140 * PENCE;
const ISA_LIMIT = 20000;

const rates2026 = [0, 0, 1075, 3575, 3935];
const rates2025 = [0, 0, 875, 3375, 3935];

function toHundredths(value, name, max = MAX_AMOUNT) {
  const scaled = Math.round(value * PENCE);
  if (!Number.isFinite(value) || value < 0 || value > max || scaled / PENCE !== value) {
    throw new RangeError(`${name} must be between 0 and ${max}, with up to two decimal places.`);
  }
  return scaled;
}

function allocate(otherIncome, dividends, relief) {
  const adjustedNetIncome = otherIncome + dividends - relief;
  const taper = Math.floor(Math.max(0, adjustedNetIncome - TAPER_START) / (2 * PENCE)) * PENCE;
  const personalAllowance = Math.max(0, PERSONAL_ALLOWANCE - taper);
  const dividendPA = Math.min(dividends, Math.max(0, personalAllowance - otherIncome));
  const zeroRateDividends = Math.min(DIVIDEND_ALLOWANCE, dividends - dividendPA);

  // The dividend nil rate occupies the first slice above the Personal Allowance.
  const start = Math.max(0, otherIncome - personalAllowance) + zeroRateDividends;
  const end = start + dividends - dividendPA - zeroRateDividends;
  const basicLimit = BASIC_LIMIT + relief;
  const higherLimit = HIGHER_LIMIT + relief;
  const basic = Math.max(0, Math.min(end, basicLimit) - start);
  const higher = Math.max(0, Math.min(end, higherLimit) - Math.max(start, basicLimit));
  const additional = Math.max(0, end - Math.max(start, higherLimit));
  return {
    adjustedNetIncome,
    personalAllowance,
    amounts: [dividendPA, zeroRateDividends, basic, higher, additional],
  };
}

function bandTaxes(amounts, rates) {
  // HMRC rounds each band's tax down to the penny.
  return amounts.map((amount, index) => Math.floor(amount * rates[index] / BASIS_POINTS));
}

function totalTax(taxes) {
  return taxes.reduce((total, tax) => total + tax, 0);
}

/**
 * Annual UK dividend-only estimate. Monetary inputs are pounds and transferYield is a
 * percentage. grossRelief is eligible gross Gift Aid and relief-at-source pension only.
 */
export function calculateDividendTax({
  otherIncome = 0, interest = 0, dividends = 0, isaDividends = 0, grossRelief = 0,
  portfolioValue = 0, transferValue = 0, isaHeadroom = 0, transferYield = 0,
} = {}) {
  const other = toHundredths(otherIncome, 'Other income') + toHundredths(interest, 'Savings interest');
  const outside = toHundredths(dividends, 'Outside-ISA dividends');
  const inside = toHundredths(isaDividends, 'ISA dividends');
  const relief = toHundredths(grossRelief, 'Gross contribution');
  const portfolio = toHundredths(portfolioValue, 'Portfolio value');
  const transfer = Math.min(toHundredths(transferValue, 'Holdings to move'),
    toHundredths(isaHeadroom, 'Unused ISA allowance', ISA_LIMIT));
  const yieldBps = toHundredths(transferYield, 'Transfer yield', 100);
  const shiftedDividends = Math.min(outside, Math.round(transfer * yieldBps / BASIS_POINTS));

  const current = allocate(other, outside, relief);
  const currentBandTaxes = bandTaxes(current.amounts, rates2026);
  const tax2026 = totalTax(currentBandTaxes);
  const tax2025 = totalTax(bandTaxes(current.amounts, rates2025));
  const taxWithoutIsa = totalTax(bandTaxes(allocate(other, outside + inside, relief).amounts, rates2026));
  const taxAfterTransfer = totalTax(bandTaxes(allocate(other, outside - shiftedDividends, relief).amounts, rates2026));
  const netDividends = outside + inside - tax2026;

  return {
    adjustedNetIncome: current.adjustedNetIncome / PENCE,
    personalAllowance: current.personalAllowance / PENCE,
    tax2026: tax2026 / PENCE,
    tax2025: tax2025 / PENCE,
    hike: (tax2026 - tax2025) / PENCE,
    isaSavings: (taxWithoutIsa - tax2026) / PENCE,
    netDividends: netDividends / PENCE,
    netYield: portfolio > 0 ? (netDividends * 100) / portfolio : null,
    bands: current.amounts.map((amount, index) => ({
      amount: amount / PENCE,
      tax: currentBandTaxes[index] / PENCE,
    })),
    bedAndIsa: {
      transfer: transfer / PENCE,
      shiftedDividends: shiftedDividends / PENCE,
      tax: taxAfterTransfer / PENCE,
      savings: (tax2026 - taxAfterTransfer) / PENCE,
    },
  };
}
