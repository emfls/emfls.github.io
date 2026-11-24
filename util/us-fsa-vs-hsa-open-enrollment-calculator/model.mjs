const FSA_LIMIT = 340_000;
const CARRYOVER_MAX = 68_000;
const CATCH_UP = 100_000;
const SOCIAL_SECURITY_WAGE_BASE = 18_450_000;
const HDHP = {
  self: {limit: 440_000, deductible: 170_000, outOfPocket: 850_000},
  family: {limit: 875_000, deductible: 340_000, outOfPocket: 1_700_000}
};
const usd = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});

function payroll(contribution, wages) {
  const socialSecurityWages = Math.min(wages, SOCIAL_SECURITY_WAGE_BASE) -
    Math.min(wages - contribution, SOCIAL_SECURITY_WAGE_BASE);
  return Math.floor((socialSecurityWages * 620 + contribution * 145 + 5000) / 10_000);
}

export function compareAccounts({fsa, hsa, employer, spending, carryover, coverage, age,
  federalRate, stateRate, wages, funding, years, growth}) {
  const plan = Object.hasOwn(HDHP, coverage) ? HDHP[coverage] : null;
  if (!plan || !['payroll', 'direct'].includes(funding) ||
      ![fsa, hsa, employer, spending, carryover, age, federalRate, stateRate, wages, years, growth]
        .every(value => Number.isSafeInteger(value) && value >= 0) ||
      age > 120 || federalRate > 3700 || stateRate > 2000 || wages > 1_000_000_000 ||
      spending > 1_000_000_000 || years > 40 || growth > 2000) {
    throw new RangeError('Enter valid 2026 coverage, tax rates, amounts and growth assumptions.');
  }
  const limit = plan.limit + (age >= 55 ? CATCH_UP : 0);
  if (fsa > FSA_LIMIT || carryover > CARRYOVER_MAX || hsa + employer > limit) {
    throw new RangeError('Check the FSA election, plan carryover cap and combined employee/employer HSA limit.');
  }
  if (fsa > wages || (funding === 'payroll' && hsa > wages)) {
    throw new RangeError('Payroll contributions cannot exceed wages before the election.');
  }

  const incomeTax = amount => Math.floor((amount * (federalRate + stateRate) + 5000) / 10_000);
  const fsaPayroll = payroll(fsa, wages);
  const hsaPayroll = funding === 'payroll' ? payroll(hsa, wages) : 0;
  const fsaTax = incomeTax(fsa) + fsaPayroll;
  const hsaTax = incomeTax(hsa) + hsaPayroll;
  const unused = Math.max(0, fsa - spending);
  const carried = Math.min(carryover, unused);
  const forfeited = unused - carried;
  const remaining = Math.max(0, hsa + employer - spending);
  // Compound the single remaining balance at an exact rational rate, then round once.
  const divisor = 10_000n ** BigInt(years);
  const future = Number((2n * BigInt(remaining) * BigInt(10_000 + growth) ** BigInt(years) + divisor) /
    (2n * divisor));
  return {
    fsaTax, fsaPayroll, hsaTax, hsaPayroll, carried, forfeited,
    fsaAfterForfeiture: fsaTax - forfeited,
    limit, deductible: plan.deductible, outOfPocket: plan.outOfPocket,
    remaining, future
  };
}

function scaled(value, places, label) {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value?.trim());
  if (!match || (match[2]?.length ?? 0) > places) {
    throw new RangeError(`Enter ${label} with at most ${places} decimal places.`);
  }
  return Number(match[1]) * 10 ** places + Number((match[2] ?? '').padEnd(places, '0'));
}

export function calculate(input) {
  const values = Object.fromEntries([
    'fsa', 'hsa', 'employer', 'spending', 'carryover', 'federalRate', 'stateRate', 'wages', 'growth'
  ].map(key => [key, scaled(input[key], 2, key)]));
  const result = compareAccounts({
    ...values, coverage: input.coverage, funding: input.funding,
    age: scaled(input.age, 0, 'age'), years: scaled(input.years, 0, 'growth years')
  });
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, usd.format(value / 100)]));
}
