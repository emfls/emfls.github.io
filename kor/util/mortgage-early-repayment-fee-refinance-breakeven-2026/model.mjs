export const FEE_WINDOW_DAYS = 1095;
export const REFORM_RATE = 0.65;

function requireRange(value, min, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError('입력값이 계산 범위를 벗어났습니다.');
  }
}

export function estimateElapsedDays(months) {
  requireRange(months, 0);
  return Math.min(months, 36) * FEE_WINDOW_DAYS / 36;
}

export function stampDutyShare(amount) {
  requireRange(amount, 0);
  if (amount <= 50_000_000) return 0;
  if (amount <= 100_000_000) return 35_000;
  if (amount <= 1_000_000_000) return 75_000;
  return 175_000;
}

export function calculateFee({ balance, repayment, rate, elapsedDays, waiverRate = 0, availableWaiver }) {
  requireRange(balance, 0);
  requireRange(repayment, 0, balance);
  requireRange(rate, 0, 100);
  requireRange(elapsedDays, 0);
  requireRange(waiverRate, 0, 100);
  if (availableWaiver !== undefined) requireRange(availableWaiver, 0);

  const remainingDays = Math.max(0, FEE_WINDOW_DAYS - elapsedDays);
  const waivedPrincipal = Math.min(repayment, availableWaiver ?? balance * waiverRate / 100);
  const chargeablePrincipal = repayment - waivedPrincipal;
  const amount = Math.round(chargeablePrincipal * (rate / 100) * (remainingDays / FEE_WINDOW_DAYS));
  return { amount, remainingDays, waivedPrincipal, chargeablePrincipal };
}

export function monthlyPayment(balance, annualRate, months) {
  requireRange(balance, 0);
  requireRange(annualRate, 0, 100);
  requireRange(months, 1, 600);
  if (!Number.isInteger(months)) throw new RangeError('남은 상환기간은 개월 단위 정수여야 합니다.');

  const rate = annualRate / 1200;
  if (rate === 0) return balance / months;
  return balance * (rate / -Math.expm1(-months * Math.log1p(rate)));
}

export function calculateRefinance({
  balance, oldRate, newRate, termMonths, elapsedDays, feeRate, legacyRate = 1.4,
  waiverRate = 0, availableWaiver, bondCost, otherCost = 0
}) {
  requireRange(balance, 1, 10_000_000_000);
  requireRange(bondCost, 0, 10_000_000_000);
  requireRange(otherCost, 0, 10_000_000_000);

  const feeInputs = { balance, repayment: balance, elapsedDays, waiverRate, availableWaiver };
  const fee = calculateFee({ ...feeInputs, rate: feeRate });
  const reformFee = calculateFee({ ...feeInputs, rate: REFORM_RATE }).amount;
  const legacyFee = calculateFee({ ...feeInputs, rate: legacyRate }).amount;
  const stampCost = stampDutyShare(balance);
  const upfrontCost = fee.amount + stampCost + bondCost + otherCost;
  const oldPayment = monthlyPayment(balance, oldRate, termMonths);
  const newPayment = monthlyPayment(balance, newRate, termMonths);
  const firstMonthInterestSavings = balance * (oldRate - newRate) / 1200;
  const estimatedBreakEven = firstMonthInterestSavings > 0
    ? upfrontCost / firstMonthInterestSavings
    : upfrontCost === 0 && oldRate === newRate ? 0 : null;

  const points = [{ month: 0, net: -upfrontCost }];
  const oldMonthlyRate = oldRate / 1200;
  const newMonthlyRate = newRate / 1200;
  let oldBalance = balance;
  let newBalance = balance;
  let net = -upfrontCost;
  let breakEvenMonth = upfrontCost === 0 && oldRate >= newRate ? 0 : null;

  for (let month = 1; month <= termMonths; month++) {
    const oldInterest = oldBalance * oldMonthlyRate;
    const newInterest = newBalance * newMonthlyRate;
    net += oldInterest - newInterest;
    oldBalance -= oldPayment - oldInterest;
    newBalance -= newPayment - newInterest;
    points.push({ month, net });
    if (breakEvenMonth === null && oldRate > newRate && net >= -0.000001) {
      breakEvenMonth = month;
    }
  }

  return {
    fee, reformFee, legacyFee, feeDifference: legacyFee - reformFee, stampCost, upfrontCost,
    oldPayment, newPayment, monthlyPaymentSavings: oldPayment - newPayment,
    firstMonthInterestSavings, estimatedBreakEven, breakEvenMonth,
    threeYearNet: points[Math.min(36, termMonths)].net, maturityNet: net, points
  };
}
