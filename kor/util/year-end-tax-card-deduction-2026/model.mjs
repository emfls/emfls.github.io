// Monetary values in the model are won. Tax rates use parts per thousand.
export const CULTURE_SALARY_LIMIT = 70_000_000;

export function toWon(amountInTenThousandWon) {
  return Math.round(Number(amountInTenThousandWon) * 10_000);
}

export function calculateCard({
  salary = 0, credit = 0, debit = 0, market = 0, transit = 0, culture = 0, limitChildren = 0,
} = {}) {
  const cultureEligible = salary <= CULTURE_SALARY_LIMIT;
  // Above the salary limit, classify cultural purchases by their actual payment method.
  const culturalSpending = cultureEligible ? culture : 0;
  const total = credit + debit + market + transit + culturalSpending;
  const threshold = salary / 4;
  const remaining = Math.max(0, threshold - total);
  const excess = Math.max(0, total - threshold);
  const baseLimit = cultureEligible
    ? 3_000_000 + Math.min(2, limitChildren) * 500_000
    : 2_500_000 + Math.min(2, limitChildren) * 250_000;
  const additionalLimit = cultureEligible ? 3_000_000 : 2_000_000;

  // The legal threshold subtraction uses the 15%, 30%, and 40% tiers in order.
  const thirtyPercent = debit + culturalSpending;
  const fortyPercent = market + transit;
  const thresholdAt15 = Math.min(threshold, credit);
  const thresholdAt30 = Math.min(threshold - thresholdAt15, thirtyPercent);
  const thresholdAt40 = Math.min(threshold - thresholdAt15 - thresholdAt30, fortyPercent);
  const weightedExcess = (credit - thresholdAt15) * 15
    + (thirtyPercent - thresholdAt30) * 30 + (fortyPercent - thresholdAt40) * 40;
  const rawDeduction = salary > 0 ? Math.floor(weightedExcess / 100) : 0;
  const baseDeduction = Math.min(rawDeduction, baseLimit);

  // Article 126-2(11) uses the gross category deductions for this cap,
  // while the deduction above the base cap is already net of the threshold.
  const specialDeduction = Math.floor((culturalSpending * 30 + fortyPercent * 40) / 100);
  const additionalDeduction = Math.min(rawDeduction - baseDeduction, specialDeduction, additionalLimit);
  return {
    total, threshold, remaining, excess, baseLimit, additionalLimit,
    baseDeduction, additionalDeduction, deduction: baseDeduction + additionalDeduction,
  };
}

export function calculateFamily({ marriagePeople = 0, creditChildren = 0 } = {}) {
  const marriage = marriagePeople * 500_000;
  const children = creditChildren === 0 ? 0 : creditChildren === 1 ? 250_000
    : 550_000 + (creditChildren - 2) * 400_000;
  return { marriage, children, total: marriage + children };
}

export function estimateTax(deduction, rate) {
  return Math.floor(deduction * rate / 1_000);
}

export function calculatePlan({
  rate, budget = 0, gymShare = 100, credit = 0, debit = 0, market = 0, culture = 0, ...facts
}) {
  const spending = { ...facts, credit, debit, market, culture };
  const card = calculateCard(spending);
  const family = calculateFamily(facts);
  const cardSavings = estimateTax(card.deduction, rate);
  const gymCulture = facts.salary <= CULTURE_SALARY_LIMIT ? Math.floor(budget * gymShare / 100) : 0;
  const addedSavings = (additional) =>
    estimateTax(calculateCard({ ...spending, ...additional }).deduction, rate) - cardSavings;
  const scenarios = {
    debit: addedSavings({ debit: debit + budget }),
    market: addedSavings({ market: market + budget }),
    gym: addedSavings({ culture: culture + gymCulture, debit: debit + budget - gymCulture }),
  };
  const maxAdditional = Math.max(...Object.values(scenarios));
  const totalSavings = cardSavings + family.total;
  const plannedCredit = Math.min(budget, Math.floor(card.remaining));
  return {
    card, family, cardSavings, scenarios, maxAdditional, totalSavings,
    projectedSavings: totalSavings + maxAdditional,
    generalSplit: { credit: plannedCredit, debit: budget - plannedCredit },
  };
}
