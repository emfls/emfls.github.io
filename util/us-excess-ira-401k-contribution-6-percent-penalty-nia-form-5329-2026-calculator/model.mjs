const rothBands = {
  single: [153_000, 168_000],
  joint: [242_000, 252_000],
  separate: [0, 10_000],
};

function nonnegative(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Enter a nonnegative number for ${name}.`);
  }
  return value;
}

export function contributionLimit({ account, age, filingStatus, magi, allowedLimit }) {
  if (!Number.isInteger(age) || age < 0) throw new RangeError('Enter a whole age at year-end.');
  const isPlan = account === '401k';
  if (!isPlan && account !== 'traditional' && account !== 'roth') {
    throw new RangeError('Choose an account type.');
  }
  const cap = isPlan
    ? 24_500 + (age < 50 ? 0 : age >= 60 && age <= 63 ? 11_250 : 8_000)
    : 7_500 + (age >= 50 ? 1_100 : 0);
  if (allowedLimit != null) {
    nonnegative(allowedLimit, 'your allowed limit');
    if (allowedLimit > cap) throw new RangeError('The allowed limit exceeds the age-based cap.');
    return allowedLimit;
  }
  if (account !== 'roth') return cap;

  if (!Object.hasOwn(rothBands, filingStatus)) throw new RangeError('Choose a Roth IRA filing status.');
  if (!Number.isFinite(magi)) throw new RangeError('Enter your Roth IRA modified AGI.');
  const [low, high] = rothBands[filingStatus];
  if (magi >= high) return 0;
  if (magi < low || (low > 0 && magi === low)) return cap;

  // Work in cents before rounding the reduced limit up to the next $10.
  const remaining = Math.round((high - magi) * 100);
  const rounded = Math.ceil(cap * remaining / ((high - low) * 1_000)) * 10;
  return Math.max(200, rounded);
}

export function calculateIraNia({
  excessAmount, openingBalanceBeforeContrib, closingBalanceBeforeRemoval,
  periodContributions, otherContributionsInPeriod = 0, otherDistributionsInPeriod = 0,
}) {
  nonnegative(excessAmount, 'the excess contribution');
  nonnegative(periodContributions, 'regular contributions in the computation period');
  if (periodContributions < excessAmount) {
    throw new RangeError('Regular contributions in the computation period must cover the excess being returned.');
  }
  const adjustedOpeningBalance = nonnegative(openingBalanceBeforeContrib, 'the opening IRA value')
    + periodContributions + nonnegative(otherContributionsInPeriod, 'other IRA deposits and transfers in');
  const adjustedClosingBalance = nonnegative(closingBalanceBeforeRemoval, 'the closing IRA value')
    + nonnegative(otherDistributionsInPeriod, 'IRA withdrawals and transfers out');
  if (!Number.isFinite(adjustedOpeningBalance) || !Number.isFinite(adjustedClosingBalance)) {
    throw new RangeError('The adjusted IRA values are too large.');
  }
  const nia = excessAmount === 0 ? 0
    : excessAmount * ((adjustedClosingBalance - adjustedOpeningBalance) / adjustedOpeningBalance);
  const totalRemovalRequired = Math.max(0, excessAmount + nia);
  if (!Number.isFinite(totalRemovalRequired)) throw new RangeError('The estimated IRA return is too large.');
  return { adjustedOpeningBalance, adjustedClosingBalance, nia, totalRemovalRequired };
}

export function calculateExcess(input) {
  const allowedLimit = contributionLimit(input);
  const totalContributed = nonnegative(input.totalContributed, 'the total contributed');
  const excessAmount = Number(Math.max(0, totalContributed - allowedLimit).toFixed(2));
  const rate = nonnegative(input.marginalTaxRate, 'the marginal tax rate');
  if (rate > 1) throw new RangeError('The marginal tax rate must be at most 100%.');

  const common = { allowedLimit, excessAmount, timelyEarlyWithdrawalPenalty: 0 };
  if (input.account === '401k') {
    const rothExcess = nonnegative(input.rothExcess ?? 0, 'designated Roth excess');
    if (rothExcess > excessAmount) {
      throw new RangeError('Designated Roth excess cannot exceed the total excess.');
    }
    const earnings = excessAmount === 0 ? 0 : input.planEarnings ?? null;
    if (earnings !== null && (!Number.isFinite(earnings) || earnings < -excessAmount)) {
      throw new RangeError('Enter plan earnings or a loss no larger than the excess.');
    }
    const preTaxExcess = Math.max(0, excessAmount - rothExcess);
    const deferralYearPrincipalTax = preTaxExcess * rate;
    const latePrincipalTax = deferralYearPrincipalTax * 2;
    const totalRemovalRequired = earnings === null ? null : Math.max(0, excessAmount + earnings);
    if (!Number.isFinite(latePrincipalTax) || totalRemovalRequired === Infinity) {
      throw new RangeError('The estimated plan amounts are too large.');
    }
    return {
      ...common,
      planEarnings: earnings,
      totalRemovalRequired,
      deferralYearPrincipalTax,
      timelyEarningsTax: earnings === null ? null : Math.max(0, earnings) * rate,
      latePrincipalTax,
      extraLatePrincipalTax: deferralYearPrincipalTax,
    };
  }

  const yearEndValue = nonnegative(input.yearEndValue, 'the applicable year-end IRA value');
  const annualPenalty = Math.min(excessAmount, yearEndValue) * 0.06;
  const niaResult = calculateIraNia({
    ...input, excessAmount, periodContributions: input.periodContributions ?? totalContributed,
  });
  return {
    ...common,
    ...niaResult,
    timelyForm5329Penalty: 0,
    timelyEarningsTax: Math.max(0, niaResult.nia) * rate,
    annualPenalty,
    penaltyProjection: Array.from({ length: 5 }, (_, i) => ({
      years: i + 1, penalty: annualPenalty * (i + 1),
    })),
  };
}
