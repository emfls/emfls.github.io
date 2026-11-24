const DAY_MS = 86_400_000;
const STANDARD = [[125_000, 0], [250_000, 2], [925_000, 5], [1_500_000, 10], [Infinity, 12]];
const FIRST_HOME = [[300_000, 0], [500_000, 5]];

export function calculateSdlt({ pricePence, purchase, nonResident }) {
  if (!Number.isSafeInteger(pricePence) || pricePence < 1 || pricePence > 100_000_000_000) {
    throw new RangeError('Enter a price from £0.01 to £1 billion, with at most two decimal places.');
  }
  if (!['standard', 'first-home', 'additional', 'replacement', 'company', 'company-relief'].includes(purchase)
      || typeof nonResident !== 'boolean') {
    throw new TypeError('Select a purchase type and residency status.');
  }

  const corporateFlat = purchase === 'company' && pricePence > 50_000_000;
  const firstHome = purchase === 'first-home' && pricePence <= 50_000_000;
  const additionalRate = !corporateFlat && pricePence >= 4_000_000
    && ['additional', 'replacement', 'company', 'company-relief'].includes(purchase) ? 5 : 0;
  const overseasRate = nonResident && pricePence >= 4_000_000 ? 2 : 0;
  const bands = corporateFlat ? [[Infinity, 17]] : firstHome ? FIRST_HOME : STANDARD;

  let lowerPence = 0;
  let baseNumerator = 0;
  const rows = [];
  for (const [upper, baseRate] of bands) {
    const upperPence = upper * 100;
    const slicePence = Math.min(upperPence, pricePence) - lowerPence;
    const rate = baseRate + additionalRate + overseasRate;
    rows.push({ lowerPence, upperPence, slicePence, rate, tax: slicePence * rate / 10_000 });
    baseNumerator += slicePence * baseRate;
    lowerPence = upperPence;
    if (lowerPence >= pricePence) break;
  }

  // Retain exact integer products until applying HMRC's whole-pound rounding.
  const withAdditional = baseNumerator + pricePence * additionalRate;
  const withOverseas = baseNumerator + pricePence * overseasRate;
  const pounds = numerator => Math.floor(numerator / 10_000);
  const base = pounds(baseNumerator);
  const total = pounds(withAdditional + pricePence * overseasRate);
  return {
    rows, base, total, corporateFlat, firstHome,
    effectiveRate: total * 10_000 / pricePence,
    additional: pounds(withAdditional) - base,
    overseas: total - pounds(withAdditional),
    replacementRefund: purchase === 'replacement' ? total - pounds(withOverseas) : 0,
    combinedRefund: purchase === 'replacement' ? total - base : total - pounds(withAdditional),
  };
}

function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError('Use dates in YYYY-MM-DD format.');
  }
  const day = Date.parse(value + 'T00:00:00Z') / DAY_MS;
  if (!Number.isInteger(day) || isoDay(day) !== value) throw new RangeError('Enter a valid calendar date.');
  return day;
}

function isoDay(day) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function anniversary(value, years) {
  const [year, month, day] = value.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate();
  return isoDay(Date.UTC(year + years, month - 1, Math.min(day, lastDay)) / DAY_MS);
}

export function parsePresence(text) {
  return text.trim().split(/\n[ \t\r]*\n+/).map(group =>
    group.trim().toLowerCase() === 'none' ? [] : group.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const match = /^(\d{4}-\d{2}-\d{2})(?:\s+to\s+(\d{4}-\d{2}-\d{2}))?$/.exec(line);
      if (!match) throw new RangeError('Use YYYY-MM-DD or YYYY-MM-DD to YYYY-MM-DD, one stay per line.');
      return [match[1], match[2] ?? match[1]];
    }),
  );
}

export function trackPresence({ effectiveDate, asOfDate, buyers, spousePair = false }) {
  const effective = dayNumber(effectiveDate);
  if (effectiveDate < '2026-04-06' || effectiveDate > '2027-04-05') {
    throw new RangeError('Choose an effective date from 6 April 2026 to 5 April 2027.');
  }
  const asOf = dayNumber(asOfDate);
  const first = effective - 364;
  const last = effective + 365;
  const claimDeadline = anniversary(effectiveDate, 2);

  if (!buyers.length || (spousePair && buyers.length !== 2)) {
    throw new RangeError('The spouse or civil partner rule requires exactly two buyers.');
  }

  const counts = buyers.map(ranges => {
    const days = new Uint8Array(last - first + 1);
    for (const [from, to] of ranges) {
      const start = dayNumber(from);
      const end = dayNumber(to);
      if (start > end) throw new RangeError('Each stay must end on or after its start date.');
      const clippedStart = Math.max(first, start);
      const clippedEnd = Math.min(last, end);
      if (clippedStart <= clippedEnd) days.fill(1, clippedStart - first, clippedEnd - first + 1);
    }

    let rolling = 0;
    let initial = 0;
    let best = 0;
    let qualifiedOn = null;
    for (let day = first; day <= Math.min(last, asOf); day++) {
      const index = day - first;
      rolling += days[index];
      if (index >= 365) rolling -= days[index - 365];
      if (day <= effective) initial = rolling;
      best = Math.max(best, rolling);
      if (rolling >= 183 && qualifiedOn === null) qualifiedOn = day;
    }
    return { initial, best, qualifiedOn };
  });
  const initialMet = counts.filter(count => count.initial >= 183).length;
  const dates = counts.map(count => count.qualifiedOn).filter(day => day !== null);
  const qualified = spousePair ? dates.length > 0 : dates.length === counts.length;
  const qualifyingDay = qualified ? (spousePair ? Math.min(...dates) : Math.max(...dates)) : null;
  return {
    counts,
    nonResident: spousePair ? initialMet === 0 : initialMet < counts.length,
    qualifiedOn: qualifyingDay === null ? null : isoDay(qualifyingDay),
    firstDay: isoDay(first),
    lastDay: isoDay(last),
    claimDeadline,
    deadlinePassed: asOfDate > claimDeadline,
    windowClosed: asOf >= last,
    completionAssessed: asOf >= effective,
  };
}
