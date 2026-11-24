export const AIA_LIMIT = 1_000_000;
const MAX_COST = 1_000_000_000;
export const PERIODS = {
  company: { start: '2026-04-01', end: '2027-03-31' },
  income: { start: '2026-04-06', end: '2027-04-05' },
};
export const TAX_RATES = {
  company: [[25, '25% — main corporation tax rate'], [19, '19% — small profits rate'],
    [26.5, '26.5% — typical marginal relief rate']],
  income: [[20, '20% — basic rate'], [40, '40% — higher rate'], [45, '45% — additional rate']],
};

const ASSETS = {
  'new-main': { pool: 'main', isNew: true },
  'used-main': { pool: 'main' },
  'new-special': { pool: 'special', isNew: true },
  'used-special': { pool: 'special' },
  'new-ev': { pool: 'main', isCar: true, isNew: true },
  'low-co2': { pool: 'main', isCar: true },
  'high-co2': { pool: 'special', isCar: true },
};

function project(balance, upfront, deferWda, rates, taxRate) {
  let totalAllowance = 0;
  return rates.map((wdaRate, index) => {
    const wda = index === 0 && deferWda ? 0 : balance * wdaRate;
    const allowance = wda + (index === 0 ? upfront : 0);
    balance -= wda;
    totalAllowance += allowance;
    return {
      year: index + 1, wdaRate, wda, allowance, balance, totalAllowance,
      taxSaved: allowance * taxRate,
      cumulativeTaxSaved: totalAllowance * taxRate,
    };
  });
}

/**
 * Estimates one qualifying purchase under aligned 12-month periods.
 * taxRate is a percentage (e.g. 25). All monetary values are GBP.
 */
export function calculateAllowances({
  business, asset, cost, aiaUsed, taxRate, purchaseDate,
  use = 'own', includeProposals = true,
}) {
  if (!Object.hasOwn(PERIODS, business)) throw new RangeError('Select a business type.');
  if (!Object.hasOwn(ASSETS, asset)) throw new RangeError('Select an asset type.');
  if (!Number.isFinite(cost) || cost < 0.01 || cost > MAX_COST) {
    throw new RangeError('Enter a purchase cost between £0.01 and £1 billion.');
  }
  if (!Number.isFinite(aiaUsed) || aiaUsed < 0 || aiaUsed > AIA_LIMIT) {
    throw new RangeError('Enter AIA used between £0 and £1,000,000.');
  }
  if (!TAX_RATES[business].some(([rate]) => rate === taxRate)) {
    throw new RangeError('Select a marginal tax rate for this business type.');
  }
  const { start, end } = PERIODS[business];
  if (typeof purchaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)
      || purchaseDate < start || purchaseDate > end
      || new Date(purchaseDate).toJSON()?.slice(0, 10) !== purchaseDate) {
    throw new RangeError(`Enter a purchase date between ${start} and ${end}.`);
  }
  if (!['own', 'background', 'lease-qualifying', 'lease-other'].includes(use)) {
    throw new RangeError('Select how the asset is used.');
  }
  if (typeof includeProposals !== 'boolean') throw new TypeError('Select a valid rate scenario.');

  const { pool, isNew, isCar } = ASSETS[asset];
  if (isCar && use !== 'own') throw new RangeError('This calculator models cars used by the business.');
  const companyFya = business === 'company' && isNew && !isCar && ['own', 'background'].includes(use);
  const fullExpensing = companyFya && pool === 'main' ? cost : 0;
  const evFya = asset === 'new-ev' ? cost : 0;
  const aiaAvailable = AIA_LIMIT - aiaUsed;
  const aia = isCar || fullExpensing ? 0 : Math.min(cost, aiaAvailable);
  const afterImmediate = cost - fullExpensing - evFya - aia;
  let fyaRate = 0;
  let fyaLabel = '';
  if (afterImmediate > 0 && companyFya && pool === 'special') {
    fyaRate = 0.5;
    fyaLabel = '50% special-rate FYA';
  } else if (afterImmediate > 0 && isNew && !isCar && pool === 'main' && use !== 'lease-other') {
    fyaRate = includeProposals && purchaseDate >= '2027-01-01' ? 0.5 : 0.4;
    fyaLabel = `${fyaRate * 100}% main-rate FYA`;
  }
  const fya = afterImmediate * fyaRate;
  const openingBalance = afterImmediate - fya;
  const upfront = fullExpensing + evFya + aia + fya;
  const baselineRate = pool === 'main' ? 0.14 : 0.06;
  const oldRate = pool === 'main' ? 0.18 : 0.06;
  const futureRate = includeProposals && pool === 'main' ? 0.12 : baselineRate;
  const schedule = project(openingBalance, upfront, fya > 0,
    [baselineRate, futureRate, futureRate, futureRate, futureRate], taxRate / 100);
  const at14 = project(openingBalance, upfront, fya > 0, Array(5).fill(baselineRate), taxRate / 100);
  const at18 = project(openingBalance, upfront, fya > 0, Array(5).fill(oldRate), taxRate / 100);
  const path = [];
  if (fullExpensing) path.push('100% full expensing');
  if (evFya) path.push('100% zero-emission car FYA');
  if (aia) path.push('100% annual investment allowance');
  if (fya) path.push(fyaLabel);
  if (openingBalance) path.push(`${pool === 'main' ? 'Main' : 'Special'} pool WDA from Year ${fya ? 2 : 1}`);

  return {
    path, pool, aia, aiaRemaining: aiaAvailable - aia, fullExpensing, evFya, fya, fyaRate, fyaLabel,
    openingBalance, schedule, at14, at18,
    yearOneAllowance: schedule[0].allowance,
    yearOneTaxSaved: schedule[0].taxSaved,
    effectiveCost: cost - schedule[0].taxSaved,
    fiveYearTaxSaved: schedule[4].cumulativeTaxSaved,
    fiveYearDelay14: at18[4].cumulativeTaxSaved - at14[4].cumulativeTaxSaved,
    disposalChargeShare: fullExpensing ? 1 : (companyFya && pool === 'special' ? fya / cost : 0),
  };
}
