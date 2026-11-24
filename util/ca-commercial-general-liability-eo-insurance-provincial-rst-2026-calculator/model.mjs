// 2026 Canadian Provincial Non-Recoverable Retail Sales Tax (RST/PST) on Insurance Premiums
export const CA_PROVINCIAL_INSURANCE_TAX_2026 = {
  "NL": { name: "Newfoundland & Labrador (NL)", taxRate: 0.15, taxName: "15.0% RST (Highest in Canada)" },
  "QC": { name: "Quebec (QC)", taxRate: 0.09, taxName: "9.0% Tax on Insurance Premiums" },
  "ON": { name: "Ontario (ON)", taxRate: 0.08, taxName: "8.0% Retail Sales Tax (RST)" },
  "MB": { name: "Manitoba (MB)", taxRate: 0.07, taxName: "7.0% Retail Sales Tax (RST)" },
  "SK": { name: "Saskatchewan (SK)", taxRate: 0.06, taxName: "6.0% Provincial Sales Tax (PST)" },
  "AB": { name: "Alberta (AB)", taxRate: 0.00, taxName: "0.0% (No Provincial Insurance Tax)" },
  "BC": { name: "British Columbia (BC)", taxRate: 0.00, taxName: "0.0% (PST Exempt on Insurance)" },
  "NB": { name: "New Brunswick (NB)", taxRate: 0.00, taxName: "0.0% (No Provincial Insurance Tax)" },
  "NS": { name: "Nova Scotia (NS)", taxRate: 0.00, taxName: "0.0% (No Provincial Insurance Tax)" },
  "PE": { name: "Prince Edward Island (PE)", taxRate: 0.00, taxName: "0.0% (No Provincial Insurance Tax)" }
};

export const CGL_LIMIT_COSTS = {
  "2m": 1250, // $2,000,000 standard commercial general liability
  "5m": 1900  // $5,000,000 high-limit CGL
};

export const EO_LIMIT_COSTS = {
  "none": 0,
  "1m": 1100, // $1,000,000 Errors & Omissions
  "2m": 1750, // $2,000,000 E&O
  "5m": 3100  // $5,000,000 E&O
};

export const PROPERTY_TOOLS_COSTS = {
  "none": 0,
  "50k": 650,  // $50,000 tools & equipment floater
  "150k": 1400 // $150,000 commercial contents & gear
};

export const CYBER_LIMIT_COSTS = {
  "none": 0,
  "1m": 950,  // $1,000,000 cyber risk & breach response
  "2m": 1650  // $2,000,000 cyber shield
};

export function calcCanadaCommercialInsurance(inputs = {}) {
  const {
    provinceCode = "ON",
    cglLimit = "2m",
    eoLimit = "1m",
    propertyLimit = "50k",
    cyberLimit = "1m",
    annualRevenue = 500000
  } = inputs;

  const provInfo = CA_PROVINCIAL_INSURANCE_TAX_2026[provinceCode] || CA_PROVINCIAL_INSURANCE_TAX_2026["ON"];
  const validRevenue = Math.max(0, Number(annualRevenue) || 0);

  // Revenue scaling factor
  const revScale = Math.max(1.0, Math.pow(Math.max(100000, validRevenue) / 350000, 0.22));

  // Base premiums
  const cglBase = (CGL_LIMIT_COSTS[cglLimit] || 1250) * revScale;
  const eoBase = (EO_LIMIT_COSTS[eoLimit] || 0) * revScale;
  const propBase = (PROPERTY_TOOLS_COSTS[propertyLimit] || 0) * revScale;
  const cyberBase = (CYBER_LIMIT_COSTS[cyberLimit] || 0) * revScale;

  const totalBasePremium = cglBase + eoBase + propBase + cyberBase;

  // Provincial Non-Recoverable Tax on Insurance
  const taxRate = provInfo.taxRate;
  const provincialTaxAmount = totalBasePremium * taxRate;
  const totalAnnualCost = totalBasePremium + provincialTaxAmount;
  const monthlyCost = totalAnnualCost / 12;

  // Cross-Province Tax Comparisons (What would this policy cost in NL, QC, ON, MB, SK vs AB/BC 0%?)
  const comparisonProvinces = ["NL", "QC", "ON", "MB", "SK", "AB"];
  const provinceComparisons = {};

  comparisonProvinces.forEach(code => {
    const p = CA_PROVINCIAL_INSURANCE_TAX_2026[code];
    const tax = totalBasePremium * p.taxRate;
    provinceComparisons[code] = {
      name: p.name,
      taxRatePercent: Math.round(p.taxRate * 100),
      taxAmount: Math.round(tax * 100) / 100,
      totalCost: Math.round((totalBasePremium + tax) * 100) / 100
    };
  });

  return {
    provinceCode,
    provinceName: provInfo.name,
    taxName: provInfo.taxName,
    taxRatePercent: Math.round(taxRate * 100),
    isTaxFreeProvince: taxRate === 0.00,
    annualRevenue: validRevenue,
    cglBase: Math.round(cglBase * 100) / 100,
    eoBase: Math.round(eoBase * 100) / 100,
    propBase: Math.round(propBase * 100) / 100,
    cyberBase: Math.round(cyberBase * 100) / 100,
    totalBasePremium: Math.round(totalBasePremium * 100) / 100,
    provincialTaxAmount: Math.round(provincialTaxAmount * 100) / 100,
    totalAnnualCost: Math.round(totalAnnualCost * 100) / 100,
    monthlyCost: Math.round(monthlyCost * 100) / 100,
    provinceComparisons
  };
}
