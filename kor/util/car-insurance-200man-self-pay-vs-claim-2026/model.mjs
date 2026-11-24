export const defaults = Object.freeze({
  annualPremium: 900_000,
  threshold: 2_000_000,
  otherRepair: 800_000,
  ownRepair: 700_000,
  deductibleRate: 20,
  minimumDeductible: 200_000,
  priorAccidents: 0,
  discountRate: 6,
  halfSurchargeRate: 10,
  fullSurchargeRate: 22,
  priorSurchargeRate: 15,
});

const thresholds = [500_000, 1_000_000, 1_500_000, 2_000_000];
const rateFields = ['discountRate', 'halfSurchargeRate', 'fullSurchargeRate', 'priorSurchargeRate'];

export function calculate(input = defaults) {
  const {
    annualPremium, threshold, otherRepair, ownRepair, deductibleRate,
    minimumDeductible, priorAccidents, discountRate, halfSurchargeRate,
    fullSurchargeRate, priorSurchargeRate,
  } = input;
  const amounts = [annualPremium, otherRepair, ownRepair];
  if (annualPremium === 0 || amounts.some(value => !Number.isSafeInteger(value) || value < 0 || value > 100_000_000)
    || !thresholds.includes(threshold) || ![0, 1, 2].includes(priorAccidents)
    || ![20, 30].includes(deductibleRate) || !thresholds.some(value => value / 10 === minimumDeductible)
    || rateFields.some(key => !Number.isFinite(input[key]) || input[key] < 0 || input[key] > 100)) {
    throw new RangeError('계산 범위를 벗어난 입력값입니다.');
  }

  // 자차 지급액이 음수가 되지 않도록 실제 수리비까지만 부담한다.
  const deductible = Math.min(ownRepair, 500_000, Math.max(minimumDeductible, Math.round(ownRepair * deductibleRate / 100)));
  const selfPayCost = otherRepair + ownRepair;
  const payout = selfPayCost - deductible;
  const score = payout === 0 ? 0 : payout > threshold ? 1 : 0.5;
  const priorRate = priorAccidents > 0 ? priorSurchargeRate : 0;
  const halfRate = halfSurchargeRate + priorRate;
  const fullRate = fullSurchargeRate + priorRate;
  const effectiveSurchargeRate = score === 0 ? 0 : score === 0.5 ? halfRate : fullRate;
  const annualSurcharge = rate => Math.round(annualPremium * rate / 100);

  const years = [1, 2, 3].map(year => {
    const selfPayPremium = Math.round(annualPremium * (1 - discountRate / 100) ** year);
    const claimPremium = payout > 0 ? annualPremium + annualSurcharge(effectiveSurchargeRate) : selfPayPremium;
    return { year, selfPayPremium, claimPremium, premiumDifference: claimPremium - selfPayPremium };
  });
  const projectedDiscount = years.reduce((sum, year) => sum + annualPremium - year.selfPayPremium, 0);
  const breakEvenByScore = {
    half: 3 * annualSurcharge(halfRate) + projectedDiscount,
    full: 3 * annualSurcharge(fullRate) + projectedDiscount,
  };
  const surchargeCost = 3 * annualSurcharge(effectiveSurchargeRate);
  const lostDiscountCost = payout > 0 ? projectedDiscount : 0;
  const premiumSavings = surchargeCost + lostDiscountCost;
  const claimCost = deductible + premiumSavings;
  const difference = payout - premiumSavings;
  const choice = difference > 0 ? 'claim' : difference < 0 ? 'selfPay' : 'tie';
  const repaymentChoice = payout === 0 ? 'none' : difference > 0 ? 'keep' : difference < 0 ? 'repay' : 'tie';

  return {
    deductible, selfPayCost, payout, score, effectiveSurchargeRate,
    years, breakEvenByScore, surchargeCost, lostDiscountCost, premiumSavings,
    claimCost, difference, choice, repaymentChoice,
    repaymentPrincipal: payout,
    repaymentCost: deductible + payout,
  };
}
