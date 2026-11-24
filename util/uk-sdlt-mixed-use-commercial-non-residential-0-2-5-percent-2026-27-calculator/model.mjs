export const MAX_AMOUNT = 1_000_000_000;

const FREEHOLD = 'freehold_mixed_or_commercial';
const LEASE = 'new_commercial_lease';
const STANDARD = 'standard_residential';
const ADDITIONAL = 'additional_property_5pct';
const NON_UK = 'non_uk_additional_7pct';

const commercialPremium = [[150_000, 0], [250_000, 2], [Infinity, 5]];
const commercialRent = [[150_000, 0], [5_000_000, 1], [Infinity, 2]];
const residentialPremium = [[125_000, 0], [250_000, 2], [925_000, 5], [1_500_000, 10], [Infinity, 12]];
const residentialRent = [[125_000, 0], [Infinity, 1]];

// Parse pounds into integer pence for exact band arithmetic.
export function parseAmount(value) {
  const amount = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : '';
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(amount)) {
    throw new RangeError('Enter an amount in pounds with up to two decimal places.');
  }
  const [pounds, pence = ''] = amount.split('.');
  const minorUnits = Number(pounds) * 100 + Number(pence.padEnd(2, '0'));
  if (minorUnits > MAX_AMOUNT * 100) {
    throw new RangeError('Enter an amount of £1 billion or less.');
  }
  return minorUnits;
}

function calculateBands(amount, bands, uplift = 0) {
  let lower = 0;
  let taxUnits = 0;
  const rows = bands.map(([upper, baseRate]) => {
    const slice = Math.max(0, Math.min(amount, upper * 100) - lower * 100);
    const rate = baseRate + uplift;
    const units = slice * rate;
    const row = { lower, upper, rate, slice: slice / 100, tax: units / 10_000 };
    lower = upper;
    taxUnits += units;
    return row;
  });
  return { rows, due: Math.floor(taxUnits / 10_000) };
}

function combine(premium, rent) {
  return {
    premium: premium.due,
    rent: rent?.due ?? 0,
    total: premium.due + (rent?.due ?? 0),
    premiumBands: premium.rows,
    rentBands: rent?.rows ?? [],
  };
}

export function calculateSdlt({ price, transaction, rentNpv = '', profile }) {
  if (transaction !== FREEHOLD && transaction !== LEASE) throw new RangeError('Unknown transaction type.');
  if (![STANDARD, ADDITIONAL, NON_UK].includes(profile)) throw new RangeError('Unknown residential profile.');

  const premium = parseAmount(price);
  const isLease = transaction === LEASE;
  const rent = isLease && rentNpv !== '' ? parseAmount(rentNpv) : 0;
  const meetsPremiumMinimum = premium >= 40_000 * 100;
  const additionalUplift = profile !== STANDARD && meetsPremiumMinimum ? 5 : 0;
  // The selected lease scenario assumes a term above seven years and, when
  // rent is entered, qualifying annual rent for the 2-point surcharge.
  const nonUkUplift = profile === NON_UK && (meetsPremiumMinimum || rent > 0) ? 2 : 0;

  const commercial = combine(
    calculateBands(premium, commercialPremium),
    isLease ? calculateBands(rent, commercialRent) : null,
  );
  const residential = combine(
    calculateBands(premium, residentialPremium, additionalUplift + nonUkUplift),
    isLease ? calculateBands(rent, residentialRent, nonUkUplift) : null,
  );
  const consideration = (premium + rent) / 100;
  return {
    commercial,
    residential,
    savings: residential.total - commercial.total,
    effectiveRate: consideration === 0 ? null : (commercial.total / consideration) * 100,
  };
}
