export const FIRST_YEAR = 2026;
const DAY = 86_400_000;
const fiscalStart = (year) => Date.UTC(year, 6, 1);

function number(value, label, min, max, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new RangeError(`${label} must be ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
  }
  return value;
}

function iso(time) {
  return new Date(time).toISOString().slice(0, 10);
}

function date(value, label) {
  const time = Date.parse(value);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(time) || iso(time) !== value || value < '1800-01-01' || value > '2099-12-31') {
    throw new RangeError(`Enter a valid ${label} date (1800 to 2099).`);
  }
  return time;
}

function anniversary(time, years) {
  const original = new Date(time);
  const year = original.getUTCFullYear() + years;
  const month = original.getUTCMonth();
  const day = Math.min(original.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return Date.UTC(year, month, day);
}

function rentalSettings(rental) {
  return {
    start: date(rental.start, 'first rental availability'),
    firstDays: number(rental.firstDays, 'First-year eligible rental days', 0, 365, true),
    laterDays: number(rental.laterDays, 'Later eligible rental days', 0, 366, true)
  };
}

export function capitalWorks(work, rental, share, years) {
  const period = rentalSettings(rental);
  number(share, 'Ownership share', 0, 1);
  number(years, 'Projection years', 1, 40, true);
  const cost = number(work.cost, 'Construction cost', 0, 100_000_000);
  if (cost === 0) return { rate: 0, expiry: null, remainingYears: 0, amounts: Array(years).fill(0) };
  const started = date(work.started, 'construction start');
  const completed = date(work.completed, 'construction completion');
  if (completed < started) throw new RangeError('Construction completion cannot be before construction starts.');

  // Ordinary residential buildings and structural building renovations.
  const rate = work.started >= '1987-09-16' ? 0.025 : work.started >= '1985-07-18' ? 0.04 : 0;
  const expires = rate ? anniversary(completed, Math.round(1 / rate)) : completed;
  const reference = Math.max(fiscalStart(FIRST_YEAR), completed);
  const year = new Date(expires).getUTCFullYear() - new Date(reference).getUTCFullYear();
  const wholeYears = year - Number(anniversary(reference, year) > expires);
  const before = anniversary(reference, wholeYears);
  const after = anniversary(reference, wholeYears + 1);
  const remainingYears = rate ? Math.max(0, wholeYears + (expires - before) / (after - before)) : 0;
  let remainingCost = cost * share;

  const amounts = Array.from({ length: years }, (_, i) => {
    const fy = FIRST_YEAR + i;
    const first = Math.max(fiscalStart(fy), period.start, completed);
    const last = Math.min(fiscalStart(fy + 1), expires);
    const eligibleDays = Math.min(Math.max(0, (last - first) / DAY), i === 0 ? period.firstDays : period.laterDays);
    const amount = Math.min(remainingCost, cost * rate * eligibleDays / 365 * share);
    remainingCost -= amount;
    return amount;
  });
  return { rate, expiry: rate ? iso(expires) : null, remainingYears, amounts };
}

export function plantSchedule(asset, share, years) {
  number(share, 'Ownership share', 0, 1);
  number(years, 'Projection years', 1, 40, true);
  const name = asset.name?.trim() || 'Asset';
  if (!['new', 'developer', 'restricted'].includes(asset.kind)) {
    throw new RangeError(`${name}: choose an asset eligibility category.`);
  }
  const cost = number(asset.cost, `${name} cost`, 0, 100_000_000) * share;
  const use = number(asset.use, `${name} rental-use share`, 0, 1);
  if (asset.kind === 'restricted' || cost === 0 || use === 0) return { amounts: Array(years).fill(0) };
  const ready = date(asset.ready, `${name} ready-for-use`);
  if (ready < fiscalStart(FIRST_YEAR) || ready >= fiscalStart(FIRST_YEAR + 1)) {
    throw new RangeError(`${name}: use a first-use date in 2026–27.`);
  }
  if (!['pc', 'dv', 'instant', 'pool'].includes(asset.method)) throw new RangeError(`${name}: choose a deduction method.`);
  if (asset.method === 'instant' && (cost > 300 || use <= 0.5)) {
    throw new RangeError(`${name}: immediate deduction requires a share costing A$300 or less and more than 50% qualifying use.`);
  }
  if (asset.method === 'pool' && cost >= 1000) {
    throw new RangeError(`${name}: low-cost pooling requires a share costing less than A$1,000.`);
  }

  const normal = asset.method === 'pc' || asset.method === 'dv';
  const life = normal ? number(asset.life, `${name} effective life`, 0.01, 100) : 1;
  let balance = cost;
  const amounts = Array.from({ length: years }, (_, i) => {
    const fy = FIRST_YEAR + i;
    const daysHeld = (fiscalStart(fy + 1) - Math.max(fiscalStart(fy), ready)) / DAY;
    let decline;
    switch (asset.method) {
      case 'instant': decline = i === 0 ? cost : 0; break;
      case 'pool': decline = balance * (i === 0 ? 0.1875 : 0.375); break;
      case 'pc': decline = cost * daysHeld / 365 / life; break;
      case 'dv': decline = balance * daysHeld / 365 * 2 / life; break;
    }
    const amount = Math.min(balance, decline);
    balance -= amount;
    return amount * use;
  });
  return { amounts };
}

export function residentTax(income, medicare = false, year = FIRST_YEAR) {
  number(income, 'Taxable income', 0, Infinity);
  const bands = [
    [18_200, 45_000, year >= 2027 ? 0.14 : 0.15],
    [45_000, 135_000, 0.30],
    [135_000, 190_000, 0.37],
    [190_000, Infinity, 0.45]
  ];
  const tax = bands.reduce((sum, [lower, upper, rate]) =>
    sum + Math.max(0, Math.min(income, upper) - lower) * rate, 0);
  return tax + (medicare ? income * 0.02 : 0);
}

export function estimate({
  works, assets, rental, share, income, medicare, saleRate, discountRate, saleYears,
  cgtDiscount = true, futureRentalProfit = Infinity
}) {
  number(share, 'Ownership share', 0, 1);
  number(income, 'Taxable income', 0, 100_000_000);
  number(saleRate, 'Sale-year marginal rate', 0, 1);
  number(discountRate, 'Discount rate', 0, 1);
  number(saleYears, 'Years to sale', 1, 40, true);
  if (futureRentalProfit !== Infinity) number(futureRentalProfit, 'Future rental profit', 0, 100_000_000);
  rentalSettings(rental);

  const years = Math.max(5, saleYears);
  const capital = works.map((work) => capitalWorks(work, rental, share, years));
  const plant = assets.map((asset) => plantSchedule(asset, share, years));
  let cumulative = 0;
  let costBaseReduction = 0;
  let presentSavings = 0;
  const schedule = [];

  for (let i = 0; i < years; i++) {
    const div43 = capital.reduce((sum, work) => sum + work.amounts[i], 0);
    const div40 = plant.reduce((sum, asset) => sum + asset.amounts[i], 0);
    const total = div43 + div40;
    const allowed = Math.min(income, total, i === 0 ? Infinity : futureRentalProfit);
    const year = FIRST_YEAR + i;
    const taxSaving = residentTax(income, medicare, year) - residentTax(income - allowed, medicare, year);
    cumulative += total;
    if (i < saleYears) {
      costBaseReduction += div43;
      presentSavings += taxSaving / (1 + discountRate) ** (i + 1);
    }
    if (i < 5) schedule.push({ year, div43, div40, total, cumulative, taxSaving });
  }

  const saleTax = costBaseReduction * saleRate * (cgtDiscount ? 0.5 : 1);
  return {
    schedule, capital, costBaseReduction, saleTax,
    npv: presentSavings - saleTax / (1 + discountRate) ** saleYears
  };
}
