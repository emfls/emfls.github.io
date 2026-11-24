export const EXEMPTION_LIMIT = 48_000_000;
export const SIMPLIFIED_LIMIT = 104_000_000;
export const CARD_NET_SALES_LIMIT = 1_000_000_000;
export const ANNUAL_CARD_CAP = 10_000_000;
const MAX_WON = 999_999_999_999;

const rates = {
  retail: 15, manufacturing: 20, lodging: 25, transport: 30,
  other: 30, professional: 40, rental: 40, nightlife: 15,
};
const cardModes = ['both', 'simple', 'general', 'none'];

function validateWon(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_WON) {
    throw new RangeError('0원부터 9,999억 9,999만 9,999원까지 입력해 주세요.');
  }
  return amount;
}

export function parseWon(raw) {
  const value = raw.trim();
  if (!/^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)$/.test(value)) {
    throw new RangeError('금액을 원 단위 정수로 입력해 주세요.');
  }
  return validateWon(Number(value.replaceAll(',', '')));
}

export function calculateVat({
  sales, purchases, cardSales, priorSales, priorNetSales, remainingCardCap,
  months, industry, cardEligibility,
}) {
  for (const amount of [sales, purchases, cardSales, priorSales, priorNetSales, remainingCardCap]) {
    validateWon(amount);
  }
  if (cardSales > sales) throw new RangeError('카드·현금영수증 발행액은 과세 매출을 넘을 수 없습니다.');
  if (remainingCardCap > ANNUAL_CARD_CAP) throw new RangeError('연간 발행공제 잔여 한도는 1,000만 원 이하입니다.');
  if (!Number.isInteger(months) || months < 1 || months > 12) {
    throw new RangeError('적용 개월 수는 1~12 사이의 정수로 입력해 주세요.');
  }
  if (!Object.hasOwn(rates, industry) || !cardModes.includes(cardEligibility)) {
    throw new RangeError('업종과 발행세액공제 적용 대상을 선택해 주세요.');
  }

  const rate = rates[industry];
  const typeLimit = ['rental', 'nightlife'].includes(industry) ? EXEMPTION_LIMIT : SIMPLIFIED_LIMIT;
  const exempt = sales * 12 < EXEMPTION_LIMIT * months;
  const cardCredit = Math.min(cardSales * 13, remainingCardCap * 1000);
  const simpleCardEligible = ['both', 'simple'].includes(cardEligibility);
  const generalCardEligible = ['both', 'general'].includes(cardEligibility) && priorNetSales <= CARD_NET_SALES_LIMIT;

  // Keep tax and credits in integer fractions until the won display.
  // Simplified: thousandths of a won. General: eleven-thousandths.
  const simple = settle(sales * rate, purchases * 5, simpleCardEligible ? cardCredit : 0, 1000, exempt, false);
  const general = settle(sales * 1000, purchases * 1000, generalCardEligible ? cardCredit * 11 : 0, 11000, false, true);

  return {
    rate, typeLimit, exempt, simple, general, generalCardEligible,
    annualizedSales: Math.floor(sales * 12 / months),
    belowTypeLimit: priorSales < typeLimit,
  };
}

function settle(outputTax, inputCredit, cardCredit, scale, exempt, refundable) {
  const balance = outputTax - inputCredit;
  const appliedCardCredit = exempt ? 0 : Math.min(cardCredit, Math.max(0, balance));
  const afterCredits = balance - appliedCardCredit;
  const net = exempt ? 0 : refundable ? afterCredits : Math.max(0, afterCredits);
  return {
    outputTax: Math.floor(outputTax / scale),
    inputCredit: Math.floor(inputCredit / scale),
    cardCredit: Math.floor(appliedCardCredit / scale),
    net: Math.trunc(net / scale) || 0,
  };
}
