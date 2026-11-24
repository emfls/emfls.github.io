const ALLOWANCE = 1_257_000;
const BASIC_BAND = 3_770_000;
const AEA = 300_000;
const BADR_LIMIT = 100_000_000;

export function personalAllowance(adjustedIncome) {
  // HMRC reduces the allowance in whole pounds.
  const withdrawal = Math.floor(Math.max(0, adjustedIncome - 10_000_000) / 200) * 100;
  return Math.max(0, ALLOWANCE - withdrawal);
}

export function estimateCgt({income, incomeMode, gains, losses, badr, qualifying, prior}) {
  if (incomeMode !== 'gross' && incomeMode !== 'taxable') throw new RangeError('Choose an income method.');
  const allowance = incomeMode === 'gross' ? personalAllowance(income) : null;
  const taxableIncome = Math.max(0, income - (allowance ?? 0));
  const basic = Math.max(0, BASIC_BAND - taxableIncome);
  const net = Math.max(0, gains - losses);
  if (badr && qualifying > net) throw new RangeError('BADR qualifying net gains cannot exceed total net gains.');
  const remaining = Math.max(0, BADR_LIMIT - prior);
  const provisional = badr ? Math.min(qualifying, remaining) : 0;
  const aea = Math.min(AEA, net);
  // Apply the exemption to gains at 24% first. At equal rates it can preserve BADR capacity.
  const highBeforeExemption = Math.max(0, net - Math.max(provisional, basic));
  const reliefGain = Math.max(0, provisional - (aea - Math.min(aea, highBeforeExemption)));
  const taxableGain = net - aea;
  const mainGain = taxableGain - reliefGain;
  const at18 = Math.min(mainGain, Math.max(0, basic - reliefGain));
  const at24 = mainGain - at18;
  const tax = rounded((at18 + reliefGain) * 18 + at24 * 24, 100);
  return {allowance, taxableIncome, basic, net, aea, taxableGain, at18, at24, reliefGain,
    remainingAfter: badr ? Math.max(0, remaining - reliefGain) : null, tax,
    unusedLoss: Math.max(0, losses - gains)};
}

export function calculate(input) {
  const badr = input.relief === 'badr';
  return formatMoney(estimateCgt({
    income: cents(input.income, 'annual income'),
    incomeMode: input.incomeMode,
    gains: cents(input.gains, 'total gains'),
    losses: cents(input.losses, 'allowable losses'),
    badr,
    qualifying: badr ? cents(input.qualifying, 'BADR qualifying net gains') : 0,
    prior: badr ? cents(input.prior, 'prior use of the BADR limit') : 0
  }));
}

const currency = new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP'});

function rounded(numerator, denominator) {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

function cents(value, label) {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value?.trim());
  if (!match) {
    throw new RangeError(`Enter ${label} in pounds with up to eight digits and two decimal places.`);
  }
  const magnitude = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return magnitude;
}

function formatMoney(amounts) {
  return Object.fromEntries(Object.entries(amounts).map(([key, amount]) =>
    [key, amount === null ? '—' : currency.format(amount / 100)]));
}
