export const OAS_THRESHOLD = 95_323;
export const OAS_RECOVERY_RATE = 0.15;
export const MIN_AGE = 55;
export const MAX_LTV = 0.55;

const AGE_CURVE = [[55, 0.15], [62, 0.25], [68, 0.33], [74, 0.42], [80, MAX_LTV]];
const PROPERTY_ADJUSTMENT = { detached: 0, condo: 0.03 };
const MARKET_ADJUSTMENT = { metro: 0, regional: 0.02, rural: 0.07 };
const MONEY_LIMIT = 100_000_000;

function between(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
}

export function estimateLtv({ age, property, market }) {
  between(age, 0, 125, 'Youngest age');
  if (!Number.isInteger(age)) throw new RangeError('Enter age in whole years.');
  if (!Object.hasOwn(PROPERTY_ADJUSTMENT, property) || !Object.hasOwn(MARKET_ADJUSTMENT, market)) {
    throw new RangeError('Choose a listed property type and market.');
  }
  if (age < MIN_AGE) return 0;

  let baseLtv = MAX_LTV;
  for (let index = 1; index < AGE_CURVE.length; index += 1) {
    const [upperAge, upperLtv] = AGE_CURVE[index];
    if (age < upperAge) {
      const [lowerAge, lowerLtv] = AGE_CURVE[index - 1];
      const fraction = (age - lowerAge) / (upperAge - lowerAge);
      baseLtv = lowerLtv + fraction * (upperLtv - lowerLtv);
      break;
    }
  }

  return baseLtv - PROPERTY_ADJUSTMENT[property] - MARKET_ADJUSTMENT[market];
}

export function estimateCapacity({ age, property, market, homeValue, payoff, costs, requestedCash = null }) {
  between(homeValue, 0.01, MONEY_LIMIT, 'Home value');
  between(payoff, 0, MONEY_LIMIT, 'Mortgage payoff');
  between(costs, 0, MONEY_LIMIT, 'Setup costs');
  if (requestedCash !== null) between(requestedCash, 0, MONEY_LIMIT, 'Cash requested');

  const ltv = estimateLtv({ age, property, market });
  // Work in cents so the estimate never lends above the modeled capacity.
  const homeCents = Math.round(homeValue * 100);
  const grossCents = Math.floor(homeCents * ltv + 1e-6);
  const requiredCents = Math.round(payoff * 100) + Math.round(costs * 100);
  const netCents = Math.max(0, grossCents - requiredCents);
  const cashCents = requestedCash === null ? netCents : Math.min(netCents, Math.round(requestedCash * 100));
  const principalCents = requiredCents + cashCents;
  const canFund = age >= MIN_AGE && requiredCents <= grossCents;

  return {
    ageEligible: age >= MIN_AGE,
    ltv,
    gross: grossCents / 100,
    netCash: netCents / 100,
    cashDraw: cashCents / 100,
    openingBalance: canFund && principalCents > 0 ? principalCents / 100 : null,
    fundingShortfall: Math.max(0, requiredCents - grossCents) / 100,
  };
}

export function compareWithdrawal({ targetCash, income, taxRate, annualOas, annualGis, gisRate }) {
  between(targetCash, 0, MONEY_LIMIT, 'Cash to compare');
  between(income, -MONEY_LIMIT, MONEY_LIMIT, 'OAS recovery-test income');
  between(taxRate, 0, 0.75, 'Marginal income-tax rate');
  between(annualOas, 0, MONEY_LIMIT, 'Annual OAS before recovery');
  between(annualGis, 0, MONEY_LIMIT, 'Annual GIS before withdrawal');
  between(gisRate, 0, 0.75, 'Illustrative GIS reduction rate');

  const recovery = totalIncome => Math.min(annualOas, Math.max(0, totalIncome - OAS_THRESHOLD) * OAS_RECOVERY_RATE);
  const existingRecovery = recovery(income);

  function effects(gross) {
    const oasRecovery = recovery(income + gross) - existingRecovery;
    const incomeTax = (gross - oasRecovery) * taxRate; // Approximate the line 23500 deduction.
    const gisLoss = Math.min(annualGis, gross * gisRate);
    const taxAndOas = incomeTax + oasRecovery;
    return { gross, incomeTax, oasRecovery, gisLoss, taxAndOas, netCash: gross - taxAndOas - gisLoss };
  }

  if (targetCash === 0) return effects(0);

  // Net cash is linear between the points where a benefit reduction starts or ends.
  const breakpoints = [
    OAS_THRESHOLD - income,
    OAS_THRESHOLD + annualOas / OAS_RECOVERY_RATE - income,
    gisRate > 0 ? annualGis / gisRate : 0,
  ].filter(point => point > 0).sort((a, b) => a - b);

  let previous = effects(0);
  for (const point of breakpoints) {
    const next = effects(point);
    if (next.netCash >= targetCash) {
      const fraction = (targetCash - previous.netCash) / (next.netCash - previous.netCash);
      return effects(previous.gross + fraction * (next.gross - previous.gross));
    }
    previous = next;
  }

  return effects(previous.gross + (targetCash - previous.netCash) / (1 - taxRate));
}

export function projectEquity({ homeValue, openingBalance, loanRate, appreciation }) {
  between(homeValue, 0.01, MONEY_LIMIT, 'Home value');
  between(openingBalance, 0, MONEY_LIMIT, 'Opening balance');
  between(loanRate, 0, 0.30, 'Nominal mortgage rate');
  between(appreciation, -0.50, 0.30, 'Annual home appreciation');

  return Array.from({ length: 21 }, (_, year) => {
    const value = homeValue * (1 + appreciation) ** year;
    const balance = openingBalance * (1 + loanRate / 2) ** (2 * year);
    return {
      year,
      homeValue: value,
      balance,
      interest: balance - openingBalance,
      netEquity: Math.max(0, value - balance),
      potentialNneg: Math.max(0, balance - value),
      settlementUnderNneg: Math.min(balance, value),
    };
  });
}
