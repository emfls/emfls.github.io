// 2026–27 Australian State & Territory General Insurance Duty Rates & Statutory Compounding GST Parameters
export const AU_STATE_DUTY_RATES_2026 = {
  "SA": { name: "South Australia (SA)", dutyRate: 0.11, notes: "11.0% duty on (Premium + GST) = 22.1% combined tax" },
  "WA": { name: "Western Australia (WA)", dutyRate: 0.10, notes: "10.0% duty on (Premium + GST) = 21.0% combined tax" },
  "TAS": { name: "Tasmania (TAS)", dutyRate: 0.10, notes: "10.0% duty on (Premium + GST) = 21.0% combined tax" },
  "NT": { name: "Northern Territory (NT)", dutyRate: 0.10, notes: "10.0% duty on (Premium + GST) = 21.0% combined tax" },
  "NSW": { name: "New South Wales (NSW)", dutyRate: 0.09, notes: "9.0% duty (Small Business <$2M exemption available)" },
  "QLD": { name: "Queensland (QLD)", dutyRate: 0.09, notes: "9.0% duty on (Premium + GST) = 19.9% combined tax" },
  "VIC": { name: "Victoria (VIC)", dutyRate: 0.07, notes: "7.0% commercial business transition rate" },
  "ACT": { name: "Australian Capital Territory (ACT)", dutyRate: 0.00, notes: "0.0% (General insurance duty fully abolished)" }
};

export const PL_LIMIT_BASE_PREMIUMS = {
  "5m": 650,   // $5,000,000 public liability
  "10m": 950,  // $10,000,000 standard market requirement
  "20m": 1450  // $20,000,000 enterprise / government contract requirement
};

export const PI_LIMIT_BASE_PREMIUMS = {
  "none": 0,
  "1m": 850,
  "2m": 1350,
  "5m": 2400
};

export const CYBER_BASE_PREMIUMS = {
  "none": 0,
  "500k": 650,
  "1m": 1100,
  "2m": 1950
};

export function calcAuBusinessInsuranceDuty(inputs = {}) {
  const {
    stateCode = "NSW",
    plLimit = "10m",
    piLimit = "1m",
    cyberLimit = "500k",
    turnover = 450000,
    isGstRegistered = true,
    nswSmallBusinessExemption = false
  } = inputs;

  const stateInfo = AU_STATE_DUTY_RATES_2026[stateCode] || AU_STATE_DUTY_RATES_2026["NSW"];
  const validTurnover = Math.max(0, Number(turnover) || 0);

  // 1. Base Premiums by cover
  const plBase = PL_LIMIT_BASE_PREMIUMS[plLimit] || 950;
  const piBase = PI_LIMIT_BASE_PREMIUMS[piLimit] || 0;
  const cyberBase = CYBER_BASE_PREMIUMS[cyberLimit] || 0;

  // Turnover scaling factor (applies modest risk adjustment for larger turnover)
  const turnoverScale = Math.max(1.0, Math.pow(Math.max(100000, validTurnover) / 300000, 0.25));
  const scaledPl = plBase * turnoverScale;
  const scaledPi = piBase * turnoverScale;
  const scaledCyber = cyberBase * turnoverScale;

  const totalBasePremium = scaledPl + scaledPi + scaledCyber;

  // 2. Australian GST (10% on base insurer premium)
  const gstAmount = totalBasePremium * 0.10;
  const subtotalWithGst = totalBasePremium + gstAmount;

  // 3. State Stamp Duty Compounding (applied on top of Base + 10% GST!)
  let applicableDutyRate = stateInfo.dutyRate;
  let isNswExempt = false;
  if (stateCode === "NSW" && nswSmallBusinessExemption && validTurnover < 2000000) {
    applicableDutyRate = 0.00;
    isNswExempt = true;
  }

  const stampDutyAmount = subtotalWithGst * applicableDutyRate;
  const totalInvoiceAmount = subtotalWithGst + stampDutyAmount;
  const monthlyCost = totalInvoiceAmount / 12;

  // 4. Effective Combined Tax Load (%)
  const totalTaxAmount = gstAmount + stampDutyAmount;
  const effectiveCombinedTaxRate = totalBasePremium > 0 ? (totalTaxAmount / totalBasePremium) * 100 : 0;

  // 5. Net Cost for GST-Registered Business (after BAS input tax credit)
  const claimableGstCredit = isGstRegistered ? gstAmount : 0;
  const netAfterGstCost = totalInvoiceAmount - claimableGstCredit;

  // 6. Cross-State Comparison (What would this exact policy cost in SA, VIC, and ACT?)
  const stateComparisons = {};
  Object.keys(AU_STATE_DUTY_RATES_2026).forEach(st => {
    const rate = AU_STATE_DUTY_RATES_2026[st].dutyRate;
    const duty = subtotalWithGst * rate;
    const tot = subtotalWithGst + duty;
    stateComparisons[st] = {
      duty: Math.round(duty * 100) / 100,
      total: Math.round(tot * 100) / 100,
      taxLoad: Math.round(((gstAmount + duty) / totalBasePremium) * 1000) / 10
    };
  });

  return {
    stateCode,
    stateName: stateInfo.name,
    nominalDutyRate: Math.round(stateInfo.dutyRate * 1000) / 10,
    appliedDutyRate: Math.round(applicableDutyRate * 1000) / 10,
    isNswExempt,
    isGstRegistered,
    plPremium: Math.round(scaledPl * 100) / 100,
    piPremium: Math.round(scaledPi * 100) / 100,
    cyberPremium: Math.round(scaledCyber * 100) / 100,
    totalBasePremium: Math.round(totalBasePremium * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    subtotalWithGst: Math.round(subtotalWithGst * 100) / 100,
    stampDutyAmount: Math.round(stampDutyAmount * 100) / 100,
    totalInvoiceAmount: Math.round(totalInvoiceAmount * 100) / 100,
    monthlyCost: Math.round(monthlyCost * 100) / 100,
    effectiveCombinedTaxRate: Math.round(effectiveCombinedTaxRate * 100) / 100,
    claimableGstCredit: Math.round(claimableGstCredit * 100) / 100,
    netAfterGstCost: Math.round(netAfterGstCost * 100) / 100,
    stateComparisons
  };
}
