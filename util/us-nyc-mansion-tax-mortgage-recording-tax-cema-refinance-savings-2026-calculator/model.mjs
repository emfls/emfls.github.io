export const MAX_AMOUNT = 1_000_000_000;

// Minimum purchase price in dollars and rate per $100,000 of taxable value.
const mansionTiers = [
  [0, 0],
  [1_000_000, 1000],
  [2_000_000, 1250],
  [3_000_000, 1500],
  [5_000_000, 2250],
  [10_000_000, 3250],
  [15_000_000, 3500],
  [20_000_000, 3750],
  [25_000_000, 3900],
];

function toCents(amount) {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT || cents / 100 !== amount) {
    throw new RangeError('Enter a dollar amount from 0 to 1 billion with up to two decimal places.');
  }
  return cents;
}

function taxCents(principalCents, rate) {
  return Math.floor((principalCents * rate + 50_000) / 100_000);
}

function mansionTier(priceCents) {
  return mansionTiers.findLastIndex(([floor]) => priceCents >= floor * 100);
}

function mansionCliff(tier) {
  if (tier === 0 || tier === mansionTiers.length) return null;
  const [threshold, rate] = mansionTiers[tier];
  const [, previousRate] = mansionTiers[tier - 1];
  const price = threshold * 100;
  const previousTax = taxCents(price - 1, previousRate);
  return { threshold, increase: (taxCents(price, rate) - previousTax) / 100 };
}

function mrtRate(principalCents) {
  if (principalCents === 0) return 0;
  return principalCents < 50_000_000 ? 1800 : 1925;
}

function mrtCents(principalCents) {
  return taxCents(principalCents, mrtRate(principalCents));
}

export function calculatePurchase({ purchasePrice, loanAmount, isCoop = false }) {
  const price = toCents(purchasePrice);
  const loan = toCents(loanAmount);
  const tier = mansionTier(price);
  const [, rate] = mansionTiers[tier];
  const mansionTax = taxCents(price, rate);
  const condoMrt = mrtCents(loan);
  const purchaseMrt = isCoop ? 0 : condoMrt;
  return {
    mansionTax: mansionTax / 100,
    mansionRate: rate / 1000,
    purchaseMrt: purchaseMrt / 100,
    purchaseMrtRate: isCoop ? 0 : mrtRate(loan) / 1000,
    condoCoopDelta: condoMrt / 100,
    totalBuyerTax: (mansionTax + purchaseMrt) / 100,
    currentCliff: mansionCliff(tier),
    nextCliff: mansionCliff(tier + 1),
  };
}

function minimumSavingBalance(loan, fullTax, fees) {
  if (fullTax <= fees) return null;
  let low = 0;
  let high = loan;
  // Tax falls as assigned principal rises, including when the gap crosses the rate cliff.
  while (low < high) {
    const balance = Math.floor((low + high) / 2);
    if (fullTax - mrtCents(loan - balance) > fees) {
      high = balance;
    } else {
      low = balance + 1;
    }
  }
  return low / 100;
}

export function calculateRefinance({
  newLoanAmount, existingUnpaidPrincipal, cemaBankLegalFees = 1800, isCoop = false,
}) {
  const loan = toCents(newLoanAmount);
  const existing = toCents(existingUnpaidPrincipal);
  const fees = toCents(cemaBankLegalFees);
  if (isCoop) {
    return { gapAmount: null, fullMrt: 0, cemaMrt: 0, cemaFees: 0, netCemaSavings: 0, minimumSavingBalance: null };
  }
  const gap = Math.max(0, loan - existing);
  const fullTax = mrtCents(loan);
  const gapTax = mrtCents(gap);
  return {
    gapAmount: gap / 100,
    fullMrt: fullTax / 100,
    cemaMrt: gapTax / 100,
    cemaFees: fees / 100,
    netCemaSavings: (fullTax - gapTax - fees) / 100,
    minimumSavingBalance: minimumSavingBalance(loan, fullTax, fees),
  };
}
