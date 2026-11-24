/**
 * 2026년 출산·양육 3대 정부 지원금 및 자녀세액공제 통합 계산 모델
 */

export function calculateChildSupport2026(params) {
  const childRank = Math.max(1, Math.min(4, params.childRank !== undefined ? Number(params.childRank) || 1 : 1)); // 1(첫째), 2(둘째), 3(셋째 이상)
  const isBirthYear = params.isBirthYear !== undefined ? Boolean(params.isBirthYear) : true;
  const useDaycare = params.useDaycare !== undefined ? Boolean(params.useDaycare) : false;
  const totalChildrenCount = Math.max(1, Math.min(5, params.totalChildrenCount !== undefined ? Number(params.totalChildrenCount) || 1 : 1));

  // 1. 첫만남이용권 (바우처)
  let firstMeetingVoucher = 0;
  if (isBirthYear) {
    firstMeetingVoucher = childRank === 1 ? 2000000 : 3000000;
  }

  // 2. 부모급여 (0세 월 100만, 1세 월 50만)
  // 0세 (생후 0~11개월)
  const parentalAllowanceYear0 = 12 * 1000000; // 1,200만 원
  // 1세 (생후 12~23개월)
  const parentalAllowanceYear1 = 12 * 500000;  // 600만 원
  const totalParentalAllowance = parentalAllowanceYear0 + parentalAllowanceYear1; // 총 1,800만 원

  // 당해 연도(0세 기준) 부모급여 수령액
  const currentYearParentalAllowance = isBirthYear ? parentalAllowanceYear0 : 0;

  // 3. 아동수당 (만 0세~8세 108개월, 월 10만 원)
  const annualChildAllowance = 12 * 100000; // 연 120만 원
  const lifetimeChildAllowance = 108 * 100000; // 1,080만 원

  // 4. 2026 연말정산 자녀세액공제 상향
  // 기본 자녀세액공제 (1명 25만, 2명 55만, 3명 95만, 4명 135만)
  let baseChildTaxCredit = 250000;
  if (totalChildrenCount === 2) {
    baseChildTaxCredit = 550000; // 25만 + 30만
  } else if (totalChildrenCount === 3) {
    baseChildTaxCredit = 950000; // 25만 + 30만 + 40만
  } else if (totalChildrenCount >= 4) {
    baseChildTaxCredit = 950000 + (totalChildrenCount - 3) * 400000;
  }

  // 출생·입양 당해 연도 추가 세액공제
  let birthYearBonusCredit = 0;
  if (isBirthYear) {
    if (childRank === 1) {
      birthYearBonusCredit = 300000;
    } else if (childRank === 2) {
      birthYearBonusCredit = 500000;
    } else {
      birthYearBonusCredit = 700000;
    }
  }

  const totalYearEndTaxCredit = baseChildTaxCredit + birthYearBonusCredit;

  // 1년차(출생 연도) 총 정부 지원 합계
  const firstYearTotalSupport = firstMeetingVoucher + currentYearParentalAllowance + annualChildAllowance + totalYearEndTaxCredit;

  // 만 8세까지 누적 총 지원금 (첫만남 + 부모급여 2년 + 아동수당 9년 + 세액공제 약 9년치)
  const lifetimeTaxCreditEstimate = birthYearBonusCredit + (baseChildTaxCredit * 9);
  const lifetimeTotalSupport = firstMeetingVoucher + totalParentalAllowance + lifetimeChildAllowance + lifetimeTaxCreditEstimate;

  return {
    childRank,
    isBirthYear,
    useDaycare,
    totalChildrenCount,
    firstMeetingVoucher,
    parentalAllowanceYear0,
    parentalAllowanceYear1,
    totalParentalAllowance,
    currentYearParentalAllowance,
    annualChildAllowance,
    lifetimeChildAllowance,
    baseChildTaxCredit,
    birthYearBonusCredit,
    totalYearEndTaxCredit,
    firstYearTotalSupport,
    lifetimeTotalSupport
  };
}
