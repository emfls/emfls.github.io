// Public inputs and results are in GBP. Keep intermediate currency arithmetic in pence.
export const PARAMETERS = Object.freeze({
  basicBand: 37_700,
  personalAllowance: 12_570,
  taperStart: 100_000,
  individualExemption: 3_000,
  trustExemption: 1_500,
  lifetimeLimit: 1_000_000,
  lowerRate: 18,
  upperRate: 24,
  reliefRate: 18
});
export const MAX_AMOUNT = 1_000_000_000;
const penniesPerPound = 100;
const pounds = (amount) => amount / penniesPerPound;

function toPence(value, label, min = 0, max = MAX_AMOUNT) {
  const pence = Math.round(value * penniesPerPound);
  if (!Number.isFinite(value) || value < min || value > max || pounds(pence) !== value) {
    throw new RangeError(`${label} must be between ${min} and ${max}, with up to two decimal places.`);
  }
  return pence;
}

export function disposalGain({ proceeds = 0, cost = 0, disposalCosts = 0, improvements = 0 } = {}) {
  return pounds(
    toPence(proceeds, 'Proceeds') - toPence(cost, 'Acquisition cost')
    - toPence(disposalCosts, 'Disposal costs') - toPence(improvements, 'Improvement costs')
  );
}

function incomeBandInPence({ income = 0, pension = 0, giftAid = 0 }) {
  const netIncome = toPence(income, 'Income');
  const extension = toPence(pension, 'Gross pension', 0, 2 * MAX_AMOUNT) + toPence(giftAid, 'Gross Gift Aid');
  const adjustedNetIncome = netIncome - extension;
  const taper = Math.floor(Math.max(0, adjustedNetIncome - PARAMETERS.taperStart * 100) / 200);
  const allowance = Math.max(0, PARAMETERS.personalAllowance - taper) * 100;
  const taxableIncome = Math.max(0, netIncome - allowance);
  const limit = PARAMETERS.basicBand * 100 + extension;
  return { adjustedNetIncome, allowance, taxableIncome, limit, remaining: Math.max(0, limit - taxableIncome) };
}

export function incomeBand(input = {}) {
  return Object.fromEntries(Object.entries(incomeBandInPence(input)).map(([name, value]) => [name, pounds(value)]));
}

const exemptions = new Map([
  ['individual', PARAMETERS.individualExemption],
  ['trust', PARAMETERS.trustExemption],
  ['disabledTrust', PARAMETERS.individualExemption],
  ['estate', PARAMETERS.individualExemption],
  ['estateNoAEA', 0]
]);

