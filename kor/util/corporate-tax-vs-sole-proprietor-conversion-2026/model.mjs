/**
 * 2026년 개인사업자 vs 법인전환 세금 및 4대보험 비교 계산 엔진
 * 2026년 1월 1일 개시 사업연도 법인세율 전 구간 +1%p 인상(10%/20%/22%/25%)
 * 성실신고확인대상 경계(도소매 15억 / 제조·음식·IT 7.5억 / 임대·서비스 5억) 반영
 */

export function calculateCorpVsSoleProprietor2026(inputs = {}) {
  const annualRevenue = Math.max(0, Number(inputs.annualRevenue) || 0);
  const netProfit = Math.max(0, Number(inputs.netProfit) || 0);
  const industryType = inputs.industryType || "service"; // retail, manufacturing, service
  const ceoSalaryRatio = Math.min(100, Math.max(0, Number(inputs.ceoSalaryRatio) !== undefined ? Number(inputs.ceoSalaryRatio) : 50));

  // 1. 성실신고확인대상 기준
  const thresholds = {
    retail: 1500000000,       // 15억 (도매 및 소매업 등)
    manufacturing: 750000000, // 7.5억 (제조업, 음식·숙박, IT 등)
    service: 500000000        // 5억 (부동산임대, 전문·서비스업 등)
  };
  const faithfulThreshold = thresholds[industryType] || 500000000;
  const isFaithfulReportingTarget = annualRevenue >= faithfulThreshold;
  const faithfulRatioPercent = Math.round((annualRevenue / faithfulThreshold) * 100);

  // 2. 개인사업자 종합소득세 및 지역건보료 계산
  // 기본 인적공제 150만 원 가정
  const soleTaxBase = Math.max(0, netProfit - 1500000);
  let soleIncomeTax = 0;
  if (soleTaxBase <= 14000000) {
    soleIncomeTax = soleTaxBase * 0.06;
  } else if (soleTaxBase <= 50000000) {
    soleIncomeTax = soleTaxBase * 0.15 - 1260000;
  } else if (soleTaxBase <= 88000000) {
    soleIncomeTax = soleTaxBase * 0.24 - 5760000;
  } else if (soleTaxBase <= 150000000) {
    soleIncomeTax = soleTaxBase * 0.35 - 15440000;
  } else if (soleTaxBase <= 300000000) {
    soleIncomeTax = soleTaxBase * 0.38 - 19940000;
  } else if (soleTaxBase <= 500000000) {
    soleIncomeTax = soleTaxBase * 0.40 - 25940000;
  } else if (soleTaxBase <= 1000000000) {
    soleIncomeTax = soleTaxBase * 0.42 - 35940000;
  } else {
    soleIncomeTax = soleTaxBase * 0.45 - 65940000;
  }
  soleIncomeTax = Math.floor(Math.max(0, soleIncomeTax));
  const soleLocalTax = Math.floor(soleIncomeTax * 0.1);
  const soleTotalIncomeTax = soleIncomeTax + soleLocalTax;

  // 지역가입자 건강보험료 (건보 7.09% + 장기요양 12.95% = 8.008%)
  const soleHealthInsurance = Math.floor(netProfit * 0.08008);
  const soleTotalBurden = soleTotalIncomeTax + soleHealthInsurance;
  const soleEffectiveRate = netProfit > 0 ? Math.round((soleTotalBurden / netProfit) * 1000) / 10 : 0;

  // 3. 법인 전환 시 세금 및 직장건보료 계산
  // 대표이사 급여 책정 (순이익 중 ceoSalaryRatio%를 급여로 비용 처리)
  const ceoSalary = Math.floor(netProfit * (ceoSalaryRatio / 100));
  const corpTaxBase = Math.max(0, netProfit - ceoSalary);

  // 2026 법인세율 (+1%p 인상 법정 확정: 10% / 20% / 22% / 25%)
  let corpTax = 0;
  if (corpTaxBase <= 200000000) {
    corpTax = corpTaxBase * 0.10;
  } else if (corpTaxBase <= 20000000000) {
    corpTax = corpTaxBase * 0.20 - 20000000;
  } else if (corpTaxBase <= 300000000000) {
    corpTax = corpTaxBase * 0.22 - 420000000;
  } else {
    corpTax = corpTaxBase * 0.25 - 9420000000;
  }
  corpTax = Math.floor(Math.max(0, corpTax));
  const corpLocalTax = Math.floor(corpTax * 0.10);
  const corpTotalTax = corpTax + corpLocalTax;

  // 대표이사 근로소득세 계산 (근로소득공제 + 기본세율)
  let earnedDeduction = 0;
  if (ceoSalary <= 5000000) {
    earnedDeduction = ceoSalary * 0.70;
  } else if (ceoSalary <= 15000000) {
    earnedDeduction = 3500000 + (ceoSalary - 5000000) * 0.40;
  } else if (ceoSalary <= 45000000) {
    earnedDeduction = 7500000 + (ceoSalary - 15000000) * 0.15;
  } else if (ceoSalary <= 100000000) {
    earnedDeduction = 12000000 + (ceoSalary - 45000000) * 0.05;
  } else {
    earnedDeduction = 14750000 + (ceoSalary - 100000000) * 0.02;
  }
  const ceoTaxBase = Math.max(0, ceoSalary - earnedDeduction - 1500000);
  let ceoCalcTax = 0;
  if (ceoTaxBase <= 14000000) {
    ceoCalcTax = ceoTaxBase * 0.06;
  } else if (ceoTaxBase <= 50000000) {
    ceoCalcTax = ceoTaxBase * 0.15 - 1260000;
  } else if (ceoTaxBase <= 88000000) {
    ceoCalcTax = ceoTaxBase * 0.24 - 5760000;
  } else if (ceoTaxBase <= 150000000) {
    ceoCalcTax = ceoTaxBase * 0.35 - 15440000;
  } else if (ceoTaxBase <= 300000000) {
    ceoCalcTax = ceoTaxBase * 0.38 - 19940000;
  } else if (ceoTaxBase <= 500000000) {
    ceoCalcTax = ceoTaxBase * 0.40 - 25940000;
  } else if (ceoTaxBase <= 1000000000) {
    ceoCalcTax = ceoTaxBase * 0.42 - 35940000;
  } else {
    ceoCalcTax = ceoTaxBase * 0.45 - 65940000;
  }

  // 근로소득 세액공제
  let earnedCredit = 0;
  if (ceoCalcTax <= 1300000) {
    earnedCredit = ceoCalcTax * 0.55;
  } else {
    earnedCredit = 715000 + (ceoCalcTax - 1300000) * 0.30;
  }
  const maxCredit = ceoSalary <= 33000000 ? 740000 : (ceoSalary <= 70000000 ? 660000 : 500000);
  earnedCredit = Math.min(earnedCredit, maxCredit);

  const ceoIncomeTax = Math.floor(Math.max(0, ceoCalcTax - earnedCredit));
  const ceoLocalTax = Math.floor(ceoIncomeTax * 0.10);
  const ceoTotalIncomeTax = ceoIncomeTax + ceoLocalTax;

  // 대표이사 직장건보료 (근로자 4.004% + 회사 4.004% = 8.008%)
  const ceoHealthInsurance = Math.floor(ceoSalary * 0.08008);

  const corpTotalBurden = corpTotalTax + ceoTotalIncomeTax + ceoHealthInsurance;
  const corpEffectiveRate = netProfit > 0 ? Math.round((corpTotalBurden / netProfit) * 1000) / 10 : 0;

  // 4. 세부담 비교 및 절세 분석
  const taxSaving = soleTotalBurden - corpTotalBurden;
  const isCorpAdvantageous = taxSaving > 0;

  let recommendation = "";
  if (isCorpAdvantageous) {
    recommendation = `법인 전환 유리 (연간 ${taxSaving.toLocaleString()}원 절세 가능)`;
  } else {
    recommendation = `개인사업자 유지 유리 (법인 전환 시 세무·기장 관리비용 추가 고려 필요)`;
  }

  let faithfulNotice = "";
  if (isFaithfulReportingTarget) {
    faithfulNotice = `⚠️ 성실신고확인대상 확정: 연매출(${annualRevenue.toLocaleString()}원)이 업종 기준(${faithfulThreshold.toLocaleString()}원)을 초과했습니다. 높은 세무조사 리스크 및 확인 비용이 발생하므로 법인 전환을 적극 권고합니다.`;
  } else if (faithfulRatioPercent >= 80) {
    faithfulNotice = `⚡ 성실신고 진입 임박(${faithfulRatioPercent}%): 기준 매출(${faithfulThreshold.toLocaleString()}원)의 80%를 넘어섰습니다. 사전 법인 전환 검토가 시급합니다.`;
  } else {
    faithfulNotice = `✅ 성실신고 안전권(${faithfulRatioPercent}%): 기준 매출 대비 여유가 있습니다.`;
  }

  return {
    annualRevenue,
    netProfit,
    industryType,
    faithfulThreshold,
    isFaithfulReportingTarget,
    faithfulRatioPercent,
    faithfulNotice,
    soleTaxBase,
    soleTotalIncomeTax,
    soleHealthInsurance,
    soleTotalBurden,
    soleEffectiveRate,
    ceoSalary,
    corpTaxBase,
    corpTotalTax,
    ceoTotalIncomeTax,
    ceoHealthInsurance,
    corpTotalBurden,
    corpEffectiveRate,
    taxSaving,
    isCorpAdvantageous,
    recommendation
  };
}
