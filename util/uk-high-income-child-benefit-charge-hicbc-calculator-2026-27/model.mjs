const TAPER_START = 60_000;
const TAPER_END = 80_000;
const TAPER_STEP = 200;
const ELDEST_WEEKLY_PENCE = 2_705;
const ADDITIONAL_WEEKLY_PENCE = 1_790;
const HIGHER_RATE_TAX_PCT = 40;
const EMPLOYEE_NI_PCT = 2;

export function calculateHicbc({
  grossTaxableIncome,
  grossPensionContributions = 0,
  netGiftAidDonations = 0,
  partnerAni = null,
  children,
  weeks = 52
}) {
  for (const amount of [grossTaxableIncome, grossPensionContributions, netGiftAidDonations, partnerAni ?? 0]) {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000 ||
        Math.round(amount * 100) / 100 !== amount) {
      throw new RangeError('Enter monetary amounts between £0 and £1,000,000,000 with up to two decimal places.');
    }
  }
  if (!Number.isSafeInteger(children) || children < 0 || children > 999) {
    throw new RangeError('Enter a whole number of eligible children from 0 to 999.');
  }
  if (!Number.isInteger(weeks) || weeks < 0 || weeks > 53) {
    throw new RangeError('Enter a whole number of paid weeks from 0 to 53.');
  }

  const toPence = pounds => Math.round(pounds * 100);
  // Quarter-pence keep a 125% Gift Aid gross-up exact at taper boundaries.
  const grossGiftAidUnits = toPence(netGiftAidDonations) * 5;
  const aniUnits = 4 * (toPence(grossTaxableIncome) - toPence(grossPensionContributions)) - grossGiftAidUnits;
  const partnerAniUnits = partnerAni === null ? -Infinity : 4 * toPence(partnerAni);
  const householdAniUnits = Math.max(aniUnits, partnerAniUnits);
  const thresholdUnits = TAPER_START * 400;
  const taperPct = units => Math.min(100, Math.max(0, Math.floor((units - thresholdUnits) / (TAPER_STEP * 400))));
  const weeklyBenefitPence = children === 0 ? 0 : ELDEST_WEEKLY_PENCE + (children - 1) * ADDITIONAL_WEEKLY_PENCE;
  const benefitPence = weeklyBenefitPence * weeks;
  // ITEPA s681C floors both the benefit used for the charge and the resulting liability.
  const chargeableBenefit = Math.floor(benefitPence / 100);
  const chargePct = taperPct(householdAniUnits);
  const charge = Math.floor(chargeableBenefit * chargePct / 100);

  const extraPensionPence = Math.max(0, Math.ceil((aniUnits - thresholdUnits) / 4));
  const projectedAniUnits = aniUnits - extraPensionPence * 4;
  const projectedHouseholdAniUnits = Math.max(projectedAniUnits, partnerAniUnits);
  const projectedChargePct = taperPct(projectedHouseholdAniUnits);
  const projectedCharge = Math.floor(chargeableBenefit * projectedChargePct / 100);
  const benefitRecovered = charge - projectedCharge;
  const sippCostPence = Math.round(extraPensionPence * (100 - HIGHER_RATE_TAX_PCT) / 100);
  const sacrificeCostPence = Math.round(extraPensionPence * (100 - HIGHER_RATE_TAX_PCT - EMPLOYEE_NI_PCT) / 100);
  const bandClawbackPct = chargeableBenefit / (TAPER_END - TAPER_START) * 100;

  return {
    grossGiftAid: grossGiftAidUnits / 400,
    ani: aniUnits / 400,
    householdAni: householdAniUnits / 400,
    weeklyBenefit: weeklyBenefitPence / 100,
    benefit: benefitPence / 100,
    chargePct,
    charge,
    benefitKept: (benefitPence - charge * 100) / 100,
    extraPension: extraPensionPence / 100,
    projectedAni: projectedAniUnits / 400,
    projectedHouseholdAni: projectedHouseholdAniUnits / 400,
    projectedChargePct,
    projectedCharge,
    benefitRecovered,
    sippCost: sippCostPence / 100,
    sacrificeCost: sacrificeCostPence / 100,
    sippCostAfterBenefit: (sippCostPence - benefitRecovered * 100) / 100,
    sacrificeCostAfterBenefit: (sacrificeCostPence - benefitRecovered * 100) / 100,
    bandClawbackPct,
    effectiveMarginalPct: HIGHER_RATE_TAX_PCT + EMPLOYEE_NI_PCT + bandClawbackPct
  };
}
