/**
 * 2026년 국민연금 조기노령연금 vs 정상수령 vs 연기연금 손익분기 나이 및 건강보험 피부양자 탈락 모델
 */

export function calculateNationalPensionBreakeven2026(params) {
  const normalMonthlyPension = Math.max(100000, Number(params.normalMonthlyPension) || 1200000); // 정상 만 65세 기준 예상 월 수령액 (원)
  const birthYear = Math.max(1940, Math.min(2010, Number(params.birthYear) || 1970));            // 출생연도
  const earlyYears = Math.min(5, Math.max(1, Number(params.earlyYears) || 5));                   // 조기 신청 연수 (1~5년, 기본 5년)
  const delayedYears = Math.min(5, Math.max(1, Number(params.delayedYears) || 5));               // 연기 신청 연수 (1~5년, 기본 5년)

  // 1. 법정 정상 수령 개시 연령 판정
  let normalAge = 65;
  if (birthYear <= 1952) normalAge = 60;
  else if (birthYear <= 1956) normalAge = 61;
  else if (birthYear <= 1960) normalAge = 62;
  else if (birthYear <= 1964) normalAge = 63;
  else if (birthYear <= 1968) normalAge = 64;
  else normalAge = 65; // 1969년생 이후 만 65세

  const earlyStartAge = normalAge - earlyYears;
  const delayedStartAge = normalAge + delayedYears;

  // 2. 월 수령액 산정
  // 조기수령: 1년당 -6% 감액 (월 0.5%씩) -> 5년 조기 시 70% (30% 평생 감액)
  const earlyRate = Number((1 - (earlyYears * 0.06)).toFixed(4));
  const earlyMonthlyPension = Math.round(normalMonthlyPension * earlyRate);

  // 연기연금: 1년당 +7.2% 증액 (월 0.6%씩) -> 5년 연기 시 136% (36% 평생 증액)
  const delayedRate = Number((1 + (delayedYears * 0.072)).toFixed(4));
  const delayedMonthlyPension = Math.round(normalMonthlyPension * delayedRate);

  // 3. 손익분기 나이 (Breakeven Age) 정밀 산출
  // (1) 조기 vs 정상
  // 정상수령자가 조기수령자보다 매월 더 받는 금액: normalMonthly - earlyMonthly
  // 조기수령자가 정상 개시 전까지 먼저 받은 총액: earlyMonthly * (earlyYears * 12)
  // 추월 개월 수: (earlyMonthly * earlyYears * 12) / (normalMonthly - earlyMonthly)
  const earlyLeadTotal = earlyMonthlyPension * (earlyYears * 12);
  const monthlyAdvantageNormal = normalMonthlyPension - earlyMonthlyPension;
  const monthsToCatchEarly = Math.ceil(earlyLeadTotal / monthlyAdvantageNormal);
  const breakevenAgeEarlyVsNormal = Number((normalAge + (monthsToCatchEarly / 12)).toFixed(1));

  // (2) 정상 vs 연기
  // 정상수령자가 연기 개시 전까지 먼저 받는 총액: normalMonthly * (delayedYears * 12)
  // 연기자가 정상보다 매월 더 받는 금액: delayedMonthly - normalMonthly
  // 추월 개월 수: (normalMonthly * delayedYears * 12) / (delayedMonthly - normalMonthly)
  const normalLeadTotal = normalMonthlyPension * (delayedYears * 12);
  const monthlyAdvantageDelayed = delayedMonthlyPension - normalMonthlyPension;
  const monthsToCatchNormal = Math.ceil(normalLeadTotal / monthlyAdvantageDelayed);
  const breakevenAgeNormalVsDelayed = Number((delayedStartAge + (monthsToCatchNormal / 12)).toFixed(1));

  // 4. 연령별(60세~90세) 누적 수령액 시뮬레이션
  const lifetimeSchedule = [];
  for (let age = 60; age <= 90; age++) {
    // 조기수령 누적
    let cumEarly = 0;
    if (age >= earlyStartAge) {
      cumEarly = earlyMonthlyPension * ((age - earlyStartAge + 1) * 12);
    }
    // 정상수령 누적
    let cumNormal = 0;
    if (age >= normalAge) {
      cumNormal = normalMonthlyPension * ((age - normalAge + 1) * 12);
    }
    // 연기수령 누적
    let cumDelayed = 0;
    if (age >= delayedStartAge) {
      cumDelayed = delayedMonthlyPension * ((age - delayedStartAge + 1) * 12);
    }

    lifetimeSchedule.push({
      age,
      cumEarly,
      cumNormal,
      cumDelayed
    });
  }

  // 80세 시점 누적액 비교
  const at80 = lifetimeSchedule.find(s => s.age === 80) || lifetimeSchedule[lifetimeSchedule.length - 1];
  // 85세 시점 누적액 비교
  const at85 = lifetimeSchedule.find(s => s.age === 85) || lifetimeSchedule[lifetimeSchedule.length - 1];

  // 5. 건강보험 피부양자 탈락 위험 경보
  // 연금소득이 연간 2,000만 원 (월 1,666,667원) 초과 시 피부양자 자동 탈락!
  const normalAnnualPension = normalMonthlyPension * 12;
  const delayedAnnualPension = delayedMonthlyPension * 12;
  const isDelayedTriggerNhisDisqualification = delayedAnnualPension > 20000000 && normalAnnualPension <= 20000000;
  const isNormalTriggerNhisDisqualification = normalAnnualPension > 20000000;

  return {
    normalMonthlyPension,
    birthYear,
    normalAge,
    earlyYears,
    delayedYears,
    earlyStartAge,
    delayedStartAge,
    earlyRate,
    earlyRatePercent: Math.round(earlyRate * 100),
    delayedRate,
    delayedRatePercent: Number((delayedRate * 100).toFixed(1)),
    earlyMonthlyPension,
    delayedMonthlyPension,
    breakevenAgeEarlyVsNormal,
    breakevenAgeNormalVsDelayed,
    at80CumEarly: at80.cumEarly,
    at80CumNormal: at80.cumNormal,
    at80CumDelayed: at80.cumDelayed,
    at85CumNormal: at85.cumNormal,
    at85CumDelayed: at85.cumDelayed,
    normalAnnualPension,
    delayedAnnualPension,
    isDelayedTriggerNhisDisqualification,
    isNormalTriggerNhisDisqualification,
    lifetimeSchedule
  };
}
