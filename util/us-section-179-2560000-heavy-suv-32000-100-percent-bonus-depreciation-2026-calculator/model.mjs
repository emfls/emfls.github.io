export const LIMITS_2026 = Object.freeze({
  section179: 2_560_000,
  phaseOutThreshold: 4_090_000,
  heavySuv: 32_000,
  bonusRate: 100,
});

const ASSET_TYPES = [
  'general_equipment_software',
  'heavy_suv_6000_14000_gvwr',
  'exempt_work_truck_cargo_van',
];

const MAX_DOLLARS = 1_000_000_000_000;
function cents(amount) {
  const scaled = amount * 100;
  return Math.round(scaled + Math.abs(scaled) * Number.EPSILON) / 100;
}

export function calculateSection179({
  assetType, assetCost, otherPropertyCost, businessUse, activeIncome, taxRate, bonusRate,
}) {
  if (!ASSET_TYPES.includes(assetType)
    || ![assetCost, otherPropertyCost].every(value => Number.isFinite(value) && value >= 0 && value <= MAX_DOLLARS)
    || !Number.isFinite(activeIncome) || Math.abs(activeIncome) > MAX_DOLLARS
    || ![businessUse, taxRate].every(value => Number.isFinite(value) && value >= 0 && value <= 100)
    || ![0, LIMITS_2026.bonusRate].includes(bonusRate)) {
    throw new RangeError('Enter valid dollars, percentages from 0 to 100, and a supported asset and bonus option.');
  }

  const listedVehicle = assetType !== 'general_equipment_software';
  const lowBusinessUse = businessUse <= 50;
  const businessFraction = businessUse / 100;
  const businessBasis = cents(assetCost * businessFraction);
  const totalSection179Property = cents(otherPropertyCost + (lowBusinessUse ? 0 : businessBasis));
  const phaseOutReduction = Math.min(
    LIMITS_2026.section179, cents(Math.max(0, totalSection179Property - LIMITS_2026.phaseOutThreshold)),
  );
  const annualSection179Cap = cents(LIMITS_2026.section179 - phaseOutReduction);
  const suvCap = assetType === 'heavy_suv_6000_14000_gvwr'
    ? cents(LIMITS_2026.heavySuv * businessFraction)
    : annualSection179Cap;
  const effectiveSection179Cap = lowBusinessUse ? 0 : Math.min(annualSection179Cap, suvCap);
  const electedSection179 = Math.min(businessBasis, effectiveSection179Cap);

  // The election reserves its full basis, including amounts carried forward.
  const bonusBasis = cents(businessBasis - electedSection179);
  const bonusDepreciation = bonusRate === 100 && !(listedVehicle && lowBusinessUse) ? bonusBasis : 0;
  const incomeLimit = cents(Math.max(0, activeIncome - bonusDepreciation));
  const allowedSection179 = Math.min(electedSection179, incomeLimit);
  const section179Carryforward = cents(electedSection179 - allowedSection179);
  const totalYearOneWriteOff = cents(allowedSection179 + bonusDepreciation);
  const currentOffset = Math.min(Math.max(0, activeIncome), totalYearOneWriteOff);
  const estimatedCashTaxSaved = cents(currentOffset * taxRate / 100);

  return {
    businessBasis, totalSection179Property, phaseOutReduction, annualSection179Cap,
    effectiveSection179Cap, electedSection179, bonusBasis, bonusDepreciation,
    incomeLimit, allowedSection179, section179Carryforward, totalYearOneWriteOff,
    estimatedCashTaxSaved, netAfterTaxCost: cents(assetCost - estimatedCashTaxSaved),
    deductionBeyondIncome: cents(totalYearOneWriteOff - currentOffset),
    lowBusinessUse, adsRequired: listedVehicle && lowBusinessUse && businessBasis > 0,
  };
}
