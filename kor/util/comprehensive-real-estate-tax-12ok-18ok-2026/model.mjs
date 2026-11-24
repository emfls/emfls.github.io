export const EOK = 100_000_000;
export const MAX_PRICE = 10_000 * EOK;
export const MAX_AGE = 120;
export const FAIR_MARKET_PERCENT = 60;
export const SURTAX_PERCENT = 20;
export const SINGLE_DEDUCTION = 12 * EOK;
export const INDIVIDUAL_DEDUCTION = 9 * EOK;

const brackets = [
  [3 * EOK, 5, 0],
  [6 * EOK, 7, 600_000],
  [12 * EOK, 10, 2_400_000],
  [25 * EOK, 13, 6_000_000],
  [50 * EOK, 15, 11_000_000],
  [94 * EOK, 20, 36_000_000],
  [Infinity, 27, 101_800_000],
];
const integerPart = '(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)';
const wholePattern = new RegExp('^' + integerPart + '$');
const eokPattern = new RegExp('^(?:(' + integerPart + ')(?:\\.([0-9]{0,8}))?|\\.([0-9]{1,8}))$');

export function parseWhole(value, max) {
  const text = value.trim();
  if (!wholePattern.test(text)) return null;
  const number = Number(text.replaceAll(',', ''));
  return number <= max ? number : null;
}

export function parseEok(value) {
  const match = eokPattern.exec(value.trim());
  if (!match) return null;
  const whole = Number((match[1] ?? '0').replaceAll(',', ''));
  const fraction = Number((match[2] ?? match[3] ?? '').padEnd(8, '0'));
  const price = whole * EOK + fraction;
  return price <= MAX_PRICE ? price : null;
}

export function ageCreditPercent(age) {
  if (age >= 70) return 40;
  if (age >= 65) return 30;
  return age >= 60 ? 20 : 0;
}

export function holdingCreditPercent(years) {
  if (years >= 15) return 50;
  if (years >= 10) return 40;
  return years >= 5 ? 20 : 0;
}

export function progressiveTax(base) {
  const [, rate, deduction] = brackets.find(([upper]) => base <= upper);
  return Math.floor(base * rate / 1_000) - deduction;
}

export function estimatePropertyCredit(base) {
  // 2026 1세대 1주택의 6억원 초과 주택 재산세 비율(45%) × 표준세율(0.4%).
  // 실제 부과 재산세액 / 표준세율 기준 재산세액은 1로 가정한다.
  return Math.floor(base * 18 / 10_000);
}

function requireWhole(value, max, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError(label + ' 입력 범위를 확인해 주세요.');
  }
}

function calculatePerson(price, deduction, creditPercent, enteredPropertyCredit) {
  if (enteredPropertyCredit !== undefined) {
    requireWhole(enteredPropertyCredit, MAX_PRICE, '재산세 중복 공제액');
  }
  const base = Math.max(0, Math.floor((price - deduction) * FAIR_MARKET_PERCENT / 100));
  const gross = progressiveTax(base);
  const propertyCredit = Math.min(gross, enteredPropertyCredit ?? estimatePropertyCredit(base));
  const net = gross - propertyCredit;
  const personalCredit = Math.floor(net * creditPercent / 100);
  const tax = net - personalCredit;
  const surtax = Math.floor(tax * SURTAX_PERCENT / 100);
  return { base, gross, propertyCredit, creditPercent, personalCredit, tax, surtax, total: tax + surtax };
}

export function compareTax({ price, age, holdingYears, singlePropertyCredit, jointPropertyCredits = [undefined, undefined] }) {
  requireWhole(price, MAX_PRICE, '공시가격');
  requireWhole(age, MAX_AGE, '만 나이');
  requireWhole(holdingYears, age, '보유기간');
  if (!Array.isArray(jointPropertyCredits) || jointPropertyCredits.length !== 2) {
    throw new RangeError('공동명의 재산세 공제액 두 개를 입력해 주세요.');
  }

  const agePercent = ageCreditPercent(age);
  const holdingPercent = holdingCreditPercent(holdingYears);
  const single = calculatePerson(
    price, SINGLE_DEDUCTION, Math.min(80, agePercent + holdingPercent), singlePropertyCredit,
  );
  const first = calculatePerson(price / 2, INDIVIDUAL_DEDUCTION, 0, jointPropertyCredits[0]);
  const second = calculatePerson(price / 2, INDIVIDUAL_DEDUCTION, 0, jointPropertyCredits[1]);
  const joint = { spouses: [first, second] };
  for (const key of Object.keys(first)) joint[key] = first[key] + second[key];

  const difference = single.total - joint.total;
  const winner = difference === 0 ? 'tie' : difference < 0 ? 'single' : 'joint';
  return { single, joint, agePercent, holdingPercent, winner, savings: Math.abs(difference) };
}