export function calculateCGT(input = {}) {
  const {
    taxpayer = 'individual', ordinaryGain = 0, badrGain = 0, badrUsed = 0,
    investorsGain = 0, investorsUsed = 0, currentLosses = 0, broughtForwardLosses = 0,
    exemptionLimit = exemptions.get(taxpayer)
  } = input;
  const individual = taxpayer === 'individual';
  const trustee = taxpayer === 'trust' || taxpayer === 'disabledTrust';
  if (!exemptions.has(taxpayer)) throw new RangeError('Select a supported taxpayer type.');
  if (!individual && (investorsGain || (badrGain && !trustee))) {
    throw new RangeError('The selected taxpayer type does not support that relief.');
  }

  const disposal = toPence(ordinaryGain, 'Ordinary gain or loss', -3 * MAX_AMOUNT, 2 * MAX_AMOUNT);
  const badr = toPence(badrGain, 'BADR gain');
  const investors = toPence(investorsGain, 'Investors’ Relief gain');
  const lifetimeCap = PARAMETERS.lifetimeLimit * 100;
  const badrEligible = Math.min(badr, Math.max(0, lifetimeCap - toPence(badrUsed, 'Prior BADR claims')));
  const investorsEligible = Math.min(investors, Math.max(0, lifetimeCap - toPence(investorsUsed, 'Prior Investors’ Relief claims')));
  const reliefGain = badrEligible + investorsEligible;
  const reliefExcess = badr - badrEligible + investors - investorsEligible;
  const mainGain = Math.max(0, disposal) + reliefExcess;
  const gains = mainGain + reliefGain;

  const lossesThisYear = toPence(currentLosses, 'Current-year losses') + Math.max(0, -disposal);
  const priorLosses = toPence(broughtForwardLosses, 'Brought-forward losses');
  const exemption = toPence(exemptionLimit, 'Available exemption', 0, exemptions.get(taxpayer));
  const currentUsed = Math.min(gains, lossesThisYear);
  const afterCurrent = gains - currentUsed;
  const broughtForwardUsed = Math.min(priorLosses, Math.max(0, afterCurrent - exemption));
  const exemptionUsed = Math.min(exemption, afterCurrent - broughtForwardUsed);
  const offsets = currentUsed + broughtForwardUsed + exemptionUsed;

  // Main gains are the only gains that can reach 24%. Offset them first.
  const taxableMain = Math.max(0, mainGain - offsets);
  const taxableRelief = reliefGain - Math.max(0, offsets - mainGain);
  const band = individual ? incomeBandInPence(input) : null;
  const remaining = band?.remaining ?? 0;
  const bandForMain = Math.max(0, remaining - taxableRelief);
  const lower = Math.min(taxableMain, bandForMain);
  const upper = taxableMain - lower;
  const rateRows = [
    ['BADR / Investors’ Relief', PARAMETERS.reliefRate, taxableRelief],
    ['Main rate', PARAMETERS.lowerRate, lower],
    ['Main rate', PARAMETERS.upperRate, upper]
  ];
  return {
    tax: pounds(Math.round(rateRows.reduce((sum, [, rate, gain]) => sum + rate * gain, 0) / 100)),
    rows: rateRows.filter(([, , gain]) => gain > 0).map(([label, rate, gain]) => ({
      label, rate, gain: pounds(gain), tax: (gain * rate) / 10_000
    })),
    taxableGain: pounds(taxableMain + taxableRelief),
    taxableReliefGain: pounds(taxableRelief),
    reliefExcess: pounds(reliefExcess),
    currentLossesUsed: pounds(currentUsed),
    unusedCurrentLosses: pounds(lossesThisYear - currentUsed),
    broughtForwardUsed: pounds(broughtForwardUsed),
    unusedBroughtForwardLosses: pounds(priorLosses - broughtForwardUsed),
    exemptionUsed: pounds(exemptionUsed),
    basicBandRemaining: pounds(remaining),
    bandForMain: pounds(bandForMain),
    personalAllowance: band === null ? null : pounds(band.allowance)
  };
}

export function compareScenarios(input, { extraPension = 0, share = 0, partner = {} } = {}) {
  if ((input.taxpayer ?? 'individual') !== 'individual') {
    throw new RangeError('The comparison is available for individuals.');
  }
  const original = calculateCGT(input);
  const originalGain = Math.round((input.ordinaryGain ?? 0) * 100);
  const contribution = toPence(input.pension ?? 0, 'Existing gross pension') + toPence(extraPension, 'Additional gross pension');
  const shareBasisPoints = toPence(share, 'Partner percentage', 0, 100);
  const transferred = Math.round(Math.max(0, originalGain) * shareBasisPoints / 10_000);
  const transferredGain = pounds(transferred);
  const retained = pounds(originalGain - transferred);
  const otherPartnerGain = toPence(partner.ordinaryGain ?? 0, 'Partner’s other gain');
  const partnerInput = { ...partner, taxpayer: 'individual' };
  const partnerBase = calculateCGT(partnerInput).tax;
  const partnerAfter = calculateCGT({ ...partnerInput, ordinaryGain: pounds(otherPartnerGain + transferred) }).tax;
  const pensionInput = { ...input, pension: pounds(contribution) };
  const baseline = original.tax;
  const householdBaseline = Math.round(baseline * 100) + Math.round(partnerBase * 100);

  function comparison(ownTax, partnerTax = 0, basePence = Math.round(baseline * 100)) {
    const total = Math.round(ownTax * 100) + Math.round(partnerTax * 100);
    return { tax: pounds(total), savings: pounds(basePence - total) };
  }

  return {
    baseline,
    pension: comparison(calculateCGT(pensionInput).tax),
    split: {
      ...comparison(calculateCGT({ ...input, ordinaryGain: retained }).tax, partnerAfter, householdBaseline),
      transferredGain
    },
    combined: comparison(calculateCGT({ ...pensionInput, ordinaryGain: retained }).tax, partnerAfter, householdBaseline)
  };
}
