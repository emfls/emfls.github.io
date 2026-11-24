// Monetary inputs and outputs are whole won. Rates are percentages.
const MAX_WON = 1_000_000_000_000;

const BRACKETS = [
  [14_000_000, 6, 0],
  [50_000_000, 15, 1_260_000],
  [88_000_000, 24, 5_760_000],
  [150_000_000, 35, 15_440_000],
  [300_000_000, 38, 19_940_000],
  [500_000_000, 40, 25_940_000],
  [1_000_000_000, 42, 35_940_000],
  [Infinity, 45, 65_940_000]
];

function bounded(value, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(0, number)) : 0;
}

function wholeWon(value) {
  return Math.floor(bounded(value, MAX_WON));
}

export function toWon(manwon) {
  return Math.round(bounded(manwon, MAX_WON / 10_000) * 10_000);
}

export function incomeTax(taxableIncome) {
  const base = wholeWon(taxableIncome);
  const [, rate, deduction] = BRACKETS.find(([ceiling]) => base <= ceiling);
  return Math.floor(base * rate / 100) - deduction;
}

export function yellowUmbrellaLimit(businessIncome) {
  if (businessIncome <= 40_000_000) return 6_000_000;
  if (businessIncome <= 60_000_000) return 5_000_000;
  if (businessIncome <= 100_000_000) return 4_000_000;
  return 2_000_000;
}

export function calculate(input = {}) {
  const revenue = wholeWon(input.revenue);
  const simpleRate = Math.round(bounded(input.simpleRate, 100) * 100);
  const basisRate = Math.round(bounded(input.basisRate, 100) * 100);
  const personalDeduction = Math.max(1, Math.floor(bounded(input.people, 100))) * 1_500_000;
  const nationalPension = wholeWon(input.nationalPension);
  const umbrellaPaid = wholeWon(input.yellowUmbrella);
  const pensionEligible = Math.min(9_000_000,
    Math.min(wholeWon(input.pensionSavings), 6_000_000) + wholeWon(input.irp));
  const standardCredit = input.standardCredit === false ? 0 : 70_000;
  const withheldNational = Math.floor(revenue * 3 / 100);
  const withheldLocal = Math.floor(revenue * 3 / 1000);
  const withheld = { national: withheldNational, local: withheldLocal, total: withheldNational + withheldLocal };

  const simpleIncome = revenue - Math.floor(revenue * simpleRate / 10_000);
  const basisExpenses = Math.floor(revenue * basisRate / (input.requiredDoubleEntry ? 20_000 : 10_000));
  const basisCandidate = revenue - wholeWon(input.majorExpenses) - basisExpenses;
  const basisCeiling = Math.floor(simpleIncome * (input.requiredDoubleEntry ? 34 : 28) / 10);
  const basisIncome = Math.max(0, Math.min(basisCandidate, basisCeiling));
  const bookIncome = revenue - wholeWon(input.bookExpenses);

  function settle(businessIncome, qualifiesForBookCredit) {
    // Each scenario uses its own business income for the credit threshold and deduction cap.
    const umbrellaDeduction = Math.min(umbrellaPaid, yellowUmbrellaLimit(businessIncome), Math.max(0, businessIncome));
    const taxableIncome = Math.max(0, businessIncome - personalDeduction - nationalPension - umbrellaDeduction);
    const grossTax = incomeTax(taxableIncome);
    const pensionRate = businessIncome <= 45_000_000 ? 15 : 12;
    const pensionCredit = Math.floor(pensionEligible * pensionRate / 100);
    const bookCredit = qualifiesForBookCredit ? Math.min(1_000_000, Math.floor(grossTax / 5)) : 0;
    const appliedCredits = Math.min(grossTax, standardCredit + pensionCredit + bookCredit);
    const national = grossTax - appliedCredits;
    const local = Math.floor(national / 10);
    const total = national + local;
    return {
      businessIncome, personalDeduction, nationalPension, umbrellaDeduction, taxableIncome,
      grossTax, pensionRate, pensionCredit, bookCredit, standardCredit, appliedCredits,
      national, local, total, balance: total - withheld.total
    };
  }

  return {
    withheld,
    simple: settle(simpleIncome, false),
    basis: settle(basisIncome, false),
    book: settle(bookIncome, input.doubleEntry && !input.requiredDoubleEntry)
  };
}
