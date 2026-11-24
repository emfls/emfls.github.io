export const PARAMS = Object.freeze({
  totalDays: 130,
  reservedDays: 20,
  concurrentDays: 20,
  dailyRateCents: 20094,
  superPercent: 12,
  qualifyingDays: 295,
  lookbackDays: 392,
  minimumHours: 330,
  maximumGapWeeks: 12,
});

const INCOME_LIMITS = new Map([
  ['2025-26', { individual: 186487, family: 386525 }],
  ['2024-25', { individual: 180007, family: 373094 }],
]);
const MONEY_MAX = 1_000_000_000;
const PER_PARENT_CAP = PARAMS.totalDays - PARAMS.reservedDays;

function requireNumber(value, min, max, name, whole = false) {
  if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
    throw new RangeError(`Enter ${whole ? 'a whole number' : 'a number'} from ${min} to ${max} for ${name}.`);
  }
}

export function assessIncome(individualAti, familyAti, assessmentYear = '2025-26') {
  const limits = INCOME_LIMITS.get(assessmentYear);
  if (!limits) throw new RangeError('Choose a supported ATI assessment year.');
  requireNumber(individualAti, 0, MONEY_MAX, 'individual ATI');
  requireNumber(familyAti, individualAti, 2 * MONEY_MAX, 'family ATI');
  if (individualAti <= limits.individual) return 'individual';
  return familyAti <= limits.family ? 'family' : 'fail';
}

function moneyCents(value, name) {
  requireNumber(value, 0, MONEY_MAX, name);
  const scaled = value * 100;
  const cents = Math.round(scaled);
  if (Math.abs(scaled - cents) > Number.EPSILON * Math.max(1, scaled)) {
    throw new RangeError(`Enter ${name} to the nearest cent.`);
  }
  return cents;
}

export function assessWork({ qualifyingDays, hours, gapWeeks }) {
  requireNumber(qualifyingDays, 0, PARAMS.lookbackDays, 'qualifying period in days', true);
  requireNumber(hours, 0, PARAMS.lookbackDays * 24, 'qualifying work hours');
  requireNumber(gapWeeks, 0, PARAMS.lookbackDays / 7, 'longest work gap');
  return qualifyingDays >= PARAMS.qualifyingDays && hours >= PARAMS.minimumHours
    && gapWeeks <= PARAMS.maximumGapWeeks;
}

// Australian resident income tax before offsets and Medicare, expressed in dollars.
export function residentTax(income) {
  requireNumber(income, 0, 3 * MONEY_MAX, 'taxable income');
  return taxInHundredthsOfACent(Math.round(income * 100)) / 10000;
}

function taxInHundredthsOfACent(cents) {
  return Math.max(0, Math.min(cents, 4_500_000) - 1_820_000) * 15
    + Math.max(0, Math.min(cents, 13_500_000) - 4_500_000) * 30
    + Math.max(0, Math.min(cents, 19_000_000) - 13_500_000) * 37
    + Math.max(0, cents - 19_000_000) * 45;
}

function netCents(grossCents, baseCents) {
  const incrementalTax = taxInHundredthsOfACent(baseCents + grossCents)
    - taxInHundredthsOfACent(baseCents);
  const levy = grossCents * 2;
  return Math.round((grossCents * 100 - incrementalTax - levy) / 100);
}

function checkParent(parent, familyAti, assessmentYear) {
  return {
    incomeTest: assessIncome(parent.ati, familyAti, assessmentYear),
    workTest: assessWork(parent.work) ? 'pass' : 'fail',
  };
}

function passes({ incomeTest, workTest }) {
  return incomeTest !== 'fail' && workTest === 'pass';
}

function payment(parent, days) {
  const gross = days * PARAMS.dailyRateCents;
  const superCents = Math.round(gross * PARAMS.superPercent / 100);
  const employerGross = moneyCents(parent.employerPay, 'employer paid leave');
  const otherIncome = moneyCents(parent.otherIncome, 'other taxable income');
  const employerNet = netCents(employerGross, otherIncome);
  const governmentNet = netCents(gross, otherIncome + employerGross);
  return { gross, super: superCents, employerGross, employerNet, governmentNet };
}

function toDollars(paymentCents) {
  return {
    gross: paymentCents.gross / 100,
    super: paymentCents.super / 100,
    employerGross: paymentCents.employerGross / 100,
    employerNet: paymentCents.employerNet / 100,
    governmentNet: paymentCents.governmentNet / 100,
  };
}

export function estimateLeave({
  primary, partner = null, requestedPartnerDays = 20, assessmentYear = '2025-26',
  partnerNeedsPrimaryWork = true,
}) {
  if (partner) {
    requireNumber(requestedPartnerDays, 0, PER_PARENT_CAP, 'planned partner days', true);
  }
  const primaryAti = moneyCents(primary.ati, 'primary ATI');
  const partnerAti = partner ? moneyCents(partner.ati, 'partner ATI') : 0;
  const familyAti = (primaryAti + partnerAti) / 100;
  const primaryCheck = checkParent(primary, familyAti, assessmentYear);
  const partnerCheck = partner ? checkParent(partner, familyAti, assessmentYear) : null;
  if (partnerCheck?.workTest === 'pass' && partnerNeedsPrimaryWork && primaryCheck.workTest !== 'pass') {
    partnerCheck.workTest = 'primary-required';
  }

  const partnerDays = partnerCheck && passes(partnerCheck) ? requestedPartnerDays : 0;
  const primaryDays = passes(primaryCheck)
    ? Math.min(PARAMS.totalDays - partnerDays, partner ? PER_PARENT_CAP : PARAMS.totalDays)
    : 0;
  const primaryPayment = payment(primary, primaryDays);
  const partnerPayment = partner ? payment(partner, partnerDays) : null;
  const governmentGross = primaryPayment.gross + (partnerPayment?.gross ?? 0);
  const governmentNet = primaryPayment.governmentNet + (partnerPayment?.governmentNet ?? 0);
  const governmentSuper = primaryPayment.super + (partnerPayment?.super ?? 0);
  const employerGross = primaryPayment.employerGross + (partnerPayment?.employerGross ?? 0);
  const employerNet = primaryPayment.employerNet + (partnerPayment?.employerNet ?? 0);
  const cashNet = governmentNet + employerNet;

  return {
    primary: { ...primaryCheck, days: primaryDays, ...toDollars(primaryPayment) },
    partner: partner ? { ...partnerCheck, days: partnerDays, ...toDollars(partnerPayment) } : null,
    familyAti,
    unusedDays: PARAMS.totalDays - primaryDays - partnerDays,
    maxConcurrentDays: Math.min(primaryDays, partnerDays, PARAMS.concurrentDays),
    governmentGross: governmentGross / 100,
    governmentNet: governmentNet / 100,
    governmentSuper: governmentSuper / 100,
    employerGross: employerGross / 100,
    employerNet: employerNet / 100,
    cashNet: cashNet / 100,
    totalValue: (cashNet + governmentSuper) / 100,
  };
}
