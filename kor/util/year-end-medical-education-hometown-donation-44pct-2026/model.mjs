/**
 * Tool 495: 2026년 연말정산 의료비·교육비·고향사랑기부금 통합 계산기
 * Pure deterministic ESM module.
 */

export const MEDICAL_THRESHOLD_RATE = 0.03; // 총급여의 3% 초과분
export const MEDICAL_GENERAL_LIMIT = 7000000; // 일반 의료비 한도 700만 원
export const POSTPARTUM_CARE_LIMIT = 2000000; // 산후조리원 1회당 200만 원 한도 (소득제한 폐지)

export const EDU_PRESCHOOL_LIMIT = 3000000; // 취학 전 아동 1인당 300만 원
export const EDU_SCHOOL_LIMIT = 3000000;    // 초·중·고생 1인당 300만 원
export const EDU_COLLEGE_LIMIT = 9000000;   // 대학생 1인당 900만 원

/**
 * 의료비 세액공제 계산 (공제율 15%)
 */
export function calcMedicalDeduction(params) {
  const salary = Math.max(0, Number(params.salary) || 0);
  const generalMedical = Math.max(0, Number(params.generalMedical) || 0);
  const postpartumCare = Math.min(POSTPARTUM_CARE_LIMIT, Math.max(0, Number(params.postpartumCare) || 0));
  const unlimitedMedical = Math.max(0, Number(params.unlimitedMedical) || 0); // 본인, 65세+, 장애인, 6세 이하

  const threshold = Math.round(salary * MEDICAL_THRESHOLD_RATE);
  const totalGeneralEligible = Math.min(MEDICAL_GENERAL_LIMIT, generalMedical + postpartumCare);

  let deductionBase = 0;
  if (totalGeneralEligible + unlimitedMedical > threshold) {
    deductionBase = (totalGeneralEligible + unlimitedMedical) - threshold;
  }

  // 기본 공제율 15%
  const taxCredit = Math.round(deductionBase * 0.15);

  return {
    salary,
    threshold,
    generalMedical,
    postpartumCare,
    unlimitedMedical,
    totalGeneralEligible,
    deductionBase,
    taxCredit
  };
}

/**
 * 교육비 세액공제 계산 (공제율 15%)
 */
export function calcEducationDeduction(params) {
  const selfTuition = Math.max(0, Number(params.selfTuition) || 0); // 본인 전액 한도 없음
  const preschoolCount = Math.max(0, Number(params.preschoolCount) || 0);
  const preschoolExpense = Math.min(preschoolCount * EDU_PRESCHOOL_LIMIT, Math.max(0, Number(params.preschoolExpense) || 0));

  const schoolCount = Math.max(0, Number(params.schoolCount) || 0);
  const schoolExpense = Math.min(schoolCount * EDU_SCHOOL_LIMIT, Math.max(0, Number(params.schoolExpense) || 0));

  const collegeCount = Math.max(0, Number(params.collegeCount) || 0);
  const collegeExpense = Math.min(collegeCount * EDU_COLLEGE_LIMIT, Math.max(0, Number(params.collegeExpense) || 0));

  const totalEligibleExpense = selfTuition + preschoolExpense + schoolExpense + collegeExpense;
  const taxCredit = Math.round(totalEligibleExpense * 0.15);

  return {
    selfTuition,
    preschoolExpense,
    schoolExpense,
    collegeExpense,
    totalEligibleExpense,
    taxCredit
  };
}

/**
 * 2026년 고향사랑기부금 세액공제 & 답례품 계산
 * 10만 이하: 100% (지방소득세 포함 전액 환급)
 * 10만 초과 ~ 20만 이하: 44.0% 신설 특급 공제! (국세 40% + 지방세 4%)
 * 20만 초과: 16.5% 공제 (국세 15% + 지방세 1.5%)
 * 답례품: 기부금의 30% 특산품 포인트
 */
export function calcHometownDonation(donationAmount) {
  const donation = Math.max(0, Number(donationAmount) || 0);
  let taxCredit = 0;

  if (donation <= 100000) {
    taxCredit = donation; // 100%
  } else if (donation <= 200000) {
    const tier2 = donation - 100000;
    taxCredit = 100000 + Math.round(tier2 * 0.44); // 44%
  } else {
    const tier3 = donation - 200000;
    taxCredit = 100000 + Math.round(100000 * 0.44) + Math.round(tier3 * 0.165); // 144,000원 + 16.5%
  }

  // 답례품 30%
  const giftBenefit = Math.round(donation * 0.30);
  const totalBenefit = taxCredit + giftBenefit;
  const netProfit = totalBenefit - donation;

  return {
    donation,
    taxCredit,
    giftBenefit,
    totalBenefit,
    netProfit
  };
}

/**
 * 3대 특화 세액공제 통합 계산
 */
export function calcYearEndTaxCreditSpecialPack(params) {
  const med = calcMedicalDeduction(params);
  const edu = calcEducationDeduction(params);
  const donation = calcHometownDonation(params.donationAmount || 0);

  const totalTaxCredit = med.taxCredit + edu.taxCredit + donation.taxCredit;
  const totalFinancialBenefit = totalTaxCredit + donation.giftBenefit;

  return {
    medical: med,
    education: edu,
    donation: donation,
    totalTaxCredit,
    totalFinancialBenefit
  };
}
