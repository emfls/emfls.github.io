// ATO car thresholds for 1 July 2026 to 30 June 2027.
export const PARAMETERS = Object.freeze({
  fuelEfficientThreshold: 91661,
  standardThreshold: 80809,
  carLimit: 69883,
  gstCreditCap: Math.floor(69883 / 11),
  lctRate: 0.33
});

export const MAX_LCT_VALUE = 100000000;
const TAX_RATES = [25, 30, 32, 39, 47];

function hasTwoDecimalPlaces(value) {
  return Math.abs(value - Math.round(value * 100) / 100) < 1e-9;
}

// Use integer cents. The statutory 10/11 × 33% equals 30% of the
// GST-inclusive excess.
function lctInCents(price, threshold) {
  return Math.round(Math.max(0, price - threshold * 100) * 3 / 10);
}

export function calculateVehicle({ vehicleType, lctValue, businessUse, gstRegistered, taxRate }) {
  const commercial = vehicleType === 'commercial';
  const fuelEfficient = vehicleType === 'fuel-efficient';
  if (!commercial && !fuelEfficient && vehicleType !== 'standard') {
    throw new RangeError('Select a vehicle type.');
  }
  if (!Number.isFinite(lctValue) || lctValue < 0.01 || lctValue > MAX_LCT_VALUE ||
      !hasTwoDecimalPlaces(lctValue)) {
    throw new RangeError('Enter a vehicle price from $0.01 to $100,000,000, to the nearest cent.');
  }
  if (!Number.isFinite(businessUse) || businessUse < 0 || businessUse > 100 ||
      !hasTwoDecimalPlaces(businessUse)) {
    throw new RangeError('Enter business use from 0% to 100%, with up to two decimal places.');
  }
  if (typeof gstRegistered !== 'boolean' || !TAX_RATES.includes(taxRate)) {
    throw new RangeError('Select a GST registration status and tax rate.');
  }

  const { standardThreshold, fuelEfficientThreshold, carLimit, gstCreditCap } = PARAMETERS;
  const price = Math.round(lctValue * 100);
  const businessBasisPoints = Math.round(businessUse * 100);
  const standardLct = lctInCents(price, standardThreshold);
  const fuelEfficientLct = lctInCents(price, fuelEfficientThreshold);
  const lct = commercial ? 0 : fuelEfficient ? fuelEfficientLct : standardLct;
  const vehicleTotal = price + lct;
  const vehicleGst = price / 11;
  const eligibleGst = commercial ? vehicleGst : Math.min(vehicleGst, gstCreditCap * 100);
  const gstCredit = gstRegistered ? Math.round(eligibleGst * businessBasisPoints / 10000) : 0;

  // Subtract the buyer's GST credit before capping the first element of cost.
  const costAfterGstCredit = vehicleTotal - gstCredit;
  const depreciationBase = commercial ? costAfterGstCredit : Math.min(costAfterGstCredit, carLimit * 100);
  const businessDepreciationBase = Math.round(depreciationBase * businessBasisPoints / 10000);
  const estimatedIncomeTaxSaving = Math.round(businessDepreciationBase * taxRate / 100);

  return {
    threshold: commercial ? null : fuelEfficient ? fuelEfficientThreshold : standardThreshold,
    lct: lct / 100,
    vehicleTotal: vehicleTotal / 100,
    standardLct: commercial ? null : standardLct / 100,
    fuelEfficientLct: commercial ? null : fuelEfficientLct / 100,
    lctSaving: commercial ? null : (standardLct - fuelEfficientLct) / 100,
    vehicleGst: Math.round(vehicleGst) / 100,
    gstCredit: gstCredit / 100,
    depreciationBase: depreciationBase / 100,
    businessDepreciationBase: businessDepreciationBase / 100,
    estimatedIncomeTaxSaving: estimatedIncomeTaxSaving / 100,
    estimatedAfterTaxCost: (vehicleTotal - gstCredit - estimatedIncomeTaxSaving) / 100
  };
}
