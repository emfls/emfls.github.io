const MAX_CENTS = 10_000_000_000;
const roundRatio = (n, d) => Math.sign(n) * Math.floor((Math.abs(n) + d / 2) / d);

function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(name + ' is outside the supported range.');
  }
  return value;
}
const money = (value, name) => integer(value, 0, MAX_CENTS, name);

export function parseCents(value) {
  const match = /^([+-]?)([0-9]{1,9})(?:[.]([0-9]{1,2}))?$/.exec(String(value).trim());
  if (!match) throw new RangeError('Enter a number with up to two decimal places.');
  const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return integer(match[1] === '-' && cents ? -cents : cents, -MAX_CENTS, MAX_CENTS, 'Amount');
}

export const STANDARD = Object.freeze({single:1610000, joint:3220000, hoh:2415000});

function standardFor(status) {
  if (!Object.hasOwn(STANDARD, status)) throw new RangeError('Choose a filing status.');
  return STANDARD[status];
}

export function itemizedRate(rate) {
  if (![10,12,22,24,32,35,37].includes(rate)) throw new RangeError('Choose a federal marginal bracket.');
  return Math.min(rate, 35);
}

export function charity(agi, gift, type) {
  money(agi, 'Adjusted gross income');
  integer(gift, 0, MAX_CENTS * 5, 'Qualified gift');
  if (!['cash','stock'].includes(type)) throw new RangeError('Choose cash or long-term stock.');
  const floor = roundRatio(agi, 200);
  const ceiling = roundRatio(agi * (type === 'cash' ? 60 : 30), 100);
  return {floor, ceiling, deduction: Math.max(0, Math.min(ceiling, gift) - floor),
    excess: Math.max(0, gift - ceiling)};
}

export function nonItemizer(status, type, direct, gift) {
  standardFor(status);
  return direct && type === 'cash' ? Math.min(gift, status === 'joint' ? 200000 : 100000) : 0;
}

export function compareGiving({status, agi, annualGift, other, years, rate, annualType, bunchType,
  stockBasis = 0, gainRate = 0, niit = false}) {
  const standard = standardFor(status);
  money(annualGift, 'Annual gift');
  money(other, 'Other allowed itemized deductions');
  integer(years, 2, 5, 'Comparison years');
  integer(stockBasis, 0, MAX_CENTS * 5, 'Stock cost basis');
  if (![0,15,20].includes(gainRate)) throw new RangeError('Choose a capital gains rate.');
  if (!['direct','daf','stock'].includes(annualType)) throw new RangeError('Choose an annual gift route.');
  const effectiveRate = itemizedRate(rate);
  const itemizedTaxableBase = (roundedDeduction, percent) =>
    roundRatio(Math.min(agi, roundedDeduction) * percent, 100);

  function compareYear(gift, type, direct) {
    const data = charity(agi, gift, type);
    const itemized = other + data.deduction;
    const cashDeduction = nonItemizer(status, type, direct, gift);
    // Flat bracket illustration. Section 68 reduces all otherwise-allowed itemized deductions.
    const standardValue = itemizedTaxableBase(standard + cashDeduction, rate);
    const itemizedValue = itemizedTaxableBase(itemized, effectiveRate);
    return {...data, gift, itemized, cashDeduction, itemizes:itemizedValue > standardValue,
      taxValue:Math.max(itemizedValue, standardValue)};
  }

  const annual = compareYear(annualGift, annualType === 'stock' ? 'stock' : 'cash', annualType === 'direct');
  const bunch = compareYear(annualGift * years, bunchType, false);
  const later = compareYear(0, 'cash', false);
  const beforeGifts = later.taxValue * years;
  const annualSavings = annual.taxValue * years - beforeGifts;
  const bunchSavings = bunch.taxValue + later.taxValue * (years - 1) - beforeGifts;
  const deductionAdvantage = bunchSavings - annualSavings;
  const stockGain = Math.max(0, bunch.gift - stockBasis);
  const gainTaxAvoided = bunchType === 'stock' && annualType !== 'stock' && gainRate > 0
    ? roundRatio(stockGain * (gainRate * 100 + (niit ? 380 : 0)), 10000) : 0;

  return {standard, effectiveRate, annual, bunch, later, annualSavings, bunchSavings,
    deductionAdvantage, gainTaxAvoided, netAdvantage:deductionAdvantage + gainTaxAvoided};
}
