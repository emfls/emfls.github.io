export const MAX_AMOUNT = 100_000_000_000;

const ANNUAL_EXEMPTION = 300_000;
const BASIC_BAND = 3_770_000;
const LOW_RATE = 18;
const HIGH_RATE = 24;
const BADR_CAPS = new Map([
  ['2026/27', 100_000_000],
  ['2027/28', 50_000_000],
]);

function toPence(value, name, signed = false) {
  const scaled = value * 100;
  const pence = Math.round(scaled);
  if (!Number.isFinite(value) || Math.abs(value) > (signed ? MAX_AMOUNT * 2 : MAX_AMOUNT) ||
      (!signed && value < 0) || pence / 100 !== value) {
    throw new RangeError(`${name} must be a valid pound amount to the nearest penny.`);
  }
  return pence;
}

export function calculatePerson({
  disposalGain = 0, otherGains = 0, taxableIncome = 0, giftAid = 0, pension = 0,
  currentLosses = 0, carriedLosses = 0, qualifies = false, priorBadrGains = 0,
} = {}, year = '2026/27') {
  const cap = BADR_CAPS.get(year);
  if (cap === undefined) throw new RangeError('Unsupported tax year.');

  const disposal = toPence(disposalGain, 'Disposal gain', true);
  const grossGains = Math.max(0, disposal) + toPence(otherGains, 'Other gains');
  const current = toPence(currentLosses, 'Current-year losses') + Math.max(0, -disposal);
  const carried = toPence(carriedLosses, 'Carried-forward losses');
  const prior = toPence(priorBadrGains, 'Gains previously relieved');
  const available = qualifies ? Math.max(0, cap - prior) : 0;
  const badrBeforeDeductions = Math.min(Math.max(0, disposal), available);
  const standardBeforeDeductions = grossGains - badrBeforeDeductions;

  const bandExtension = toPence(giftAid, 'Gross Gift Aid') + toPence(pension, 'Gross pension');
  const room = Math.max(0, BASIC_BAND + bandExtension - toPence(taxableIncome, 'Taxable income'));

  const currentUsed = Math.min(current, grossGains);
  const exemptionUsed = Math.min(ANNUAL_EXEMPTION, grossGains - currentUsed);
  const carriedUsed = Math.min(carried, grossGains - currentUsed - exemptionUsed);
  const deductions = currentUsed + exemptionUsed + carriedUsed;

  // Deduct from standard gains first, reducing the 24% slice wherever possible.
  const standard = Math.max(0, standardBeforeDeductions - deductions);
  const badr = badrBeforeDeductions - Math.max(0, deductions - standardBeforeDeductions);
  // Taxable BADR gains take up basic-rate space before ordinary gains.
  const at18 = Math.min(standard, Math.max(0, room - badr));
  const at24 = standard - at18;
  const taxPence = Math.round(((at18 + badr) * LOW_RATE + at24 * HIGH_RATE) / 100);

  return {
    disposalGain: disposal / 100,
    tax: taxPence / 100,
    exemptionUsed: exemptionUsed / 100,
    currentLossesUsed: currentUsed / 100,
    carriedLossesUsed: carriedUsed / 100,
    lossesToCarry: (current - currentUsed + carried - carriedUsed) / 100,
    basicBandRemaining: room / 100,
    badrAvailable: available / 100,
    badrTaxable: badr / 100,
    standardAt18: at18 / 100,
    standardAt24: at24 / 100,
  };
}

export function compareExit({
  proceeds = 0, costBasis = 0, fees = 0, disposalRelief = 0, owner = {}, partner = null,
} = {}) {
  const gross = toPence(proceeds, 'Proceeds') - toPence(costBasis, 'Cost basis') - toPence(fees, 'Fees');
  const relief = Math.min(Math.max(0, gross), toPence(disposalRelief, 'Relieved gain'));
  const gain = gross - relief;
  const retained = Math.trunc(gain / 2);

  function estimate(year) {
    const solo = calculatePerson({ ...owner, disposalGain: gain / 100 }, year);
    if (!partner) return { tax: solo.tax, withoutTransferTax: solo.tax, savings: 0, people: [solo] };

    const partnerWithoutTransfer = calculatePerson({ ...partner, disposalGain: 0 }, year);
    const withoutTransferPence = Math.round((solo.tax + partnerWithoutTransfer.tax) * 100);
    const first = calculatePerson({ ...owner, disposalGain: retained / 100 }, year);
    const second = calculatePerson({ ...partner, disposalGain: (gain - retained) / 100 }, year);
    const splitTaxPence = Math.round((first.tax + second.tax) * 100);
    return {
      tax: splitTaxPence / 100,
      withoutTransferTax: withoutTransferPence / 100,
      savings: (withoutTransferPence - splitTaxPence) / 100,
      people: [first, second],
    };
  }

  const before = estimate('2026/27');
  const after = estimate('2027/28');
  return {
    disposalGain: gain / 100,
    before,
    after,
    extraTax: Math.round((after.tax - before.tax) * 100) / 100,
  };
}
