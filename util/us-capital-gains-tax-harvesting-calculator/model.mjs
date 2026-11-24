// The caps are taxable income, including the stacked gain.
const CAPITAL_CAPS = {
  single: [4_945_000, 54_550_000], mfj: [9_890_000, 61_370_000],
  hoh: [6_620_000, 57_960_000], mfs: [4_945_000, 30_685_000]
};

export function longTermBands(ordinary, longTerm, status) {
  filingRules(status);
  const [zeroCap, fifteenCap] = CAPITAL_CAPS[status];
  const zero = Math.min(longTerm, Math.max(0, zeroCap - ordinary));
  const fifteen = Math.min(longTerm - zero, Math.max(0, fifteenCap - ordinary - zero));
  const twenty = longTerm - zero - fifteen;
  return {zero, fifteen, twenty, preferentialTax: rounded(fifteen * 15 + twenty * 20, 100)};
}

export function investmentTax(magi, netInvestment, status) {
  const threshold = filingRules(status).medicareThreshold;
  const base = Math.min(Math.max(0, netInvestment), Math.max(0, magi - threshold));
  return {base, niit: rate(base, 380)};
}

export function scenario({status, ordinary, magi, investment, short, long}) {
  const {standard} = filingRules(status);
  const net = short + long;
  const netShort = Math.max(0, Math.min(short, net));
  const netLong = Math.max(0, Math.min(long, net));
  const lossDeduction = Math.min(status === 'mfs' ? 150_000 : 300_000, Math.max(0, -net));
  const ordinaryBeforeFloor = ordinary + netShort - lossDeduction - standard;
  const taxableOrdinary = Math.max(0, ordinaryBeforeFloor);
  const taxableTotal = Math.max(0, ordinaryBeforeFloor + netLong);
  const bands = longTermBands(taxableOrdinary, taxableTotal - taxableOrdinary, status);
  const ordinaryFederal = ordinaryTax(taxableOrdinary, status);
  // The qualified dividends/capital gains worksheet caps combined regular tax at ordinary-rate tax.
  const federal = Math.min(ordinaryFederal + bands.preferentialTax, ordinaryTax(taxableTotal, status));
  const longTermTax = federal - ordinaryFederal;
  const taxableLossUsed = Math.min(lossDeduction, Math.max(0, ordinaryBeforeFloor + lossDeduction));
  const shortCarry = Math.max(0, -short - Math.max(0, long) - taxableLossUsed);
  const carry = Math.max(0, -net - taxableLossUsed);
  const capitalAdjustment = net >= 0 ? net : -lossDeduction;
  const {base, niit} = investmentTax(magi + capitalAdjustment, investment + capitalAdjustment, status);
  const total = federal + niit;
  return {...bands, netShort, netLong, lossDeduction, taxableOrdinary, shortCarry,
    longCarry: carry - shortCarry, carry, longTermTax, federal, niitBase: base, niit, total};
}

export function compareHarvest(input) {
  const before = scenario(input);
  const after = scenario({...input, short: input.short - input.harvestShort, long: input.long - input.harvestLong});
  return {...after, before: before.total, saved: before.total - after.total};
}

export function calculate(input) {
  const ordinary = cents(input.ordinary, 'ordinary income');
  const result = compareHarvest({
    status: input.status,
    ordinary,
    magi: input.magi?.trim() ? cents(input.magi, 'pre-trade MAGI') : ordinary,
    investment: cents(input.investment, 'other net investment income', true),
    short: cents(input.short, 'net short-term result', true),
    long: cents(input.long, 'net long-term result', true),
    harvestShort: cents(input.harvestShort, 'added short-term losses'),
    harvestLong: cents(input.harvestLong, 'added long-term losses')
  });
  return formatMoney(result);
}

const RATES = [10, 12, 22, 24, 32, 35, 37];
const FILINGS = {
  single: [16_100, 200_000, [12_400, 50_400, 105_700, 201_775, 256_225, 640_600]],
  mfj: [32_200, 250_000, [24_800, 100_800, 211_400, 403_550, 512_450, 768_700]],
  hoh: [24_150, 200_000, [17_700, 67_450, 105_700, 201_750, 256_200, 640_600]],
  mfs: [16_100, 125_000, [12_400, 50_400, 105_700, 201_775, 256_225, 384_350]]
};

function filingRules(status) {
  if (!Object.hasOwn(FILINGS, status)) throw new RangeError('Choose a filing status.');
  const [standard, medicareThreshold, limits] = FILINGS[status];
  return {standard: standard * 100, medicareThreshold: medicareThreshold * 100, limits};
}

export function ordinaryTax(income, status) {
  const {limits} = filingRules(status);
  let start = 0;
  let weighted = 0;
  for (const [index, cap] of [...limits, Infinity].entries()) {
    const end = Math.min(income, cap * 100);
    weighted += (end - start) * RATES[index];
    if (end === income) break;
    start = end;
  }
  return rounded(weighted, 100);
}

function rate(amount, basisPoints) {
  return rounded(amount * basisPoints, 10000);
}

const currency = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});

function rounded(numerator, denominator) {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

function cents(value, label, signed = false) {
  const match = /^(-?)(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value?.trim());
  if (!match || (match[1] && !signed)) {
    throw new RangeError(`Enter ${label} in dollars with up to eight digits and two decimal places.`);
  }
  const magnitude = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return match[1] && magnitude ? -magnitude : magnitude;
}

function formatMoney(amounts) {
  return Object.fromEntries(Object.entries(amounts).map(([key, amount]) =>
    [key, amount === null ? '—' : currency.format(amount / 100)]));
}
