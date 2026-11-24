export const CAP_RATE = 0.10;
export const baseExemption = 140_000;
export const seniorSupplement = 60_000;

const oldBaseExemption = 100_000;
const oldSeniorSupplement = 10_000;

function requireRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(label + ' must be between ' + min.toLocaleString('en-US') +
      ' and ' + max.toLocaleString('en-US') + '.');
  }
}

export function appraisedValue(market, priorAppraised, improvements = 0) {
  return Math.min(market, priorAppraised * (1 + CAP_RATE) + improvements);
}

export function optionalExemption(appraised, percent) {
  return percent > 0 ? Math.min(appraised, Math.max(5_000, appraised * percent / 100)) : 0;
}

export function calculate({
  market, priorAppraised, improvements, capActive, schoolRate, schoolPercent,
  senior, veteran, ceiling, growth, localUnits,
}) {
  requireRange(market, 0, 1e9, 'Market value');
  if (capActive) {
    requireRange(priorAppraised, 0, 1e9, 'Prior-year appraised value');
    requireRange(improvements, 0, market, 'New improvement value');
  }
  requireRange(schoolRate, 0, 20, 'ISD rate');
  requireRange(schoolPercent, 0, 20, 'Optional ISD exemption');
  requireRange(growth, -100, 100, 'Annual market growth');
  if (senior && !veteran && ceiling !== null) {
    requireRange(ceiling, 0, 1e9, 'Current ISD tax ceiling');
  }
  localUnits.forEach(({ rate, percent }) => {
    requireRange(rate, 0, 20, 'Local rate');
    requireRange(percent, 0, 20, 'Local exemption');
  });

  const schoolExemption = baseExemption + (senior ? seniorSupplement : 0);
  const oldExemption = oldBaseExemption + (senior ? oldSeniorSupplement : 0);
  const combinedRate = schoolRate + localUnits.reduce((sum, unit) => sum + unit.rate, 0);
  let schoolCeiling = senior && !veteran ? ceiling : null;
  let appraised = capActive ? appraisedValue(market, priorAppraised, improvements) : market;
  const years = [];

  for (let offset = 0; offset < 10; offset += 1) {
    const annualMarket = market * (1 + growth / 100) ** offset;
    if (offset > 0) appraised = appraisedValue(annualMarket, appraised);

    const schoolBase = appraised - optionalExemption(appraised, schoolPercent);
    const schoolTaxable = veteran ? 0 : Math.max(0, schoolBase - schoolExemption);
    const schoolBeforeCeiling = schoolTaxable * schoolRate / 100;
    const existingCeiling = schoolCeiling;
    if (senior && !veteran && schoolCeiling === null) schoolCeiling = schoolBeforeCeiling;
    const schoolTax = Math.min(schoolBeforeCeiling, schoolCeiling ?? Infinity);

    const locals = localUnits.map(({ rate, percent }) => {
      const taxable = veteran ? 0 : appraised - optionalExemption(appraised, percent);
      return { taxable, tax: taxable * rate / 100 };
    });
    const localTax = locals.reduce((sum, unit) => sum + unit.tax, 0);
    const withHomestead = schoolTax + localTax;
    const uncappedTax = annualMarket * combinedRate / 100;
    const oldSchoolTax = veteran ? 0 : Math.min(
      Math.max(0, schoolBase - oldExemption) * schoolRate / 100,
      existingCeiling ?? Infinity,
    );

    years.push({
      year: 2026 + offset, market: annualMarket, appraised, schoolTaxable, locals,
      schoolCeiling, schoolTax, localTax, withHomestead, uncappedTax,
      savings: Math.max(0, uncappedTax - withHomestead),
      oldExemptionSavings: Math.max(0, oldSchoolTax - schoolTax),
      effectiveRate: annualMarket > 0 ? withHomestead / annualMarket * 100 : null,
    });
  }
  return { years, cumulativeSavings: years.reduce((sum, year) => sum + year.savings, 0) };
}
