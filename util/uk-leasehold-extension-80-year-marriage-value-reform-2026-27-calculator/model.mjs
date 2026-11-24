/**
 * Tool 482: 2026-27 UK Leasehold Extension Premium Calculator
 * Pure deterministic ESM module.
 */

export const DEFAULT_CAPITALISATION_RATE = 0.06; // 6.0% standard ground rent yield
export const SPORTELLI_DEFERMENT_FLAT = 0.05;     // 5.0% Lands Tribunal Sportelli rate for flats
export const SPORTELLI_DEFERMENT_HOUSE = 0.0475;  // 4.75% for houses
export const STATUTORY_EXTENSION_YEARS = 90;      // 1993 Act adds 90 years

/**
 * Calculates present value of future annual ground rent stream
 * PV = GR * [1 - (1 + y)^(-n)] / y
 */
export function calcCapitalisedGroundRent(annualGroundRent, unexpiredYears, capRate = DEFAULT_CAPITALISATION_RATE) {
  if (annualGroundRent <= 0 || unexpiredYears <= 0) return 0;
  if (capRate <= 0) return annualGroundRent * unexpiredYears;
  const discountFactor = (1 - Math.pow(1 + capRate, -unexpiredYears)) / capRate;
  return Math.round(annualGroundRent * discountFactor);
}

/**
 * Calculates reversion value (present value of freehold reverting at lease end)
 * PV = FreeholdValue / (1 + defermentRate)^unexpiredYears
 */
export function calcReversionValue(freeholdValue, unexpiredYears, defermentRate = SPORTELLI_DEFERMENT_FLAT) {
  if (freeholdValue <= 0 || unexpiredYears <= 0) return 0;
  const discount = Math.pow(1 + defermentRate, unexpiredYears);
  return Math.round(freeholdValue / discount);
}

/**
 * Estimates unencumbered freehold value from current extended/virtual freehold value
 * Typically freehold value = extended lease value * 1.01 (approx 1% freehold premium)
 */
export function calcFreeholdValue(extendedLeaseValue) {
  return Math.round(extendedLeaseValue * 1.01);
}

/**
 * Full UK Lease Extension Premium under 1993 Act + Marriage Value + LFRA 2024 comparison
 */
export function calcUkLeaseExtension(params) {
  const unexpiredYears = Math.max(0, Number(params.unexpiredYears) || 0);
  const currentLeaseValue = Math.max(0, Number(params.currentLeaseValue) || 0);
  const extendedLeaseValue = Math.max(currentLeaseValue, Number(params.extendedLeaseValue) || currentLeaseValue);
  const annualGroundRent = Math.max(0, Number(params.annualGroundRent) || 0);
  const capRate = Number(params.capRate) || DEFAULT_CAPITALISATION_RATE;
  const defermentRate = Number(params.defermentRate) || SPORTELLI_DEFERMENT_FLAT;
  const legalAndValuationCosts = Math.max(0, Number(params.legalAndValuationCosts) || 4000);

  const freeholdVal = calcFreeholdValue(extendedLeaseValue);

  // 1. Diminution of Landlord's Interest
  // a) Capitalised Ground Rent
  const capitalisedGroundRent = calcCapitalisedGroundRent(annualGroundRent, unexpiredYears, capRate);

  // b) Reversion of Freehold
  // Landlord gives up reversion at year n, receives reversion at year (n + 90)
  const pvCurrentReversion = calcReversionValue(freeholdVal, unexpiredYears, defermentRate);
  const pvDeferredReversion = calcReversionValue(freeholdVal, unexpiredYears + STATUTORY_EXTENSION_YEARS, defermentRate);
  const diminutionReversion = Math.max(0, pvCurrentReversion - pvDeferredReversion);

  const diminutionInValue = capitalisedGroundRent + diminutionReversion;

  // 2. Marriage Value (Applies strictly if unexpiredYears < 80)
  // Marriage value is the aggregate increase in value created by uniting interests:
  // Total Post-Extension Value = Extended Lease Value + Deferred Freehold Reversion Value
  // Total Pre-Extension Value = Current Lease Value + Landlord's Current Interest (PV GR + PV Rev)
  let totalMarriageValue = 0;
  let landlordMarriageShare = 0;
  const hasMarriageValue = unexpiredYears < 80;

  if (hasMarriageValue) {
    const postValue = extendedLeaseValue + pvDeferredReversion;
    const preValue = currentLeaseValue + capitalisedGroundRent + pvCurrentReversion;
    totalMarriageValue = Math.max(0, postValue - preValue);
    landlordMarriageShare = Math.round(totalMarriageValue * 0.50); // 50% statutory split
  }

  // 3. Total Statutory Premium Payable to Freeholder
  const statutoryPremium = diminutionInValue + landlordMarriageShare;
  const totalCostIncludingFees = statutoryPremium + legalAndValuationCosts;

  // 4. LFRA 2024 Reform Outlook (Marriage value abolition)
  // Under the Leasehold and Freehold Reform Act 2024:
  // - Marriage value is abolished (saves 100% of landlord marriage value share)
  // - Standard extension is 990 years (effectively reducing deferred reversion to ~£0)
  const lfraEstimatedPremium = diminutionInValue; // No marriage value
  const potentialLfraSavings = landlordMarriageShare;

  // 5. Equity uplift for leaseholder
  const equityGain = extendedLeaseValue - currentLeaseValue;
  const netWealthCreated = equityGain - totalCostIncludingFees;

  return {
    unexpiredYears,
    currentLeaseValue,
    extendedLeaseValue,
    freeholdVal,
    annualGroundRent,
    capitalisedGroundRent,
    diminutionReversion,
    diminutionInValue,
    hasMarriageValue,
    totalMarriageValue,
    landlordMarriageShare,
    statutoryPremium,
    legalAndValuationCosts,
    totalCostIncludingFees,
    lfraEstimatedPremium,
    potentialLfraSavings,
    equityGain,
    netWealthCreated
  };
}
