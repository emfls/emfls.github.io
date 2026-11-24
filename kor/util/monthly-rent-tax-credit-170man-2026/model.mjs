/**
 * 2026년 연말정산 월세 세액공제 vs 현금영수증 소득공제 30% 계산 엔진
 */

export function calculateMonthlyRentTaxCredit2026(params) {
  const salary = Math.max(0, params.salary !== undefined ? Number(params.salary) || 0 : 45000000);
  const monthlyRent = Math.max(0, params.monthlyRent !== undefined ? Number(params.monthlyRent) || 0 : 600000);
  const monthsPaid = Math.max(1, Math.min(12, params.monthsPaid !== undefined ? Number(params.monthsPaid) || 12 : 12));
  const isHomeless = params.isHomeless !== undefined ? Boolean(params.isHomeless) : true;
  const isEligibleHouse = params.isEligibleHouse !== undefined ? Boolean(params.isEligibleHouse) : true; // 85m2 이하 또는 기준시가 4억 이하
  const hasResidentRegistration = params.hasResidentRegistration !== undefined ? Boolean(params.hasResidentRegistration) : true; // 전입신고
  const customMarginalRate = params.marginalTaxRate !== undefined ? Number(params.marginalTaxRate) : null;

  // 연간 지급 월세액
  const annualRentPaid = monthlyRent * monthsPaid;
  // 월세 세액공제 대상 한도 (연 1,000만 원)
  const maxEligibleRentForCredit = Math.min(10000000, annualRentPaid);

  let qualificationErrors = [];
  if (!isHomeless) {
    qualificationErrors.push("무주택 세대주(또는 세대원) 요건을 충족하지 않습니다.");
  }
  if (!isEligibleHouse) {
    qualificationErrors.push("주택 기준(국민주택규모 85㎡ 이하 또는 기준시가 4억 원 이하)을 초과합니다.");
  }
  if (!hasResidentRegistration) {
    qualificationErrors.push("임대차계약서와 주민등록등본상 주소지가 일치(전입신고)해야 합니다.");
  }
  if (salary > 80000000) {
    qualificationErrors.push("총급여 8,000만 원 초과자는 월세 세액공제 대상에서 제외됩니다.");
  }

  const isCreditEligible = isHomeless && isEligibleHouse && hasResidentRegistration && (salary <= 80000000);

  // 공제율 결정 (5,500만 이하 17%, 5,500만 초과~8,000만 이하 15%)
  let creditRate = 0;
  let creditRatePercent = 0;
  if (salary <= 55000000) {
    creditRate = 0.17;
    creditRatePercent = 17;
  } else if (salary <= 80000000) {
    creditRate = 0.15;
    creditRatePercent = 15;
  }

  // 월세 세액공제 환급액
  const rentCreditRefund = isCreditEligible ? Math.floor(maxEligibleRentForCredit * creditRate) : 0;
  const maxPossibleCredit = isCreditEligible ? (salary <= 55000000 ? 1700000 : 1500000) : 0;

  // 한계세율 추정 (총급여 기반 대략적 과세표준 추정 또는 사용자 입력)
  let effectiveMarginalRate = 16.5; // 기본 15% + 지방세 1.5%
  if (customMarginalRate !== null && !isNaN(customMarginalRate) && customMarginalRate > 0) {
    effectiveMarginalRate = customMarginalRate;
  } else {
    if (salary <= 25000000) {
      effectiveMarginalRate = 6.6; // 6% + 0.6%
    } else if (salary <= 65000000) {
      effectiveMarginalRate = 16.5; // 15% + 1.5%
    } else if (salary <= 100000000) {
      effectiveMarginalRate = 26.4; // 24% + 2.4%
    } else {
      effectiveMarginalRate = 38.5; // 35% + 3.5%
    }
  }

  // 현금영수증 소득공제 (월세액의 30% 소득공제 x 한계세율)
  const cashReceiptDeduction = Math.floor(annualRentPaid * 0.30);
  const cashReceiptTaxSaving = Math.floor(cashReceiptDeduction * (effectiveMarginalRate / 100));

  // 비교 및 권고
  const creditAdvantage = isCreditEligible ? (rentCreditRefund - cashReceiptTaxSaving) : -cashReceiptTaxSaving;
  let recommendedMethod = "세액공제";
  let recommendationText = "";

  if (isCreditEligible) {
    if (creditAdvantage >= 0) {
      recommendedMethod = "월세 세액공제";
      recommendationText = `월세 세액공제가 현금영수증보다 약 ${creditAdvantage.toLocaleString()}원 더 많은 절세 혜택을 제공합니다.`;
    } else {
      recommendedMethod = "현금영수증 소득공제";
      recommendationText = `고소득 한계세율 구간으로 현금영수증 소득공제가 약 ${(-creditAdvantage).toLocaleString()}원 더 유리합니다.`;
    }
  } else {
    recommendedMethod = "현금영수증 소득공제";
    recommendationText = `세액공제 요건 미충족으로 홈택스 주택임차료 현금영수증 소득공제(30%)를 신청하여 약 ${cashReceiptTaxSaving.toLocaleString()}원 절세할 수 있습니다.`;
  }

  return {
    salary,
    monthlyRent,
    monthsPaid,
    annualRentPaid,
    maxEligibleRentForCredit,
    isCreditEligible,
    qualificationErrors,
    creditRatePercent,
    rentCreditRefund,
    maxPossibleCredit,
    effectiveMarginalRate,
    cashReceiptDeduction,
    cashReceiptTaxSaving,
    creditAdvantage,
    recommendedMethod,
    recommendationText
  };
}
