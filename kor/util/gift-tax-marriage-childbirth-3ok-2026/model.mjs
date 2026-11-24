const SPECIAL_LIMIT = 100_000_000;
const MAX_WON = 1_000_000_000_000_000;

const BASIC_LIMITS = Object.freeze({
  spouse: 600_000_000,
  adultChild: 50_000_000,
  minorChild: 20_000_000,
  adultGrandchild: 50_000_000,
  minorGrandchild: 20_000_000,
  parent: 50_000_000,
  otherRelative: 10_000_000,
  unrelated: 0,
});

const BRACKETS = [
  [100_000_000, 10, 0],
  [500_000_000, 20, 10_000_000],
  [1_000_000_000, 30, 60_000_000],
  [3_000_000_000, 40, 160_000_000],
  [Infinity, 50, 460_000_000],
];

function isWon(amount) {
  return Number.isSafeInteger(amount) && amount >= 0 && amount <= MAX_WON;
}

// Integer ratios preserve whole-won precision, including the Article 58 cap.
function portion(amount, numerator, denominator) {
  return Number(BigInt(amount) * BigInt(numerator) / BigInt(denominator));
}

export function parseManwon(value) {
  const input = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,4})?$/.test(input)) return null;
  const [whole, fraction = ''] = input.replaceAll(',', '').split('.');
  const won = Number(whole) * 10_000 + Number(fraction.padEnd(4, '0'));
  return isWon(won) ? won : null;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.valueOf()) && isoDate(date) === value;
}

function shiftedYears(value, years) {
  const date = new Date(value + 'T00:00:00Z');
  const day = date.getUTCDate();
  const month = date.getUTCMonth();
  date.setUTCDate(1);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  date.setUTCMonth(month + 1, 0);
  date.setUTCDate(Math.min(day, date.getUTCDate()));
  return isoDate(date);
}

export function isSpecialEligible(event, giftDate, eventDate) {
  if (!['birth', 'marriage'].includes(event) || !validDate(giftDate) || !validDate(eventDate)) return false;
  if (giftDate < '2024-01-01') return false;
  const first = event === 'marriage' ? shiftedYears(eventDate, -2) : eventDate;
  return giftDate >= first && giftDate <= shiftedYears(eventDate, 2);
}

export function statutoryDeadline(giftDate) {
  if (!validDate(giftDate)) return '';
  const date = new Date(giftDate + 'T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + 4, 0);
  return isoDate(date);
}

export function progressiveTax(taxBase) {
  if (!Number.isSafeInteger(taxBase) || taxBase < 0) throw new RangeError('과세표준을 확인해 주세요.');
  if (taxBase < 500_000) return { rate: 0, deduction: 0, tax: 0 };
  const [, rate, deduction] = BRACKETS.find(([upper]) => taxBase <= upper);
  return { rate, deduction, tax: portion(taxBase, rate, 100) - deduction };
}

export function calculateGiftTax({
  gift, relation, basicUsed = 0, specialUsed = 0, event = 'none', giftDate, eventDate,
  priorGift = 0, priorBase, priorTax = 0, priorSurcharge = 0, skipExempt = false, timely = false,
}) {
  if (!Object.hasOwn(BASIC_LIMITS, relation)) throw new RangeError('증여자와 받는 사람의 관계를 선택해 주세요.');
  if (![gift, basicUsed, specialUsed, priorGift, priorTax, priorSurcharge].every(isWon)) {
    throw new RangeError('입력 금액을 확인해 주세요.');
  }
  if (specialUsed > SPECIAL_LIMIT) throw new RangeError('이미 사용한 혼인·출산 공제액은 1억 원 이하여야 합니다.');

  const aggregated = priorGift >= 10_000_000 ? priorGift : 0;
  if (aggregated && (!isWon(priorBase) || priorBase > aggregated || aggregated - priorBase > basicUsed + specialUsed)) {
    throw new RangeError('과거 과세표준과 사용한 공제액을 확인해 주세요. 과거 증여액 중 과세표준을 뺀 금액이 사용한 공제액에 포함되어야 합니다.');
  }

  const grandchild = relation === 'adultGrandchild' || relation === 'minorGrandchild';
  const ancestor = grandchild || relation === 'adultChild' || relation === 'minorChild';
  const specialEligible = ancestor && isSpecialEligible(event, giftDate, eventDate);
  const basicAvailable = Math.max(0, BASIC_LIMITS[relation] - basicUsed);
  const specialAvailable = specialEligible ? SPECIAL_LIMIT - specialUsed : 0;
  const basicDeduction = Math.min(gift, basicAvailable);
  const specialDeduction = Math.min(gift - basicDeduction, specialAvailable);
  const taxBase = gift - basicDeduction - specialDeduction + (aggregated ? priorBase : 0);
  const { rate, deduction: bracketDeduction, tax } = progressiveTax(taxBase);

  const surchargeRate = grandchild && !skipExempt
    ? (relation === 'minorGrandchild' && gift + aggregated > 2_000_000_000 ? 40 : 30)
    : 0;
  // Combined gifts here come from the same donor group, so the full base is subject to the surcharge.
  const surcharge = Math.max(0, portion(tax, surchargeRate, 100) - (aggregated ? priorSurcharge : 0));
  const priorCredit = aggregated && taxBase > 0
    ? Math.min(priorTax, portion(tax, priorBase, taxBase))
    : 0;
  const beforeFiling = tax + surcharge - priorCredit;
  const filingCredit = timely ? portion(beforeFiling, 3, 100) : 0;
  return {
    aggregated, basicDeduction, specialDeduction, specialEligible, taxBase, rate, bracketDeduction,
    tax, surchargeRate, surcharge, priorCredit, filingCredit, due: beforeFiling - filingCredit,
  };
}

export function compareCouple(timely) {
  const options = { relation: 'adultChild', event: 'marriage', giftDate: '2026-06-01', eventDate: '2026-05-01', timely };
  const split = 2 * calculateGiftTax({ ...options, gift: 150_000_000 }).due;
  const single = calculateGiftTax({ ...options, gift: 300_000_000 }).due;
  return { split, single, difference: single - split };
}
