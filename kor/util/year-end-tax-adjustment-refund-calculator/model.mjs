const floor = Math.floor;

function integer(value, max = 12_000_000_000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError('금액 또는 인원수를 허용 범위의 정수로 입력하세요.');
  }
  return value;
}

export function earnedDeduction(salary) {
  integer(salary);
  if (salary <= 5000000) return floor(salary * 70 / 100);
  if (salary <= 15000000) return 3500000 + floor((salary - 5000000) * 40 / 100);
  if (salary <= 45000000) return 7500000 + floor((salary - 15000000) * 15 / 100);
  if (salary <= 100000000) return 12000000 + floor((salary - 45000000) * 5 / 100);
  return Math.min(20000000, 14750000 + floor((salary - 100000000) * 2 / 100));
}

export function incomeTax(base) {
  integer(base);
  const [, rate, offset] = [
    [14000000, 6, 0], [50000000, 15, 1260000], [88000000, 24, 5760000],
    [150000000, 35, 15440000], [300000000, 38, 19940000], [500000000, 40, 25940000],
    [1000000000, 42, 35940000], [Infinity, 45, 65940000],
  ].find(([upper]) => base <= upper);
  return floor(base * rate / 100) - offset;
}

export function earnedCredit(assessed, salary) {
  integer(assessed);
  integer(salary);
  const raw = floor((Math.min(assessed, 1300000) * 55 + Math.max(0, assessed - 1300000) * 30) / 100);
  let cap = 740000;
  if (salary > 120000000) cap = Math.max(200000, floor((1000000 - (salary - 120000000)) / 2));
  else if (salary > 70000000) cap = Math.max(500000, floor((1320000 - (salary - 70000000)) / 2));
  else if (salary > 33000000) cap = Math.max(660000, floor((740000000 - (salary - 33000000) * 8) / 1000));
  return Math.min(raw, cap);
}

export function childCredit(children) {
  integer(children, 100);
  if (children === 0) return 0;
  return children === 1 ? 250000 : 550000 + (children - 2) * 400000;
}

export function rentCredit(salary, rent) {
  integer(salary);
  integer(rent);
  if (salary > 80000000) return 0;
  return floor(Math.min(rent, 10000000) * (salary <= 55000000 ? 17 : 15) / 100);
}

export function housingDeduction(salary, housingSavings) {
  integer(salary);
  integer(housingSavings);
  return salary <= 70000000 ? floor(Math.min(housingSavings, 3000000) * 40 / 100) : 0;
}

export function cardDeduction(salary, credit, debit, dependentChildren = 0) {
  integer(salary);
  integer(credit);
  integer(debit);
  integer(dependentChildren, 100);
  // Use quarter-won units so the 25% threshold is exact even for odd KRW.
  const creditOver = Math.max(0, credit * 4 - salary);
  const debitOver = Math.max(0, debit * 4 - Math.max(0, salary - credit * 4));
  const lowerBand = salary <= 70000000;
  const cap = (lowerBand ? 3000000 : 2500000) + Math.min(2, dependentChildren) * (lowerBand ? 500000 : 250000);
  return Math.min(cap, floor((creditOver * 15 + debitOver * 30) / 400));
}

export function settle({
  salary, prepaid = 0, dependents = 0, children = 0, cardChildren = 0, credit = 0, debit = 0,
  housingSavings = 0, rent = 0, marriage = false, education = [], pension = 0, socialInsurance = 0,
}) {
  integer(prepaid);
  integer(dependents, 100);
  integer(pension);
  integer(socialInsurance);
  if (children > dependents || cardChildren > dependents) throw new RangeError('자녀 수는 부양가족 수 이하여야 합니다.');
  if (!Array.isArray(education) || education.length > 100) throw new RangeError('교육비를 자녀별로 입력하세요.');
  const earned = earnedDeduction(salary);
  const personal = (dependents + 1) * 1500000;
  const card = cardDeduction(salary, credit, debit, cardChildren);
  const housing = housingDeduction(salary, housingSavings);
  const base = Math.max(0, salary - earned - personal - card - housing - pension - socialInsurance);
  const assessed = incomeTax(base);
  const earnedTaxCredit = earnedCredit(assessed, salary);
  const childrenCredit = childCredit(children);
  const monthlyRent = rentCredit(salary, rent);
  const marriageCredit = marriage ? 500000 : 0;
  const educationCredit = floor(education.reduce((sum, fee) => sum + Math.min(integer(fee), 3000000), 0) * 15 / 100);
  const standardCredit = socialInsurance || monthlyRent || educationCredit ? 0 : 130000;
  const national = Math.max(0, assessed - earnedTaxCredit - childrenCredit - monthlyRent - marriageCredit - educationCredit - standardCredit);
  const local = floor(national / 10);
  const total = national + local;
  return {earned, personal, card, housing, base, assessed, earnedTaxCredit, childrenCredit,
    monthlyRent, marriageCredit, educationCredit, standardCredit, national, local, total, balance: prepaid - total};
}
