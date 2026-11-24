export const CASH_YIELD = 0.04;
export const TARGET_RETURN = 0.07;
const GUARDRAIL_DRAWDOWN = 0.15;

// Historical S&P 500 total returns, rounded to one decimal point as published
// in Berkshire Hathaway's 2024 annual report. All later returns are synthetic.
export const SCENARIOS = Object.freeze({
  CUSTOM_BEAR_FIRST: Object.freeze([-.25, -.15, -.10]),
  EARLY_CRASH_2000: Object.freeze([-.091, -.119, -.221]),
  EARLY_CRASH_2008: Object.freeze([-.37, .265, .151]),
  STAGFLATION_1973: Object.freeze([-.148, -.264, .372])
});

export const DEFAULTS = Object.freeze({
  portfolio: 665_000,
  withdrawal: 26_600,
  inflation: .025,
  years: 30,
  scenario: 'CUSTOM_BEAR_FIRST',
  guardrailCut: .10,
  cashYears: 3
});

function validateReturns(returns) {
  if (!Array.isArray(returns) || !returns.length ||
      !Array.from(returns).every(rate => Number.isFinite(rate) && rate > -1)) {
    throw new RangeError('Each annual return must be finite and greater than −100%.');
  }
}

export function buildReturns(scenario, years, customShocks = SCENARIOS.CUSTOM_BEAR_FIRST) {
  if (!Object.hasOwn(SCENARIOS, scenario) || !Number.isInteger(years) || years < 4 || years > 60) {
    throw new RangeError('Choose a scenario and a horizon from 4 through 60 years.');
  }
  const custom = scenario === 'CUSTOM_BEAR_FIRST';
  if (custom && (!Array.isArray(customShocks) || customShocks.length !== 3 ||
      !Array.from(customShocks).every(rate => Number.isFinite(rate) && rate >= -.95 && rate <= 0))) {
    throw new RangeError('Enter three custom returns between −95% and 0%.');
  }
  const opening = custom ? customShocks : SCENARIOS[scenario];
  // The default illustration models 13 years of modest recovery before the
  // stronger years. Scale this phase with the horizon and retain a recovery year.
  const moderateYears = custom ? Math.floor((years - 3) * 13 / 27) : 0;
  const early = [...opening, ...Array(moderateYears).fill(.05)];
  const earlyLogGrowth = early.reduce((sum, rate) => sum + Math.log1p(rate), 0);
  const recoveryYears = years - early.length;
  const recovery = Math.expm1((years * Math.log1p(TARGET_RETURN) - earlyLogGrowth) / recoveryYears);
  return [...early, ...Array(recoveryYears).fill(recovery)];
}

export function geometricMean(returns) {
  validateReturns(returns);
  return Math.expm1(returns.reduce((sum, rate) => sum + Math.log1p(rate), 0) / returns.length);
}

export function simulate({ portfolio, withdrawal, inflation, returns, strategy = 'fixed',
  guardrailCut = DEFAULTS.guardrailCut, cashYears = DEFAULTS.cashYears }) {
  validateReturns(returns);
  if (![portfolio, withdrawal, inflation, guardrailCut, cashYears].every(Number.isFinite) ||
      portfolio <= 0 || withdrawal < 0 || inflation <= -1 || guardrailCut < 0 ||
      guardrailCut >= 1 || cashYears < 0 || cashYears > 5 ||
      !['fixed', 'guardrails', 'cashBucket'].includes(strategy)) {
    throw new RangeError('Enter valid portfolio, spending, inflation and strategy settings.');
  }
  const bucket = strategy === 'cashBucket' && cashYears > 0;
  let cash = bucket ? Math.min(portfolio, withdrawal * cashYears) : 0;
  let equity = portfolio - cash;
  let scheduled = withdrawal;
  let depletionYear = null;
  let firstShortfallYear = null;
  const rows = [{ year: 0, rate: null, equity, cash, endingBalance: portfolio, scheduled: 0,
    withdrawn: 0, shortfall: 0, cut: false, cashWithdrawal: 0, refill: 0 }];
  const roundingTolerance = portfolio * 1e-12;

  returns.forEach((rate, index) => {
    const year = index + 1;
    if (index > 0) scheduled *= 1 + inflation;
    equity *= 1 + rate;
    cash *= 1 + CASH_YIELD;
    const available = equity + cash;
    const baseline = portfolio * (1 + inflation) ** index;
    const cut = strategy === 'guardrails' && guardrailCut > 0 && rate < 0 &&
      available > 0 && scheduled > 0 && available < baseline * (1 - GUARDRAIL_DRAWDOWN);
    if (cut) scheduled *= 1 - guardrailCut;
    const withdrawn = Math.min(scheduled, available);
    const cashWithdrawal = rate < 0 ? Math.min(cash, withdrawn) : Math.max(0, withdrawn - equity);
    cash = Math.max(0, cash - cashWithdrawal);
    equity = Math.max(0, equity - (withdrawn - cashWithdrawal));

    let refill = 0;
    if (bucket && rate > 0 && year < returns.length) {
      const target = scheduled * (1 + inflation) * cashYears;
      refill = Math.min(equity, Math.max(0, target - cash));
      cash += refill;
      equity -= refill;
    }

    if (withdrawn > 0 && equity + cash <= roundingTolerance) {
      equity = 0;
      cash = 0;
    }
    const endingBalance = equity + cash;
    const shortfall = scheduled - withdrawn;
    if (endingBalance === 0 && depletionYear === null) depletionYear = year;
    if (shortfall > roundingTolerance && firstShortfallYear === null) firstShortfallYear = year;
    rows.push({ year, rate, equity, cash, endingBalance, scheduled, withdrawn, shortfall,
      cut, cashWithdrawal, refill });
  });
  return { rows, endingBalance: rows.at(-1).endingBalance, depletionYear, firstShortfallYear };
}

// Present value of $1 of first-year spending, inflation-indexed thereafter.
// With end-of-year withdrawals, a 100% funding ratio leaves zero at the horizon.
export function maxFixedWithdrawalRate(returns, inflation) {
  validateReturns(returns);
  if (!Number.isFinite(inflation) || inflation <= -1) {
    throw new RangeError('Inflation must be finite and greater than −100%.');
  }
  let cumulativeLogReturn = 0;
  const logInflation = Math.log1p(inflation);
  const cost = returns.reduce((sum, rate, year) => {
    cumulativeLogReturn += Math.log1p(rate);
    return sum + Math.exp(year * logInflation - cumulativeLogReturn);
  }, 0);
  return 1 / cost;
}

export function compare(inputs) {
  const { scenario, years, customShocks, inflation } = inputs;
  const returns = buildReturns(scenario, years, customShocks);
  const reversed = [...returns].reverse();
  const bear = simulate({ ...inputs, returns, strategy: 'fixed' });
  const bull = simulate({ ...inputs, returns: reversed, strategy: 'fixed' });
  const guardrails = simulate({ ...inputs, returns, strategy: 'guardrails' });
  const cashBucket = simulate({ ...inputs, returns, strategy: 'cashBucket' });
  return { returns, reversed, bear, bull, guardrails, cashBucket, cagr: geometricMean(returns),
    gap: bull.endingBalance - bear.endingBalance, safeRate: maxFixedWithdrawalRate(returns, inflation) };
}
