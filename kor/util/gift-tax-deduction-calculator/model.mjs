const deductions = {
  spouse: 600_000_000,
  adult: 50_000_000,
  minor: 20_000_000,
  ancestor: 50_000_000,
  relative: 10_000_000,
};
const eventCap = 100_000_000;
const brackets = [
  [100_000_000, 10, 0],
  [500_000_000, 20, 10_000_000],
  [1_000_000_000, 30, 60_000_000],
  [3_000_000_000, 40, 160_000_000],
  [Infinity, 50, 460_000_000],
];

function percent(won, rate) {
  return Number(BigInt(won) * BigInt(rate) / 100n);
}

export function calculateGiftTax({
  amount, relation, basicUsed = 0, event = 'none', eventUsed = 0,
  skipping = false, timely = false, priorAggregation = false,
}) {
  if (![amount, basicUsed, eventUsed].every(value => Number.isSafeInteger(value) && value >= 0) ||
      !Object.hasOwn(deductions, relation) || !['none', 'marriage', 'birth'].includes(event) ||
      ![skipping, timely, priorAggregation].every(value => typeof value === 'boolean') ||
      eventUsed > eventCap) {
    throw new RangeError('증여 금액, 관계 또는 이미 받은 공제액을 확인하세요.');
  }
  if (priorAggregation) {
    throw new RangeError('가산할 종전 증여가 있으면 합산 과세와 납부세액공제를 별도로 계산해야 합니다.');
  }
  const descendant = relation === 'adult' || relation === 'minor';
  if (!descendant && (event !== 'none' || skipping)) {
    throw new RangeError('혼인·출산 공제와 세대생략 할증은 직계존속에게 받는 증여에 적용합니다.');
  }

  const basicRemaining = Math.max(0, deductions[relation] - basicUsed);
  const eventRemaining = event === 'none' ? 0 : eventCap - eventUsed;
  const basicApplied = Math.min(amount, basicRemaining);
  const eventApplied = Math.min(amount - basicApplied, eventRemaining);
  const taxBase = amount - basicApplied - eventApplied;
  const [, rate, progressiveDeduction] = brackets.find(([limit]) => taxBase <= limit);
  const baseTax = taxBase < 500_000 ? 0 : percent(taxBase, rate) - progressiveDeduction;
  const surchargeRate = skipping ? (relation === 'minor' && amount > 2_000_000_000 ? 40 : 30) : 0;
  const surcharge = percent(baseTax, surchargeRate);
  const beforeCredit = baseTax + surcharge;
  const filingCredit = timely ? percent(beforeCredit, 3) : 0;

  return {basicRemaining, eventRemaining, basicApplied, eventApplied, taxBase, rate,
    baseTax, surchargeRate, surcharge, filingCredit, total: beforeCredit - filingCredit};
}
