export const GENERAL_CAP = 2_100_000;
export const PREVIOUS_GENERAL_CAP = 2_000_000;
export const CAP_STEP = GENERAL_CAP - PREVIOUS_GENERAL_CAP;
const MAX_INPUT = 100_000_000;

function cents(value, label, min = 0, max = MAX_INPUT) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min.toLocaleString('en-AU')} and ${max.toLocaleString('en-AU')}.`);
  }
  const scaled = Math.round(value * 100);
  if (scaled / 100 !== value) {
    throw new RangeError(`${label} must have at most two decimal places.`);
  }
  return scaled;
}

export function calculateCap({
  firstTime, highestEverTBA, personalCapAtPeak, personalCapBeforeJul2026, everReachedCap = false,
}) {
  if (firstTime) return { personalCap: GENERAL_CAP, unusedPercent: null, increment: null };

  const before = cents(personalCapBeforeJul2026, 'Pre-indexation personal cap', 1_600_000, PREVIOUS_GENERAL_CAP);
  const atPeak = cents(personalCapAtPeak, 'Personal cap at the peak', 1_600_000, personalCapBeforeJul2026);
  const peak = cents(highestEverTBA, 'Highest ever transfer balance');

  // The ATO floors the percentage used before subtracting it from 100.
  const unusedPercent = everReachedCap || peak >= atPeak ? 0 : 100 - Math.floor(100 * peak / atPeak);
  const increment = unusedPercent * (CAP_STEP / 100);
  return { personalCap: (before + increment * 100) / 100, unusedPercent, increment };
}

function validateAge(age) {
  if (!Number.isInteger(age) || age < 0 || age > 120) {
    throw new RangeError('Age on 1 July must be a whole number from 0 to 120.');
  }
}

function drawdownRate(age) {
  if (age >= 95) return 14;
  if (age >= 90) return 11;
  if (age >= 85) return 9;
  if (age >= 80) return 7;
  if (age >= 75) return 6;
  if (age >= 65) return 5;
  return 4;
}

function roundedMinimum(balanceCents, rate) {
  // $10 × 100 cents × 100 for the percentage denominator. Add half to round ties up.
  return 10 * Math.floor((balanceCents * rate + 50_000) / 100_000);
}

export function minimumDrawdown(balance, age) {
  validateAge(age);
  const rate = drawdownRate(age);
  return { annual: roundedMinimum(cents(balance, 'Pension balance'), rate), rate };
}

export function projectPension(balance, age, annualReturn, newPensionBalance = 0) {
  validateAge(age);
  const returnBps = cents(annualReturn, 'Annual return (%)', -100, 20);
  let balances = [cents(balance, 'Pension balance'), cents(newPensionBalance, 'New pension balance')];
  return Array.from({ length: 25 }, (_, i) => {
    const opening = (balances[0] + balances[1]) / 100;
    const rate = drawdownRate(age + i);
    let annual = 0;
    balances = balances.map((openingCents) => {
      const minimum = roundedMinimum(openingCents, rate);
      annual += minimum;
      const growthCents = Math.round(openingCents * returnBps / 10_000);
      return Math.max(0, openingCents + growthCents - minimum * 100);
    });
    const closing = (balances[0] + balances[1]) / 100;
    return { year: 2026 + i, age: age + i, rate, opening, annual, closing };
  });
}

export function calculateScenario(input) {
  const cap = calculateCap(input);
  const total = cents(input.totalSuper, 'Total super balance');
  const existing = input.firstTime ? 0 : cents(input.pensionBeforeTransfer, 'Existing pension balance', 0, input.totalSuper);
  const current = input.firstTime ? 0 : cents(input.currentTBA, 'Current transfer balance', -MAX_INPUT, input.highestEverTBA);
  const capCents = Math.round(cap.personalCap * 100);
  const availableCap = Math.max(0, capCents - current);
  const excess = Math.max(0, current - capCents);
  const transfer = input.firstTime || input.addTransfer !== false
    ? Math.min(total - existing, availableCap)
    : 0;
  const pension = (existing + transfer) / 100;
  const projection = projectPension(existing / 100, input.age, input.annualReturn, transfer / 100);
  const { annual, rate } = projection[0];
  return {
    ...cap,
    availableCap: availableCap / 100,
    excess: excess / 100,
    transfer: transfer / 100,
    pension,
    accumulation: (total - existing - transfer) / 100,
    annual,
    rate,
    monthly: annual / 12,
    fortnightly: annual / 26,
    projection,
  };
}
