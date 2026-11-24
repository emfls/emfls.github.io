/**
 * 2026년 자동차세 연납 할인 및 배기량·차령 경감·전기차 계산 모델
 */

export function calculateCarTax2026(params) {
  const vehicleType = params.vehicleType || "passenger"; // passenger, electric, compact
  const engineCc = Math.max(0, Number(params.engineCc) || 1999);
  const firstRegYear = Math.max(1990, Math.min(2026, Number(params.firstRegYear) || 2026));
  const taxYear = 2026;
  const prepayMonth = params.prepayMonth || "jan"; // jan, mar, jun, sep, regular

  // 1. 차령 계산 (최초등록연도 기준)
  // 당해연도 등록 = 1년차, 전년도 등록 = 2년차, 3년차부터 경감 시작
  const carAge = Math.max(1, taxYear - firstRegYear + 1);

  // 2. 비영업용 승용차 배기량별 기본세율 (본세)
  let baseRatePerCc = 0;
  let annualBaseTax = 0;
  let isElectric = false;

  if (vehicleType === "electric") {
    isElectric = true;
    annualBaseTax = 100000; // 전기차/수소차 비영업용 정액 10만 원
  } else {
    // 일반 내연기관 승용차 (경차 포함)
    if (engineCc <= 1000) {
      baseRatePerCc = 80;
    } else if (engineCc <= 1600) {
      baseRatePerCc = 140;
    } else {
      baseRatePerCc = 200;
    }
    annualBaseTax = Math.floor(engineCc * baseRatePerCc);
  }

  // 3. 차령 경감률 산정
  // 3년차부터 매년 5%씩 감면, 최대 12년차 50% 상한
  // 전기차는 차령 경감 미적용 (0%)
  let ageDiscountRate = 0;
  if (!isElectric && carAge >= 3) {
    ageDiscountRate = Math.min(0.50, (carAge - 2) * 0.05);
  }

  // 4. 차령 경감 후 본세 & 지방교육세 (본세의 30%)
  const discountedBaseTax = Math.floor(annualBaseTax * (1 - ageDiscountRate));
  const educationTax = Math.floor(discountedBaseTax * 0.30);
  const annualRegularTax = discountedBaseTax + educationTax;

  // 5. 연납 공제율 (2026년 법정 5.0% 공제율 유지)
  // 1월 연납 (2~12월 11개월분 5% 할인 -> 실질 4.5833%)
  // 3월 연납 (4~12월 9개월분 5% 할인 -> 실질 3.75%)
  // 6월 연납 (7~12월 6개월분 5% 할인 -> 실질 2.50%)
  // 9월 연납 (10~12월 3개월분 5% 할인 -> 실질 1.25%)
  let effectiveDiscountRate = 0;
  if (prepayMonth === "jan") {
    effectiveDiscountRate = (11 / 12) * 0.05; // 4.5833%
  } else if (prepayMonth === "mar") {
    effectiveDiscountRate = (9 / 12) * 0.05;  // 3.75%
  } else if (prepayMonth === "jun") {
    effectiveDiscountRate = (6 / 12) * 0.05;  // 2.50%
  } else if (prepayMonth === "sep") {
    effectiveDiscountRate = (3 / 12) * 0.05;  // 1.25%
  } else {
    effectiveDiscountRate = 0; // 정기분
  }

  const prepayDiscountAmount = Math.floor(annualRegularTax * effectiveDiscountRate);
  const finalPayableTax = annualRegularTax - prepayDiscountAmount;

  // 6. 정기분 분납액 (연세액 10만 원 이하는 6월 전액 고지, 초과는 6월 50% + 12월 50%)
  let juneRegularTax = 0;
  let decemberRegularTax = 0;
  if (annualRegularTax <= 100000) {
    juneRegularTax = annualRegularTax;
    decemberRegularTax = 0;
  } else {
    juneRegularTax = Math.floor(annualRegularTax / 2);
    decemberRegularTax = annualRegularTax - juneRegularTax;
  }

  // 7. 1월 연납 기준 절감액 & 연환산 수익률 (은행 예금 금리 약 3.2% 대비 확정 수익)
  const janDiscountAmount = Math.floor(annualRegularTax * (11 / 12) * 0.05);
  const janPayableTax = annualRegularTax - janDiscountAmount;
  // 1월 연납의 실질 무위험 확정 수익률 (단순 할인율 4.58%는 11개월 선납이므로 연환산 약 5.0% 수준)
  const equivalentAnnualYield = annualRegularTax > 0 ? (janDiscountAmount / janPayableTax) * (12 / 11) * 100 : 0;

  // 8. 10년간 누적 세금 시뮬레이션 (신차 등록 기준)
  let tenYearTotalTax = 0;
  const tenYearSchedule = [];
  for (let yr = 1; yr <= 10; yr++) {
    const age = yr;
    let discRate = 0;
    if (!isElectric && age >= 3) {
      discRate = Math.min(0.50, (age - 2) * 0.05);
    }
    const bTax = Math.floor(annualBaseTax * (1 - discRate));
    const eTax = Math.floor(bTax * 0.30);
    const yrRegular = bTax + eTax;
    const yrJanPrepaid = yrRegular - Math.floor(yrRegular * (11 / 12) * 0.05);
    tenYearTotalTax += yrJanPrepaid;
    tenYearSchedule.push({
      year: yr,
      age: age,
      discountRate: discRate * 100,
      annualRegular: yrRegular,
      janPrepaid: yrJanPrepaid
    });
  }

  return {
    vehicleType,
    engineCc,
    firstRegYear,
    carAge,
    isElectric,
    baseRatePerCc,
    annualBaseTax,
    ageDiscountRate,
    ageDiscountPercent: Math.round(ageDiscountRate * 100),
    discountedBaseTax,
    educationTax,
    annualRegularTax,
    juneRegularTax,
    decemberRegularTax,
    prepayMonth,
    effectiveDiscountRate,
    effectiveDiscountPercent: Number((effectiveDiscountRate * 100).toFixed(2)),
    prepayDiscountAmount,
    finalPayableTax,
    janDiscountAmount,
    janPayableTax,
    equivalentAnnualYield: Number(equivalentAnnualYield.toFixed(2)),
    tenYearTotalTax,
    tenYearSchedule
  };
}
