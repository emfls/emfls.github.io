const SOCIAL_SECURITY_BASE = 184500;
const SOCIAL_SECURITY_RATE = 0.124;
const MEDICARE_RATE = 0.029;
const SE_EARNINGS_FACTOR = 0.9235;
const SE_TAX_THRESHOLD = 400;
const ADDITIONAL_MEDICARE_THRESHOLD = 200000;
const ADDITIONAL_MEDICARE_RATE = 0.009;

function numberInRange(value, label, { min = 0, max = Infinity, integer = false } = {}) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new RangeError(`Check ${label}.`);
  }
  return value;
}

function booleanValue(value, label) {
  if (typeof value !== 'boolean') throw new RangeError(`Check ${label}.`);
  return value;
}

export function longTermCareLimit(age) {
  numberInRange(age, 'year-end age', { max: 120, integer: true });
  if (age <= 40) return 500;
  if (age <= 50) return 930;
  if (age <= 60) return 1860;
  if (age <= 70) return 4960;
  return 6200;
}

export function calculateSelfEmploymentTax(netProfit, socialSecurityWages = 0) {
  numberInRange(netProfit, 'net business income', { min: -Infinity });
  numberInRange(socialSecurityWages, 'Social Security wages');
  const seEarnings = netProfit * SE_EARNINGS_FACTOR;
  if (seEarnings < SE_TAX_THRESHOLD) return 0;
  const remainingBase = Math.max(0, SOCIAL_SECURITY_BASE - socialSecurityWages);
  return Math.min(seEarnings, remainingBase) * SOCIAL_SECURITY_RATE + seEarnings * MEDICARE_RATE;
}

function eligiblePremium(annual, months, exact, label) {
  numberInRange(annual, `${label} annual premium`);
  numberInRange(months, `${label} eligible months`, { max: 12, integer: true });
  if (exact == null) return annual * (months / 12);
  return numberInRange(exact, `${label} exact eligible premiums`, {
    min: months === 12 ? annual : 0,
    max: months === 0 ? 0 : annual
  });
}

function calculatePayroll(premiums, medicareWages, socialSecurityWages, ficaExempt) {
  const taxableSocialSecurityPremium = Math.min(premiums, Math.max(0, SOCIAL_SECURITY_BASE - socialSecurityWages));
  const additionalMedicareWages =
    Math.min(premiums, Math.max(0, medicareWages + premiums - ADDITIONAL_MEDICARE_THRESHOLD));

  return {
    box1Increase: premiums,
    box3Increase: ficaExempt ? 0 : taxableSocialSecurityPremium,
    box5Increase: ficaExempt ? 0 : premiums,
    box14aMemo: premiums,
    regularFicaSavings: ficaExempt
      ? taxableSocialSecurityPremium * SOCIAL_SECURITY_RATE + premiums * MEDICARE_RATE
      : 0,
    additionalMedicareWithholding: ficaExempt ? additionalMedicareWages * ADDITIONAL_MEDICARE_RATE : 0
  };
}

export function calculateDeduction(input) {
  const { entity } = input;
  if (!['sole', 'partner', 'scorp'].includes(entity)) throw new RangeError('Select a business type.');
  const annualPremium = input.annualPremium;
  const ltcPremium = input.ltcPremium ?? 0;
  const line1 = eligiblePremium(annualPremium, input.eligibleMonths, input.exactEligiblePremium, 'Health');
  const eligibleLtc = eligiblePremium(ltcPremium, input.ltcEligibleMonths ?? 12, input.exactEligibleLtc, 'LTC');
  const ltcLimit = input.ltcAge == null && ltcPremium === 0 ? 0 : longTermCareLimit(input.ltcAge);
  const line2 = Math.min(eligibleLtc, ltcLimit);
  const line3 = line1 + line2;
  const federalRate = numberInRange(input.federalRate ?? 0, 'federal rate', { max: 100 });
  const stateRate = numberInRange(input.stateRate ?? 0, 'state rate', { max: 100 });
  const foreignHousingDeduction = numberInRange(input.foreignHousingDeduction ?? 0, 'allocated Form 2555 amount');

  let line10 = null;
  let line11 = null;
  let halfSETax = null;
  let payroll = null;
  let reportingBlocked = false;

  if (entity === 'scorp') {
    const medicareWages = numberInRange(input.medicareWages, 'S-corp Medicare wages');
    const socialSecurityWages = numberInRange(input.socialSecurityWages, 'S-corp Social Security wages');
    const planEstablished = booleanValue(input.planEstablished, 'S-corp payment or reimbursement');
    const box1Reported = booleanValue(input.box1Reported, 'Box 1 reporting');
    const ficaExempt = booleanValue(input.ficaExempt, 'FICA exclusion');
    reportingBlocked = !planEstablished || !box1Reported;
    if (planEstablished) {
      payroll = calculatePayroll(annualPremium + ltcPremium, medicareWages, socialSecurityWages, ficaExempt);
    }
    line11 = medicareWages + (payroll?.box5Increase ?? 0);
  } else {
    const netProfit = numberInRange(input.netProfit, 'net business income', { min: -Infinity });
    const retirement = numberInRange(input.retirement ?? 0, 'deductible retirement contribution');
    halfSETax = input.halfSETax == null
      ? calculateSelfEmploymentTax(netProfit, input.socialSecurityWages ?? 0) / 2
      : numberInRange(input.halfSETax, 'allocated half of self-employment tax');
    line10 = netProfit - halfSETax - retirement;
  }

  const earnedIncomeCap = Math.max(0, (line11 ?? line10) - foreignHousingDeduction);
  const cappedDeduction = Math.min(line3, earnedIncomeCap);
  const deduction = reportingBlocked ? 0 : cappedDeduction;
  const federalSavings = deduction * (federalRate / 100);
  const stateSavings = deduction * (stateRate / 100);

  return {
    line1, line2, line3, line10, line11, halfSETax, earnedIncomeCap, deduction, payroll,
    medicalExcluded: annualPremium - line1,
    ltcExcluded: ltcPremium - eligibleLtc,
    ltcAgeExcess: eligibleLtc - line2,
    earnedIncomeExcess: line3 - cappedDeduction,
    reportingDisallowed: reportingBlocked ? cappedDeduction : 0,
    federalSavings,
    stateSavings,
    incomeTaxSavings: federalSavings + stateSavings
  };
}
