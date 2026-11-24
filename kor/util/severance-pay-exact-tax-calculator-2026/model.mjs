/**
 * 2026년 퇴직금 및 소득세법 제48조 퇴직소득세 정확 계산 엔진
 * 근로기준법상 3개월 평균임금(상여·연차 3/12 포함) 산정
 * 2026 소득세법 근속연수공제 + 환산급여공제 5단계 + IRP 연금수령 감면
 */

export function calculateSeveranceTaxExact2026(inputs = {}) {
  const last3MonthsSalary = Math.max(0, Number(inputs.last3MonthsSalary) || 0);
  const annualBonus = Math.max(0, Number(inputs.annualBonus) || 0);
  const unusedAnnualLeavePay = Math.max(0, Number(inputs.unusedAnnualLeavePay) || 0);
  const threeMonthsDays = Math.max(1, Number(inputs.threeMonthsDays) || 92);
  const totalTenureDays = Math.max(0, Number(inputs.totalTenureDays) || 0);

  // 1. 1일 평균임금 및 법정 퇴직금 산정
  // 1일 평균임금 = (3개월 급여 + 연간상여*3/12 + 미사용연차*3/12) / 3개월 역일수
  const bonus3Months = annualBonus * 0.25;
  const leavePay3Months = unusedAnnualLeavePay * 0.25;
  const total3MonthsEarnings = last3MonthsSalary + bonus3Months + leavePay3Months;
  const dailyAverageWage = Math.floor(total3MonthsEarnings / threeMonthsDays);

  // 법정 퇴직금 = 1일 평균임금 * 30일 * (재직일수 / 365)
  const severancePay = Math.floor(dailyAverageWage * 30 * (totalTenureDays / 365));

  // 2. 근속연수 산정 (1년 미만은 1년으로 절상)
  const serviceYears = Math.max(1, Math.ceil(totalTenureDays / 365));

  // 3. 근속연수공제 (소득세법 제48조 제1항)
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

  // 근속공제 후 퇴직소득
  const netSeveranceAfterServiceDeduction = Math.max(0, severancePay - serviceDeduction);

  // 4. 환산급여 계산
  // 환산급여 = ((퇴직금 - 근속연수공제) / 근속연수) * 12
  const convertedSalary = Math.floor((netSeveranceAfterServiceDeduction / serviceYears) * 12);

  // 5. 환산급여공제 5구간
  let convertedSalaryDeduction = 0;
  if (convertedSalary <= 8000000) {
    convertedSalaryDeduction = convertedSalary;
  } else if (convertedSalary <= 70000000) {
    convertedSalaryDeduction = 8000000 + Math.floor((convertedSalary - 8000000) * 0.60);
  } else if (convertedSalary <= 100000000) {
    convertedSalaryDeduction = 45200000 + Math.floor((convertedSalary - 70000000) * 0.55);
  } else if (convertedSalary <= 300000000) {
    convertedSalaryDeduction = 61700000 + Math.floor((convertedSalary - 100000000) * 0.45);
  } else {
    convertedSalaryDeduction = 151700000 + Math.floor((convertedSalary - 300000000) * 0.35);
  }

  // 6. 퇴직소득 과세표준
  const taxBase = Math.max(0, convertedSalary - convertedSalaryDeduction);

  // 7. 환산산출세액 (기본세율 8단계 적용)
  let convertedCalcTax = 0;
  if (taxBase <= 14000000) {
    convertedCalcTax = taxBase * 0.06;
  } else if (taxBase <= 50000000) {
    convertedCalcTax = taxBase * 0.15 - 1260000;
  } else if (taxBase <= 88000000) {
    convertedCalcTax = taxBase * 0.24 - 5760000;
  } else if (taxBase <= 150000000) {
    convertedCalcTax = taxBase * 0.35 - 15440000;
  } else if (taxBase <= 300000000) {
    convertedCalcTax = taxBase * 0.38 - 19940000;
  } else if (taxBase <= 500000000) {
    convertedCalcTax = taxBase * 0.40 - 25940000;
  } else if (taxBase <= 1000000000) {
    convertedCalcTax = taxBase * 0.42 - 35940000;
  } else {
    convertedCalcTax = taxBase * 0.45 - 65940000;
  }
  convertedCalcTax = Math.floor(Math.max(0, convertedCalcTax));

  // 8. 퇴직소득 산출세액 및 결정세액
  // 산출세액 = (환산산출세액 / 12) * 근속연수
  const nationalTax = Math.floor((convertedCalcTax / 12) * serviceYears);
  const localTax = Math.floor(nationalTax * 0.10);
  const totalTax = nationalTax + localTax;

  const effectiveTaxRate = severancePay > 0 ? Math.round((totalTax / severancePay) * 1000) / 10 : 0;
  const netLumpSum = Math.max(0, severancePay - totalTax);

  // 9. IRP 연금계좌 수령 시 절세 혜택 (소득세법 제129조의2)
  // 10년 이하 연금수령: 30% 감면 (퇴직소득세의 70% 납부)
  // 10년 초과 연금수령: 40% 감면 (퇴직소득세의 60% 납부)
  const irpTax10Yr = Math.floor(totalTax * 0.70);
  const irpSaving10Yr = totalTax - irpTax10Yr;

  const irpTaxOver10Yr = Math.floor(totalTax * 0.60);
  const irpSavingOver10Yr = totalTax - irpTaxOver10Yr;

  return {
    last3MonthsSalary,
    annualBonus,
    unusedAnnualLeavePay,
    threeMonthsDays,
    totalTenureDays,
    dailyAverageWage,
    severancePay,
    serviceYears,
    serviceDeduction,
    netSeveranceAfterServiceDeduction,
    convertedSalary,
    convertedSalaryDeduction,
    taxBase,
    convertedCalcTax,
    nationalTax,
    localTax,
    totalTax,
    effectiveTaxRate,
    netLumpSum,
    irpTax10Yr,
    irpSaving10Yr,
    irpTaxOver10Yr,
    irpSavingOver10Yr
  };
}
