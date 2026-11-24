/**
 * 2026년 법정 퇴직소득세 및 IRP 연금수령 3단계(30%/40%/50%) 감면 계산 모델
 */

export function calculateRetirementTax(params) {
  const severancePay = Math.max(0, Number(params.severancePay) || 0);         // 퇴직금 총액 (원)
  const serviceYears = Math.max(1, Math.floor(Number(params.serviceYears)) || 1); // 근속연수 (년)

  // 1. 근속연수공제 (소득세법 제48조 제1항)
  let serviceDeduction = 0;
  if (serviceYears <= 5) {
    serviceDeduction = serviceYears * 1000000;
  } else if (serviceYears <= 10) {
    serviceDeduction = 5000000 + (serviceYears - 5) * 2000000;
  } else if (serviceYears <= 20) {
    serviceDeduction = 15000000 + (serviceYears - 10) * 2500000;
  } else {
    serviceDeduction = 40000000 + (serviceYears - 20) * 3000000;
  }
  // 퇴직소득금액을 초과할 수 없음
  serviceDeduction = Math.min(severancePay, serviceDeduction);

  // 2. 환산급여 = (퇴직소득금액 - 근속연수공제) / 근속연수 * 12
  const netSeverance = Math.max(0, severancePay - serviceDeduction);
  const convertedSalary = Math.round((netSeverance / serviceYears) * 12);

  // 3. 환산급여공제 (소득세법 제48조 제2항)
  let convertedDeduction = 0;
  if (convertedSalary <= 8000000) {
    convertedDeduction = convertedSalary;
  } else if (convertedSalary <= 70000000) {
    convertedDeduction = 8000000 + (convertedSalary - 8000000) * 0.60;
  } else if (convertedSalary <= 100000000) {
    convertedDeduction = 45200000 + (convertedSalary - 70000000) * 0.55;
  } else if (convertedSalary <= 300000000) {
    convertedDeduction = 61700000 + (convertedSalary - 100000000) * 0.45;
  } else {
    convertedDeduction = 151700000 + (convertedSalary - 300000000) * 0.35;
  }
  convertedDeduction = Math.min(convertedSalary, Math.round(convertedDeduction));

  // 4. 퇴직소득 과세표준
  const taxBase = Math.max(0, convertedSalary - convertedDeduction);

  // 5. 기본 누진세율 적용 (소득세법 제55조)
  let convertedCalculatedTax = 0;
  if (taxBase <= 14000000) {
    convertedCalculatedTax = taxBase * 0.06;
  } else if (taxBase <= 50000000) {
    convertedCalculatedTax = 840000 + (taxBase - 14000000) * 0.15;
  } else if (taxBase <= 88000000) {
    convertedCalculatedTax = 6240000 + (taxBase - 50000000) * 0.24;
  } else if (taxBase <= 150000000) {
    convertedCalculatedTax = 15360000 + (taxBase - 88000000) * 0.35;
  } else if (taxBase <= 300000000) {
    convertedCalculatedTax = 37060000 + (taxBase - 150000000) * 0.38;
  } else if (taxBase <= 500000000) {
    convertedCalculatedTax = 94060000 + (taxBase - 300000000) * 0.40;
  } else if (taxBase <= 1000000000) {
    convertedCalculatedTax = 174060000 + (taxBase - 500000000) * 0.42;
  } else {
    convertedCalculatedTax = 384060000 + (taxBase - 1000000000) * 0.45;
  }
  convertedCalculatedTax = Math.round(convertedCalculatedTax);

  // 6. 퇴직소득 산출세액 = 환산산출세액 / 12 * 근속연수
  const calculatedTax = Math.round((convertedCalculatedTax / 12) * serviceYears);
  const localTax = Math.round(calculatedTax * 0.10);
  const totalLumpSumTax = calculatedTax + localTax; // 일시금 수령 시 총 결정세액

  const effectiveTaxRate = severancePay > 0 
    ? Math.round((totalLumpSumTax / severancePay) * 10000) / 100 
    : 0;
  const lumpSumNetPayout = Math.max(0, severancePay - totalLumpSumTax);

  // 7. IRP 연금수령 세금 감면 3단계 (2026년 1월 1일 개정)
  // - 1~10년차: 30% 감면 (세율 70% 납부)
  // - 11~20년차: 40% 감면 (세율 60% 납부)
  // - 21년차 이상: 50% 감면 (세율 50% 납부, 2026 신설)

  // 시나리오 A: 10년 균등 연금수령 (전 기간 30% 감면)
  const tax10YearAnnuity = Math.round(totalLumpSumTax * 0.70);
  const savings10Year = Math.round(totalLumpSumTax * 0.30);
  const net10Year = Math.max(0, severancePay - tax10YearAnnuity);

  // 시나리오 B: 20년 균등 연금수령 (1~10년차 30%, 11~20년차 40% 감면)
  // 1~10년차 세금: (totalLumpSumTax / 20) * 10 * 0.70
  // 11~20년차 세금: (totalLumpSumTax / 20) * 10 * 0.60
  const tax20YearAnnuity = Math.round((totalLumpSumTax * 0.5 * 0.70) + (totalLumpSumTax * 0.5 * 0.60));
  const savings20Year = Math.max(0, totalLumpSumTax - tax20YearAnnuity);
  const net20Year = Math.max(0, severancePay - tax20YearAnnuity);

  // 시나리오 C: 25년 균등 연금수령 (1~10년차 30%, 11~20년차 40%, 21~25년차 50% 감면)
  const portion10 = 10 / 25;
  const portion10to20 = 10 / 25;
  const portion21plus = 5 / 25;
  const tax25YearAnnuity = Math.round(
    (totalLumpSumTax * portion10 * 0.70) +
    (totalLumpSumTax * portion10to20 * 0.60) +
    (totalLumpSumTax * portion21plus * 0.50)
  );
  const savings25Year = Math.max(0, totalLumpSumTax - tax25YearAnnuity);
  const net25Year = Math.max(0, severancePay - tax25YearAnnuity);

  return {
    severancePay,
    serviceYears,
    serviceDeduction,
    convertedSalary,
    convertedDeduction,
    taxBase,
    calculatedTax,
    localTax,
    totalLumpSumTax,
    effectiveTaxRate,
    lumpSumNetPayout,
    tax10YearAnnuity,
    savings10Year,
    net10Year,
    tax20YearAnnuity,
    savings20Year,
    net20Year,
    tax25YearAnnuity,
    savings25Year,
    net25Year
  };
}
