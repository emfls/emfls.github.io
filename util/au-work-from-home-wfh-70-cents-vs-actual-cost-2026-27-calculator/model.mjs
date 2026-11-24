export const FIXED_RATE = 0.70;

const BANDS = [
  [18_200, 45_000, 0.15],
  [45_000, 135_000, 0.30],
  [135_000, 190_000, 0.37],
  [190_000, Infinity, 0.45],
];

function amount(value, label, max = Number.MAX_SAFE_INTEGER / 100) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new RangeError(`Enter a valid ${label}.`);
  }
  return value;
}

function cents(value) {
  return Math.round(value * 100 + 1e-8) / 100;
}

function share(total, percent, label) {
  return amount(total, label) * amount(percent, `${label} work-use percentage`, 100) / 100;
}

export function assetDeduction({ cost, workPercent, life, days, openingValue, immediate = false }) {
  amount(cost, 'asset cost');
  const workShare = amount(workPercent, 'asset work-use percentage', 100) / 100;
  amount(days, 'asset days held', 365);
  if (!Number.isInteger(days)) throw new RangeError('Enter whole days for each asset.');
  if (immediate && (cost > 300 || workShare <= 0.5 || openingValue != null || days === 0)) {
    throw new RangeError('Immediate deduction requires an eligible current-year item costing A$300 or less and over 50% work use.');
  }
  if (immediate) return cents(cost * workShare);
  if (!Number.isFinite(life) || life <= 0) throw new RangeError('Enter a positive asset effective life.');
  const remaining = openingValue == null ? cost : amount(openingValue, 'asset opening adjustable value', cost);
  return cents(Math.min(remaining, cost * (days / 365) / life) * workShare);
}

function incomeTax(income) {
  return BANDS.reduce((tax, [lower, upper, rate]) =>
    tax + Math.max(0, Math.min(income, upper) - lower) * rate, 0);
}

export function residentTax(income) {
  return cents(incomeTax(amount(income, 'taxable income')));
}

export function taxSaving(income, deduction, levyRate = 0) {
  amount(income, 'taxable income');
  amount(deduction, 'deduction');
  amount(levyRate, 'Medicare levy rate', 0.02);
  const taxableAfter = Math.max(0, income - deduction);
  return cents(incomeTax(income) - incomeTax(taxableAfter) + (income - taxableAfter) * levyRate);
}

export function compareMethods({
  daysPerWeek = 0, hoursPerDay = 0, weeks = 0, loggedHours, income = 0, levyRate = 0,
  energy = { method: 'share' }, internet = 0, internetPercent = 0, phone = 0, phonePercent = 0,
  supplies = 0, dedicatedOffice = false, cleaning = 0, repairs = 0, assets = [],
} = {}) {
  const hours = loggedHours == null
    ? amount(daysPerWeek, 'days per week', 7)
      * amount(hoursPerDay, 'hours per day', 24) * amount(weeks, 'weeks worked', 365 / 7)
    : amount(loggedHours, 'logged annual hours', 8760);
  const fixedBase = cents(hours * FIXED_RATE);
  let energyCost;
  switch (energy.method) {
    case 'usage':
      energyCost = amount(energy.unitsPerHour ?? 0, 'electricity units per hour')
        * amount(energy.rate ?? 0, 'electricity unit rate') * hours
        + amount(energy.gas ?? 0, 'work-related gas cost');
      break;
    case 'share':
      energyCost = share(energy.annual ?? 0, energy.percent ?? 0, 'energy bill');
      break;
    default:
      throw new RangeError('Select an energy calculation method.');
  }
  energyCost = cents(energyCost);
  const internetCost = cents(share(internet, internetPercent, 'internet bill'));
  const phoneCost = cents(share(phone, phonePercent, 'phone bill'));
  const actualBase = cents(energyCost + internetCost + phoneCost + amount(supplies, 'work supplies cost'));
  const assetsTotal = cents(assets.reduce((total, asset) => total + assetDeduction(asset), 0));
  const officeCleaning = dedicatedOffice ? cents(amount(cleaning, 'office cleaning cost')) : 0;
  const repairCost = cents(amount(repairs, 'work-related repairs'));
  const shared = cents(assetsTotal + officeCleaning + repairCost);
  const fixedTotal = cents(fixedBase + shared);
  const actualTotal = cents(actualBase + shared);
  const winner = fixedTotal === actualTotal ? 'tie' : fixedTotal > actualTotal ? 'fixed' : 'actual';
  const fixedSaving = taxSaving(income, fixedTotal, levyRate);
  const actualSaving = taxSaving(income, actualTotal, levyRate);
  return {
    hours, fixedBase, actualBase, energy: energyCost, internet: internetCost, phone: phoneCost,
    assets: assetsTotal, cleaning: officeCleaning, repairs: repairCost, shared, fixedTotal, actualTotal,
    winner, extraDeduction: cents(Math.abs(fixedTotal - actualTotal)), fixedSaving, actualSaving,
    winningSaving: Math.max(fixedSaving, actualSaving),
    extraTaxSaving: cents(Math.abs(fixedSaving - actualSaving)),
  };
}
