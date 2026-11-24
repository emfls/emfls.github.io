// 2026/27 UK Statutory Employers' Liability (Compulsory Insurance) Act 1969 & HMRC Insurance Premium Tax (IPT)
export const IPT_RATE_2026_27 = 0.12; // 12% standard UK IPT
export const STATUTORY_EL_MINIMUM = 5000000; // £5M minimum statutory requirement
export const STATUTORY_EL_FINE_PER_DAY = 2500; // £2,500/day fine for non-compliance
export const STATUTORY_CERTIFICATE_FINE = 1000; // £1,000 fine for failure to display EL certificate

export const INDUSTRY_RISK_PROFILES = {
  "low": {
    name: "Office / IT / Professional Services / Consulting",
    baseELPerEmployee: 35,
    basePLPer100k: 110,
    basePIPer100k: 320,
    cyberBase: 260
  },
  "medium": {
    name: "Retail / Hospitality / Cleaning / Wholesale",
    baseELPerEmployee: 85,
    basePLPer100k: 240,
    basePIPer100k: 180,
    cyberBase: 340
  },
  "high": {
    name: "Construction / Skilled Trades / Manufacturing / Transport",
    baseELPerEmployee: 210,
    basePLPer100k: 520,
    basePIPer100k: 140,
    cyberBase: 420
  }
};

export const PL_LIMIT_MULTIPLIERS = {
  "none": 0.0,
  "1m": 1.00,
  "2m": 1.18,
  "5m": 1.42,
  "10m": 1.80
};

export function calcUkCommercialInsurance(inputs = {}) {
  const {
    industry = "medium",
    employeeCount = 5,
    turnover = 350000,
    hasEL = true,
    plLimit = "2m",
    hasPI = true,
    hasCyber = true,
    iptRate = IPT_RATE_2026_27
  } = inputs;

  const validEmployees = Math.max(0, parseInt(employeeCount, 10) || 0);
  const validTurnover = Math.max(0, Number(turnover) || 0);
  const profile = INDUSTRY_RISK_PROFILES[industry] || INDUSTRY_RISK_PROFILES["medium"];
  const plMult = PL_LIMIT_MULTIPLIERS[plLimit] !== undefined ? PL_LIMIT_MULTIPLIERS[plLimit] : 1.18;

  // 1. Employers' Liability (EL): £5M statutory minimum (£10M standard)
  let elPremium = 0;
  if (hasEL && validEmployees > 0) {
    const rawEL = validEmployees * profile.baseELPerEmployee;
    elPremium = Math.max(140, rawEL); // minimum policy premium floor
  }

  // 2. Public Liability (PL)
  let plPremium = 0;
  if (plLimit !== "none" && plMult > 0) {
    const turnoverUnits = Math.max(0.5, validTurnover / 100000);
    const rawPL = turnoverUnits * profile.basePLPer100k * plMult;
    plPremium = Math.max(100, rawPL);
  }

  // 3. Professional Indemnity (PI)
  let piPremium = 0;
  if (hasPI) {
    const turnoverUnits = Math.max(0.5, validTurnover / 100000);
    const rawPI = turnoverUnits * profile.basePIPer100k;
    piPremium = Math.max(150, rawPI);
  }

  // 4. Cyber Risk & Data Breach Insurance
  let cyberPremium = 0;
  if (hasCyber) {
    const turnoverFactor = Math.sqrt(Math.max(1, validTurnover / 100000));
    const rawCyber = profile.cyberBase * turnoverFactor;
    cyberPremium = Math.max(200, rawCyber);
  }

  // Net Premium before Insurance Premium Tax
  const netPremium = elPremium + plPremium + piPremium + cyberPremium;

  // Standard UK IPT (12%)
  const iptAmount = netPremium * iptRate;
  const totalAnnualPremium = netPremium + iptAmount;
  const monthlyPremium = totalAnnualPremium / 12;

  // Statutory Compliance Check
  const elRequired = validEmployees > 0;
  const elCompliant = (!elRequired) || (hasEL && elPremium > 0);
  const potentialDailyFine = (!elCompliant) ? STATUTORY_EL_FINE_PER_DAY : 0;
  const potentialMonthlyFineExposure = potentialDailyFine * 30;

  return {
    industry,
    industryName: profile.name,
    employeeCount: validEmployees,
    turnover: validTurnover,
    hasEL,
    plLimit,
    hasPI,
    hasCyber,
    elRequired,
    elCompliant,
    potentialDailyFine,
    potentialMonthlyFineExposure,
    elPremium: Math.round(elPremium * 100) / 100,
    plPremium: Math.round(plPremium * 100) / 100,
    piPremium: Math.round(piPremium * 100) / 100,
    cyberPremium: Math.round(cyberPremium * 100) / 100,
    netPremium: Math.round(netPremium * 100) / 100,
    iptRate: Math.round(iptRate * 1000) / 10,
    iptAmount: Math.round(iptAmount * 100) / 100,
    totalAnnualPremium: Math.round(totalAnnualPremium * 100) / 100,
    monthlyPremium: Math.round(monthlyPremium * 100) / 100
  };
}
