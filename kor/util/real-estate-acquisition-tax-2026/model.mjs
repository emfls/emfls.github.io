const HUNDRED_MILLION = 100_000_000;
const RELIEF_PRICE_LIMIT = 12 * HUNDRED_MILLION;

export function standardRateBps(price) {
  if (price <= 6 * HUNDRED_MILLION) return 100;
  if (price > 9 * HUNDRED_MILLION) return 300;
  // The statutory decimal rate rounds to four places (whole basis points).
  return Math.floor((price - 450_000_000 + 750_000) / 1_500_000);
}

function rateBps({ price, houses, adjusted, temporary, corporate }) {
  if (corporate || (adjusted ? houses >= 3 : houses >= 4)) return 1200;
  if ((adjusted && houses === 2 && !temporary) || (!adjusted && houses === 3)) return 800;
  return standardRateBps(price);
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function shiftYears(date, years) {
  const year = date.getUTCFullYear() + years;
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

export function isBirthWindow(purchase, birth) {
  const purchaseDate = parseDate(purchase);
  const birthDate = parseDate(birth);
  if (!purchaseDate || !birthDate || purchaseDate.getUTCFullYear() !== 2026) return false;
  if (birth < '2024-01-01' || birth > '2028-12-31') return false;
  return purchaseDate >= shiftYears(birthDate, -1) && purchaseDate <= shiftYears(birthDate, 5);
}

function amounts({ price, rateBps, ruralExempt, limit = 0, key }) {
  const base = price <= 500_000 ? 0n : BigInt(price);
  const rate = BigInt(rateBps);
  const gross = base * rate;
  const relief = Math.min(limit, Number(gross / 10_000n));
  const net = gross - BigInt(relief) * 10_000n;
  const heavy = rateBps >= 800;
  const ruralBps = heavy ? (rateBps - 200) / 10 : 20;
  const acquisition = Number(net / 100_000n) * 10;
  const grossAcquisition = Number(gross / 100_000n) * 10;
  const education = Number((heavy ? base * 400n : net) / 1_000_000n) * 10;
  const rural = ruralExempt ? 0 : Number((base * BigInt(ruralBps) + BigInt(relief) * 2000n) / 100_000n) * 10;
  return { key, rateBps, limit, grossAcquisition, relief, acquisition, education, rural, total: acquisition + education + rural };
}

export function calculate({
  price, area, houses = 1, adjusted = false, temporary = false, corporate = false,
  ruralTown = false, metro = false, declining = false, smallType = false,
  first = false, birth = false, purchaseDate, birthDate,
} = {}) {
  if (!Number.isSafeInteger(price) || price <= 0 || !Number.isFinite(area) || area <= 0 ||
      (!corporate && (!Number.isSafeInteger(houses) || houses < 1))) return null;

  const ruralExempt = area <= (ruralTown ? 100 : 85);
  const rate = rateBps({ price, houses, adjusted, temporary, corporate });
  const standard = amounts({ price, rateBps: rate, ruralExempt, key: 'standard' });
  const baseRate = standardRateBps(price);
  const small = smallType && area <= 60 && price <= (metro ? 6 : 3) * HUNDRED_MILLION;
  const firstLimit = small || declining ? 3_000_000 : 2_000_000;
  const eligiblePrice = !corporate && price <= RELIEF_PRICE_LIMIT;
  const firstEstimate = eligiblePrice && houses === 1
    ? amounts({ price, rateBps: baseRate, ruralExempt, limit: firstLimit, key: 'first' })
    : null;
  const birthEstimate = eligiblePrice && (houses === 1 || (houses === 2 && temporary))
    ? amounts({ price, rateBps: baseRate, ruralExempt, limit: 5_000_000, key: 'birth' })
    : null;

  const birthInWindow = isBirthWindow(purchaseDate, birthDate);
  const available = [
    birth && birthInWindow ? birthEstimate : null,
    first ? firstEstimate : null,
  ];
  const selected = available.reduce((best, option) => option && option.relief > best.relief ? option : best, standard);
  return { standard, firstEstimate, birthEstimate, firstLimit, birthInWindow, selected };
}
