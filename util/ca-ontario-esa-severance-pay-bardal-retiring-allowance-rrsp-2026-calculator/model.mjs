// 2026 Ontario Employment Standards Act (ESA), Common Law Bardal Factors & CRA Retiring Allowance (ITA s. 60(j.1))
export const ESA_NOTICE_MAX_WEEKS = 8;
export const ESA_SEVERANCE_MAX_WEEKS = 26;
export const ESA_SEVERANCE_MIN_SERVICE_YEARS = 5;
export const ESA_SEVERANCE_PAYROLL_THRESHOLD = 2500000; // $2.5M Ontario payroll threshold
export const CRA_RETIRING_ALLOWANCE_PRE_1996_ANNUAL = 2000; // $2,000 per year prior to 1996
export const CRA_RETIRING_ALLOWANCE_PRE_1989_ANNUAL = 1500; // $1,500 per year prior to 1989 (non-vested pension)

export function calcOntarioSeveranceBardal(inputs = {}) {
  const {
    annualSalary = 95000,
    yearsOfService = 10,
    completedMonths = 6,
    age = 50,
    jobRole = "professional", // 'executive', 'management', 'professional', 'clerical'
    employerPayrollOver2_5M = true,
    startYear = 1994,
    pre1989NonVestedYears = 0,
    rrspRolloverPercent = 100,
    marginalTaxRate = 43
  } = inputs;

  const validSalary = Math.max(0, Number(annualSalary) || 0);
  const weeklySalary = validSalary / 52;
  const validYears = Math.max(0, Number(yearsOfService) || 0);
  const validMonths = Math.max(0, Math.min(11, Number(completedMonths) || 0));
  const totalServiceDecimal = validYears + (validMonths / 12);
  const validAge = Math.max(18, Number(age) || 50);
  const validTaxRate = Math.max(0, Math.min(60, Number(marginalTaxRate) || 43)) / 100;
  const validRolloverPct = Math.max(0, Math.min(100, Number(rrspRolloverPercent) || 100)) / 100;

  // 1. Ontario ESA Statutory Floor
  // Termination Pay (Notice): 1 week per year of service, capped at 8 weeks (if >= 3 months)
  let esaNoticeWeeks = 0;
  if (totalServiceDecimal >= 0.25) {
    esaNoticeWeeks = Math.min(ESA_NOTICE_MAX_WEEKS, Math.max(1, Math.floor(totalServiceDecimal)));
  }
  const esaNoticePayout = esaNoticeWeeks * weeklySalary;

  // Statutory Severance Pay: Requires >= 5 years service AND payroll >= $2.5M
  const isEligibleEsaSeverance = (employerPayrollOver2_5M && totalServiceDecimal >= ESA_SEVERANCE_MIN_SERVICE_YEARS);
  let esaSeveranceWeeks = 0;
  if (isEligibleEsaSeverance) {
    esaSeveranceWeeks = Math.min(ESA_SEVERANCE_MAX_WEEKS, totalServiceDecimal);
  }
  const esaSeverancePayout = esaSeveranceWeeks * weeklySalary;

  const esaTotalWeeks = esaNoticeWeeks + esaSeveranceWeeks;
  const esaTotalPayout = esaNoticePayout + esaSeverancePayout;

  // 2. Common Law Reasonable Notice (Bardal Factors: Age, Character of Employment, Length of Service, Availability of Alternate Employment)
  let roleMultiplier = 3.0; // weeks per year of service
  let roleBaseWeeks = 2;
  if (jobRole === "executive") {
    roleMultiplier = 4.2;
    roleBaseWeeks = 8;
  } else if (jobRole === "management") {
    roleMultiplier = 3.6;
    roleBaseWeeks = 4;
  } else if (jobRole === "professional") {
    roleMultiplier = 3.0;
    roleBaseWeeks = 2;
  } else if (jobRole === "clerical") {
    roleMultiplier = 2.2;
    roleBaseWeeks = 0;
  }

  const ageEnhancement = validAge > 50 ? (validAge - 50) * 0.75 : 0;
  const rawBardalWeeks = (totalServiceDecimal * roleMultiplier) + roleBaseWeeks + ageEnhancement;
  // Common Law rough standard ceiling is 24 months (104 weeks), minimum is statutory floor
  const bardalNoticeWeeks = Math.min(104, Math.max(esaTotalWeeks, Math.round(rawBardalWeeks * 10) / 10));
  const bardalTotalPayout = bardalNoticeWeeks * weeklySalary;

  const severanceGapWeeks = Math.max(0, bardalNoticeWeeks - esaTotalWeeks);
  const severanceGapPayout = Math.max(0, bardalTotalPayout - esaTotalPayout);

  // 3. CRA Retiring Allowance Pre-1996 Tax-Free RRSP Rollover (ITA s. 60(j.1))
  const validStartYear = Math.max(1960, Math.min(2026, Number(startYear) || 2000));
  let pre1996Years = 0;
  if (validStartYear < 1996) {
    pre1996Years = Math.min(totalServiceDecimal, Math.max(0, 1996 - validStartYear));
  }
  const validPre89Years = Math.min(pre1996Years, Math.max(0, Number(pre1989NonVestedYears) || 0));

  const craRolloverLimit = (pre1996Years * CRA_RETIRING_ALLOWANCE_PRE_1996_ANNUAL) +
                           (validPre89Years * CRA_RETIRING_ALLOWANCE_PRE_1989_ANNUAL);

  const maxAllowedTransfer = Math.min(craRolloverLimit, bardalTotalPayout);
  const rrspRolloverTransferred = maxAllowedTransfer * validRolloverPct;
  const taxableCashPayout = bardalTotalPayout - rrspRolloverTransferred;

  // CRA Withholding Tax on Taxable Cash Lump Sum:
  // Up to $5,000: 10%
  // $5,001 to $15,000: 20%
  // Over $15,000: 30%
  let craWithholdingTax = 0;
  if (taxableCashPayout > 0) {
    if (taxableCashPayout <= 5000) {
      craWithholdingTax = taxableCashPayout * 0.10;
    } else if (taxableCashPayout <= 15000) {
      craWithholdingTax = (5000 * 0.10) + ((taxableCashPayout - 5000) * 0.20);
    } else {
      craWithholdingTax = (5000 * 0.10) + (10000 * 0.20) + ((taxableCashPayout - 15000) * 0.30);
    }
  }

  const taxShelteredByRollover = rrspRolloverTransferred * validTaxRate;
  const netCashInHand = taxableCashPayout - craWithholdingTax;

  return {
    annualSalary: validSalary,
    weeklySalary: Math.round(weeklySalary * 100) / 100,
    yearsOfService: validYears,
    completedMonths: validMonths,
    totalServiceDecimal: Math.round(totalServiceDecimal * 100) / 100,
    age: validAge,
    jobRole,
    employerPayrollOver2_5M,
    esaNoticeWeeks: Math.round(esaNoticeWeeks * 100) / 100,
    esaNoticePayout: Math.round(esaNoticePayout * 100) / 100,
    isEligibleEsaSeverance,
    esaSeveranceWeeks: Math.round(esaSeveranceWeeks * 100) / 100,
    esaSeverancePayout: Math.round(esaSeverancePayout * 100) / 100,
    esaTotalWeeks: Math.round(esaTotalWeeks * 100) / 100,
    esaTotalPayout: Math.round(esaTotalPayout * 100) / 100,
    bardalNoticeWeeks: Math.round(bardalNoticeWeeks * 100) / 100,
    bardalTotalPayout: Math.round(bardalTotalPayout * 100) / 100,
    severanceGapWeeks: Math.round(severanceGapWeeks * 100) / 100,
    severanceGapPayout: Math.round(severanceGapPayout * 100) / 100,
    startYear: validStartYear,
    pre1996Years: Math.round(pre1996Years * 100) / 100,
    pre1989NonVestedYears: validPre89Years,
    craRolloverLimit: Math.round(craRolloverLimit * 100) / 100,
    rrspRolloverTransferred: Math.round(rrspRolloverTransferred * 100) / 100,
    taxableCashPayout: Math.round(taxableCashPayout * 100) / 100,
    craWithholdingTax: Math.round(craWithholdingTax * 100) / 100,
    taxShelteredByRollover: Math.round(taxShelteredByRollover * 100) / 100,
    netCashInHand: Math.round(netCashInHand * 100) / 100
  };
}
