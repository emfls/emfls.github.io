export const INCLUSION_RATE = 0.5;
const DAY = 86_400_000;
const TAX_YEAR = '2026';
const REGISTERED = ['TFSA', 'RRSP', 'FHSA'];

function dateValue(value, label) {
  const time = Date.parse(value + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== value) {
    throw new RangeError(label + ' needs a valid calendar date.');
  }
  return time;
}

function amount(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(label + ' is missing or outside its permitted range.');
  }
  return value;
}

function positiveUnits(value, label) {
  if (amount(value, label) === 0) throw new RangeError(label + ' must be greater than zero.');
  return value;
}

export function superficialLossWindow(saleDate) {
  const saleTime = dateValue(saleDate, 'Sale');
  const dateAt = days => new Date(saleTime + DAY * days).toISOString().slice(0, 10);
  return { start: dateAt(-30), end: dateAt(30), safeReentry: dateAt(31) };
}

export function trackACB(events, saleDate) {
  const saleTime = dateValue(saleDate, 'Sale');
  let previousTime = -Infinity;
  let units = 0;
  let totalACB = 0;
  let rocGain = 0;
  let rocGain2026 = 0;

  for (const [index, event] of events.entries()) {
    const label = 'ACB row ' + (index + 1);
    const time = dateValue(event.date, label);
    if (time < previousTime || time > saleTime) {
      throw new RangeError('Enter ACB events in date order through the sale date.');
    }
    previousTime = time;
    if (event.type === 'buy') {
      const bought = positiveUnits(event.units, label + ' units');
      units = amount(units + bought, 'Total pool units');
      totalACB += bought * amount(event.price, label + ' unit cost') +
        amount(event.commission, label + ' commission');
    } else {
      if (!units) throw new RangeError('Add a purchase or opening position before distributions.');
      const distribution = amount(event.amount, label + ' distribution');
      if (event.type === 'phantom') {
        totalACB += distribution;
      } else if (event.type === 'roc') {
        const excess = Math.max(0, distribution - totalACB);
        rocGain += excess;
        if (event.date.startsWith(TAX_YEAR + '-')) rocGain2026 += excess;
        totalACB = Math.max(0, totalACB - distribution);
      } else {
        throw new RangeError(label + ' has an unsupported event type.');
      }
    }
    amount(totalACB, 'Total ACB');
    amount(rocGain, 'Total excess ROC');
  }

  if (!units) throw new RangeError('Enter at least one purchase or opening position.');
  return { units, totalACB, acbPerUnit: totalACB / units, rocGain, rocGain2026 };
}

export function calculate({ events, sale, acquisitions, heldAtDay30, account, replacementACB, marginalRate }) {
  const window = superficialLossWindow(sale.date);
  if (!sale.date.startsWith(TAX_YEAR + '-')) throw new RangeError('Enter a sale date in 2026.');
  const pool = trackACB(events, sale.date);
  const enteredUnits = positiveUnits(sale.units, 'Units sold');
  // Allow the small representation difference between 0.3 and 0.1 + 0.2.
  const allUnits = Math.abs(enteredUnits - pool.units) <= Number.EPSILON * Math.max(enteredUnits, pool.units);
  const unitsSold = allUnits ? pool.units : enteredUnits;
  if (unitsSold > pool.units) throw new RangeError('Units sold exceed the pre-sale pool.');

  const grossProceeds = amount(unitsSold * amount(sale.price, 'Sale price'), 'Gross proceeds');
  const netProceeds = grossProceeds - amount(sale.commission, 'Selling commission');
  const basisSold = pool.totalACB * (unitsSold / pool.units);
  const difference = netProceeds - basisSold;
  const tolerance = Number.EPSILON * Math.max(Math.abs(netProceeds), basisSold);
  const grossCapitalGain = Math.abs(difference) <= tolerance ? 0 : difference;
  const capitalLoss = Math.max(0, -grossCapitalGain);

  const unitsAcquired = acquisitions.reduce((sum, purchase, index) => {
    const label = 'Replacement row ' + (index + 1);
    dateValue(purchase.date, label);
    const units = positiveUnits(purchase.units, label + ' units');
    return purchase.date >= window.start && purchase.date <= window.end ? sum + units : sum;
  }, 0);
  amount(unitsAcquired, 'Total replacement units');
  const held = amount(heldAtDay30, 'Day +30 units');
  const registered = REGISTERED.includes(account);
  if (!registered && account !== 'taxable') throw new RangeError('Select a replacement account.');
  const deniedLoss = capitalLoss * (Math.min(unitsSold, unitsAcquired, held) / unitsSold);
  const allowedLoss = capitalLoss - deniedLoss;
  const deferredLoss = registered ? 0 : deniedLoss;
  const permanentLoss = registered ? deniedLoss : 0;
  const adjustedReplacementACB = registered || !held ? null :
    amount(amount(replacementACB, 'Replacement pool ACB') + deferredLoss, 'Adjusted replacement ACB');

  const recognizedSale = Math.max(0, grossCapitalGain) - allowedLoss;
  const includedSale = recognizedSale * INCLUSION_RATE;
  const includedNet = (recognizedSale + pool.rocGain2026) * INCLUSION_RATE;
  const taxEffect = includedNet * (amount(marginalRate, 'Marginal tax rate', 0, 100) / 100);
  return {
    ...pool, window, grossProceeds, netProceeds, basisSold, grossCapitalGain,
    remainingACB: pool.totalACB - basisSold, unitsAcquired, deniedLoss, allowedLoss,
    deferredLoss, permanentLoss, adjustedReplacementACB, includedSale, includedNet, taxEffect
  };
}
