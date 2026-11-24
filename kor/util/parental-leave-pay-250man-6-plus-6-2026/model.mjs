/**
 * 2026년 육아휴직급여 (월 250만 원 인상, 사후지급금 폐지) 및 6+6 부모육아휴직제 (최대 450만 원) 계산 모델
 */

export function calculateParentalLeavePay2026(params) {
  const wage = Math.max(0, Number(params.wage) || 0);                         // 통상임금 (월급, 원)
  const rawMonths = params.leaveMonths !== undefined ? Number(params.leaveMonths) : 12;
  const leaveMonths = Math.min(18, Math.max(1, Math.floor(isNaN(rawMonths) ? 12 : rawMonths))); // 휴직 기간 (1~18개월)
  const is6Plus6Eligible = Boolean(params.is6Plus6Eligible);                  // 6+6 부모육아휴직제 적용 여부 (생후 18개월 내 부모 모두 사용)
  const spouseWage = Math.max(0, Number(params.spouseWage) || 0);             // 배우자 통상임금 (원)

  // 1. 일반 육아휴직 월별 급여 스케줄 (본인)
  // - 사후지급금(25%) 전면 폐지: 매월 100% 전액 지급!
  // - 1~3개월: 통상임금 100% (상한 2,500,000원, 하한 700,000원)
  // - 4~6개월: 통상임금 100% (상한 2,000,000원, 하한 700,000원)
  // - 7개월 이후: 통상임금 80% (상한 1,600,000원, 하한 700,000원)
  const normalSchedule = [];
  for (let m = 1; m <= leaveMonths; m++) {
    let rate = 1.0;
    let cap = 2500000;
    if (m <= 3) {
      rate = 1.0;
      cap = 2500000;
    } else if (m <= 6) {
      rate = 1.0;
      cap = 2000000;
    } else {
      rate = 0.8;
      cap = 1600000;
    }
    const rawPay = wage * rate;
    const monthlyPay = Math.min(cap, Math.max(700000, Math.round(rawPay)));
    normalSchedule.push({ month: m, pay: monthlyPay, cap, rate });
  }

  const normalTotalPay = normalSchedule.reduce((acc, cur) => acc + cur.pay, 0);

  // 2. 6+6 부모육아휴직제 월별 급여 스케줄 (부모 각자 적용)
  // 상한선: 1개월 250만, 2개월 250만, 3개월 300만, 4개월 350만, 5개월 400만, 6개월 450만 (통상임금 100%)
  // 7개월차부터는 일반 급여 요율(80%, 상한 160만) 적용
  const sixPlusSixCaps = [2500000, 2500000, 3000000, 3500000, 4000000, 4500000];

  function compute6Plus6Schedule(userWage) {
    const sched = [];
    for (let m = 1; m <= leaveMonths; m++) {
      if (m <= 6) {
        const cap = sixPlusSixCaps[m - 1];
        const pay = Math.min(cap, Math.max(700000, Math.round(userWage * 1.0)));
        sched.push({ month: m, pay, cap, isSpecial: true });
      } else {
        const cap = 1600000;
        const pay = Math.min(cap, Math.max(700000, Math.round(userWage * 0.8)));
        sched.push({ month: m, pay, cap, isSpecial: false });
      }
    }
    return sched;
  }

  const self6Plus6Schedule = compute6Plus6Schedule(wage);
  const spouse6Plus6Schedule = compute6Plus6Schedule(spouseWage > 0 ? spouseWage : wage);

  const self6Plus6Total = self6Plus6Schedule.reduce((acc, cur) => acc + cur.pay, 0);
  const spouse6Plus6Total = spouse6Plus6Schedule.reduce((acc, cur) => acc + cur.pay, 0);
  const coupleCombinedTotal = self6Plus6Total + spouse6Plus6Total;

  // 6+6 적용 시 첫 6개월 동안 부부 합산 최대 수령액
  let first6MonthsSelf = 0;
  let first6MonthsSpouse = 0;
  for (let i = 0; i < Math.min(6, leaveMonths); i++) {
    first6MonthsSelf += self6Plus6Schedule[i].pay;
    first6MonthsSpouse += spouse6Plus6Schedule[i].pay;
  }
  const first6MonthsCombined = first6MonthsSelf + first6MonthsSpouse;

  // 6+6 적용으로 인한 본인 추가 수령 혜택 (일반 대비)
  const additionalBenefitOverNormal = Math.max(0, self6Plus6Total - normalTotalPay);

  return {
    wage,
    leaveMonths,
    is6Plus6Eligible,
    normalTotalPay,
    normalSchedule,
    self6Plus6Total,
    self6Plus6Schedule,
    spouse6Plus6Total,
    spouse6Plus6Schedule,
    coupleCombinedTotal,
    first6MonthsCombined,
    additionalBenefitOverNormal
  };
}
